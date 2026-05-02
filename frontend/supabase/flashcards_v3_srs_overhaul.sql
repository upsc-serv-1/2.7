-- ==========================================================================
--  flashcards_v3_srs_overhaul.sql
--
--  Run this in the Supabase SQL editor.
--  Idempotent: safe to run multiple times.
--
--  WHAT IT DOES
--    1. Adds learning_step / is_relearning columns to user_cards.
--    2. Creates folder_algorithm_settings (per-subject / section / microtopic
--       overrides of the SM-2 engine).
--    3. Fixes GHOST CARDS: any user_card with learning_status='not_studied'
--       whose next_review is in the past is reset to NULL (new cards should
--       only appear via the daily new-card cap, never as "due today").
--    4. De-duplicates `cards` by question_id — keeps oldest; repoints
--       user_cards / card_reviews to the canonical card.
--    5. Drops legacy duplicate columns on cards (question_text, answer_text).
--       Safe: data is already backfilled into front_text / back_text.
--    6. Adds helpful indexes.
-- ==========================================================================

-- 1. user_cards: learning-queue tracking
alter table public.user_cards add column if not exists learning_step  integer default 0;
alter table public.user_cards add column if not exists is_relearning  boolean default false;

-- Backfill for existing rows: if repetitions > 0, consider past-learning (step = -1).
update public.user_cards
   set learning_step = case
        when coalesce(repetitions, 0) > 0 then -1
        else 0
    end
 where learning_step is null;

-- 2. folder_algorithm_settings (Noji-style per-folder overrides)
create table if not exists public.folder_algorithm_settings (
  user_id    uuid not null,
  folder_key text not null,                -- '' | 'Subject' | 'Subject|Section' | 'Subject|Section|Microtopic'
  settings   jsonb not null default '{}'::jsonb,
  inherit    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, folder_key)
);
alter table public.folder_algorithm_settings enable row level security;
drop policy if exists "folder_algorithm_settings own" on public.folder_algorithm_settings;
create policy "folder_algorithm_settings own"
  on public.folder_algorithm_settings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Ghost card cleanup: never leave a not_studied card flagged as due
update public.user_cards
   set next_review = null
 where learning_status in ('not_studied','new')
   and next_review is not null
   and next_review <= now();

-- 4. De-duplicate cards by question_id (keep oldest)
with ranked as (
    select id,
           question_id,
           row_number() over (partition by question_id order by created_at, id) as rn,
           first_value(id) over (partition by question_id order by created_at, id) as keeper_id
    from public.cards
    where question_id is not null
      and question_id <> ''
)
update public.user_cards uc
   set card_id = r.keeper_id
  from ranked r
 where uc.card_id = r.id
   and r.rn > 1
   and r.keeper_id <> r.id;

with ranked as (
    select id,
           question_id,
           row_number() over (partition by question_id order by created_at, id) as rn,
           first_value(id) over (partition by question_id order by created_at, id) as keeper_id
    from public.cards
    where question_id is not null
      and question_id <> ''
)
update public.card_reviews cr
   set card_id = r.keeper_id
  from ranked r
 where cr.card_id = r.id
   and r.rn > 1
   and r.keeper_id <> r.id;

-- Remove any duplicate user_cards rows that now collide on (user_id, card_id)
delete from public.user_cards uc
 using public.user_cards uc2
 where uc.user_id = uc2.user_id
   and uc.card_id = uc2.card_id
   and uc.ctid  > uc2.ctid;

-- Drop the now-orphaned duplicate cards
with ranked as (
    select id,
           row_number() over (partition by question_id order by created_at, id) as rn
    from public.cards
    where question_id is not null
      and question_id <> ''
)
delete from public.cards c
 using ranked r
 where c.id = r.id
   and r.rn > 1;

-- 5. Drop redundant legacy columns (data already lives in front_text/back_text)
--    NOTE: commented out by default — uncomment ONLY after verifying front_text/back_text are populated everywhere
--    in your app. Run this SELECT to double-check nothing breaks:
--
--      select count(*) filter (where coalesce(front_text,'') = '' and coalesce(question_text,'') <> '') as missing_front,
--             count(*) filter (where coalesce(back_text,'')  = '' and coalesce(answer_text,'')   <> '') as missing_back
--      from public.cards;
--
-- alter table public.cards drop column if exists question_text;
-- alter table public.cards drop column if exists answer_text;

-- 6. Indexes
create index if not exists idx_user_cards_user_next_review
    on public.user_cards (user_id, next_review)
 where status = 'active';

create index if not exists idx_user_cards_user_learning_status
    on public.user_cards (user_id, learning_status)
 where status = 'active';

create index if not exists idx_cards_subject_section_microtopic
    on public.cards (subject, section_group, microtopic);

create unique index if not exists uq_user_cards_user_card
    on public.user_cards (user_id, card_id);

-- Done.

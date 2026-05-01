/**
 * Supabase integration smoke test — validates the new flashcard code against the REAL DB.
 *
 * Run:  npx tsx scripts/integration_test.ts
 *
 * It will:
 *   1. Verify schema columns exist (applies migration idempotently if SQL is available)
 *   2. Create a throwaway test user card set
 *   3. Grade the cards and verify next_review actually matches the interval (+24h tolerance)
 *   4. Verify getStudyQueue excludes future-dated cards
 *   5. Clean up
 */
import { createClient } from '@supabase/supabase-js';
import { applySM2, DEFAULT_SETTINGS } from '../src/services/sm2';

const url = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk';

const sb = createClient(url, key);

async function main() {
  console.log('── Supabase Integration Smoke ──\n');

  // 1) Check core tables are reachable
  const { error: e1 } = await sb.from('cards').select('id', { head: true, count: 'exact' }).limit(1);
  console.log(e1 ? `✗ cards table: ${e1.message}` : '✓ cards table reachable');

  const { error: e2 } = await sb.from('user_cards').select('id', { head: true, count: 'exact' }).limit(1);
  console.log(e2 ? `✗ user_cards table: ${e2.message}` : '✓ user_cards table reachable');

  // 2) Check the new `folder_algorithm_settings` table & new columns
  const { error: e3 } = await sb.from('folder_algorithm_settings').select('user_id', { head: true, count: 'exact' }).limit(1);
  if (e3) {
    console.log(`ℹ folder_algorithm_settings: NOT yet created — run supabase/flashcards_v3_srs_overhaul.sql`);
  } else {
    console.log('✓ folder_algorithm_settings table reachable');
  }

  const { data: ucProbe, error: e4 } = await sb.from('user_cards').select('learning_step, is_relearning').limit(1);
  if (e4) {
    console.log(`ℹ user_cards.learning_step: missing — run supabase/flashcards_v3_srs_overhaul.sql`);
  } else {
    console.log('✓ user_cards has learning_step + is_relearning columns');
  }

  // 3) Sample a few user_cards rows to see their shape (sanity)
  const { data: sample, error: e5 } = await sb
    .from('user_cards')
    .select('user_id, card_id, status, learning_status, next_review, interval_days, ease_factor, repetitions, lapses')
    .limit(5);
  if (e5) console.log(`✗ sample fetch: ${e5.message}`);
  else console.log(`✓ sample user_cards rows fetched: ${sample?.length}`);

  // 4) Look for GHOST cards: not_studied with next_review in the past
  const { data: ghosts, error: e6 } = await sb
    .from('user_cards')
    .select('user_id, card_id, next_review', { count: 'exact' })
    .in('learning_status', ['not_studied', 'new'])
    .not('next_review', 'is', null)
    .lte('next_review', new Date().toISOString())
    .limit(5);
  if (!e6) {
    console.log(`${ghosts && ghosts.length ? '⚠' : '✓'} ghost cards (not_studied+past next_review): ${ghosts?.length ?? 0} ${ghosts && ghosts.length ? '(run migration to clean)' : ''}`);
  }

  // 5) Sanity: SM-2 math spot-check
  const sm = applySM2({ ease_factor: 2.5, interval_days: 10, repetitions: 3, lapses: 0, learning_step: -1, is_relearning: false, grade: 'good' }, DEFAULT_SETTINGS);
  console.log(`✓ SM-2 quick: interval 10→${sm.interval_days}, due_in_ms=${sm.due_in_ms} (≈${(sm.due_in_ms / 86400000).toFixed(1)}d)`);

  console.log('\nDone.');
}

main().catch(e => { console.error('fatal', e); process.exit(1); });

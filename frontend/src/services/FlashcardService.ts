import { supabase } from '../lib/supabase';
import { applySM2, DEFAULT_SETTINGS, Grade, AlgorithmSettings, previewAllGrades } from './sm2';
import { FolderSettingsSvc } from './FolderSettingsService';

export type CardSource =
  | { kind: 'question'; question_id: string }
  | { kind: 'note'; note_id: string; block_id?: string }
  | { kind: 'manual' };

export interface NewCardInput {
  front_text: string;
  back_text: string;
  front_image_url?: string | null;
  back_image_url?: string | null;
  subject?: string;
  section_group?: string;
  microtopic?: string;
  card_type?: 'qa' | 'note_block' | 'manual';
  source?: CardSource;
  question_id?: string | null;
  test_id?: string | null;
}

export interface CardState {
  status: 'active' | 'frozen' | 'deleted' | 'new' | string;
  learning_status: 'not_studied' | 'learning' | 'review' | 'mastered' | 'leech' | string;
  next_review?: string | null;
  last_reviewed?: string | null;
  user_note?: string | null;
  repetitions?: number;
  interval_days?: number;
  ease_factor?: number;
  lapses?: number;
  last_quality?: number | null;
  learning_step?: number | null;
  is_relearning?: boolean | null;
}

export interface StudyQueueFolder {
  subject?: string;
  section?: string;
  microtopic?: string;
  /** AnkiPro-style: study this branch and (optionally) its entire subtree. */
  branch_id?: string;
  /** If true, recursively include all descendant branch cards. */
  recursive?: boolean;
}

/** Row shape returned by `getStudyQueue`. */
export interface QueueCard {
  /** cards.id */
  id: string;
  front_text: string;
  back_text: string;
  front_image_url?: string | null;
  back_image_url?: string | null;
  subject: string;
  section_group: string;
  microtopic: string;
  card_type: string;
  source: any;
  correct_answer?: string | null;
  /** user_cards fields (merged) */
  state: CardState;
  /** 'learning' (overdue from learning queue) | 'review' (mature due) | 'new' (introduced today) */
  queue: 'learning' | 'review' | 'new';
}

export class FlashcardSvc {
  // ============ READS ============
  static async getSubjects(userId: string) {
    const { data, error } = await supabase
      .from('user_cards').select('cards(subject)').eq('user_id', userId);
    if (error) throw error;
    return Array.from(new Set((data ?? []).map((d: any) => d.cards?.subject).filter(Boolean))).sort();
  }

  static async getDecks(userId: string, subject: string) {
    const { data, error } = await supabase
      .from('user_cards').select('cards(section_group, microtopic)')
      .eq('user_id', userId).eq('cards.subject', subject);
    if (error) throw error;
    const decks: Record<string, string[]> = {};
    (data ?? []).forEach((d: any) => {
      const sg = d.cards?.section_group || 'General';
      const mt = d.cards?.microtopic || 'General';
      if (!decks[sg]) decks[sg] = [];
      if (!decks[sg].includes(mt)) decks[sg].push(mt);
    });
    return decks;
  }

  static async getCards(userId: string, subject: string, section: string, microtopic: string) {
    const { data, error } = await supabase
      .from('user_cards').select('*, cards!inner(*)')
      .eq('user_id', userId).eq('cards.subject', subject)
      .eq('cards.section_group', section).eq('cards.microtopic', microtopic);
    if (error) throw error;
    return (data ?? []).map((d: any) => ({ ...d.cards, ...d, id: d.card_id }));
  }

  /**
   * Build the study queue for a folder, respecting daily caps and DUE logic.
   *
   * Queue order:
   *   1. Learning-queue cards whose next_review <= now  (overdue learning steps)
   *   2. Review-queue cards whose next_review <= now    (mature cards due today)
   *   3. NEW (not_studied) cards — up to `new_cards_per_day` cap
   *
   * Excludes: frozen, deleted, future-dated cards.
   */
  static async getStudyQueue(userId: string, folder: StudyQueueFolder = {}, opts: { limit?: number } = {}): Promise<QueueCard[]> {
    const settings = await FolderSettingsSvc.resolve(userId, folder.subject, folder.section, folder.microtopic);
    const nowIso = new Date().toISOString();

    // AnkiPro branch mode: resolve card_ids via flashcard_branch_cards (possibly recursive).
    let branchCardIds: string[] | null = null;
    if (folder.branch_id) {
      // Lazy import to avoid circular dep
      const { BranchSvc } = await import('./BranchService');
      branchCardIds = await BranchSvc.listCardIdsInBranch(folder.branch_id, { recursive: !!folder.recursive, userId });
      if (branchCardIds.length === 0) return [];
    }

    // Base card filter (join cards!inner and filter there)
    let base = supabase
      .from('user_cards')
      .select('*, cards!inner(id, subject, section_group, microtopic, front_text, back_text, question_text, answer_text, front_image_url, back_image_url, card_type, source, correct_answer)')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (branchCardIds) base = base.in('card_id', branchCardIds);
    if (folder.subject) base = base.eq('cards.subject', folder.subject);
    if (folder.section && folder.section !== 'General') base = base.eq('cards.section_group', folder.section);
    if (folder.microtopic) base = base.eq('cards.microtopic', folder.microtopic);

    const { data, error } = await base;
    if (error) throw error;

    const mapped: QueueCard[] = (data ?? []).map((d: any) => {
      const c = d.cards;
      return {
        id: c.id,
        front_text: c.front_text || c.question_text || '',
        back_text: c.back_text || c.answer_text || '',
        front_image_url: c.front_image_url,
        back_image_url: c.back_image_url,
        subject: c.subject,
        section_group: c.section_group,
        microtopic: c.microtopic,
        card_type: c.card_type || 'qa',
        source: c.source || {},
        correct_answer: c.correct_answer,
        state: {
          status: d.status,
          learning_status: d.learning_status,
          next_review: d.next_review,
          last_reviewed: d.last_reviewed,
          user_note: d.user_note,
          repetitions: d.repetitions ?? 0,
          interval_days: d.interval_days ?? 0,
          ease_factor: d.ease_factor ?? settings.starting_ease,
          lapses: d.lapses ?? 0,
          last_quality: d.last_quality ?? null,
          learning_step: d.learning_step ?? null,
          is_relearning: d.is_relearning ?? false,
        },
        queue: 'new',
      };
    });

    const learning: QueueCard[] = [];
    const review: QueueCard[] = [];
    const fresh: QueueCard[] = [];

    mapped.forEach(c => {
      const nr = c.state.next_review ? new Date(c.state.next_review).getTime() : null;
      const isDue = nr !== null && nr <= Date.now();
      const ls = c.state.learning_status;

      if (ls === 'not_studied' || ls === 'new') {
        fresh.push({ ...c, queue: 'new' });
      } else if (isDue) {
        const inLearning = ls === 'learning' || ls === 'leech' || (c.state.learning_step ?? -1) >= 0;
        if (inLearning) learning.push({ ...c, queue: 'learning' });
        else review.push({ ...c, queue: 'review' });
      }
      // else: scheduled in the future — not in queue.
    });

    // Respect caps
    const reviewCap = Math.max(0, settings.max_reviews_per_day);
    const newCap = await this.remainingNewCapForToday(userId, folder, settings);
    const cappedReview = review
      .sort((a, b) => new Date(a.state.next_review!).getTime() - new Date(b.state.next_review!).getTime())
      .slice(0, reviewCap);
    const cappedNew = fresh.slice(0, newCap);

    // Order: learning first (earliest overdue), then review, then new
    learning.sort((a, b) => new Date(a.state.next_review!).getTime() - new Date(b.state.next_review!).getTime());

    const finalQueue = [...learning, ...cappedReview, ...cappedNew];
    if (opts.limit) return finalQueue.slice(0, opts.limit);
    return finalQueue;
  }

  /** Summary counts (stats panel on microtopic.tsx, matching screenshot's "1 card for today / 0 new / 1 learning / 0 mastered"). */
  static async getFolderStats(userId: string, folder: StudyQueueFolder = {}) {
    const settings = await FolderSettingsSvc.resolve(userId, folder.subject, folder.section, folder.microtopic);

    // AnkiPro branch mode
    let branchCardIds: string[] | null = null;
    if (folder.branch_id) {
      const { BranchSvc } = await import('./BranchService');
      branchCardIds = await BranchSvc.listCardIdsInBranch(folder.branch_id, { recursive: !!folder.recursive, userId });
      if (branchCardIds.length === 0) {
        return { for_today: 0, not_studied: 0, learning: 0, mastered: 0, review_due: 0, learning_due: 0, frozen: 0, total: 0 };
      }
    }

    let q = supabase
      .from('user_cards')
      .select('status, learning_status, next_review, cards!inner(subject, section_group, microtopic)')
      .eq('user_id', userId);
    if (branchCardIds) q = q.in('card_id', branchCardIds);
    if (folder.subject) q = q.eq('cards.subject', folder.subject);
    if (folder.section && folder.section !== 'General') q = q.eq('cards.section_group', folder.section);
    if (folder.microtopic) q = q.eq('cards.microtopic', folder.microtopic);
    const { data, error } = await q;
    if (error) throw error;

    const now = Date.now();
    const active = (data ?? []).filter((r: any) => r.status === 'active');

    const not_studied = active.filter((r: any) => r.learning_status === 'not_studied' || r.learning_status === 'new').length;
    const learning = active.filter((r: any) => r.learning_status === 'learning' || r.learning_status === 'leech').length;
    const mastered = active.filter((r: any) => r.learning_status === 'mastered').length;
    const review_due = active.filter((r: any) =>
      (r.learning_status === 'review') && r.next_review && new Date(r.next_review).getTime() <= now
    ).length;
    const learning_due = active.filter((r: any) =>
      (r.learning_status === 'learning' || r.learning_status === 'leech') &&
      r.next_review && new Date(r.next_review).getTime() <= now
    ).length;

    const newToday = Math.min(not_studied, await this.remainingNewCapForToday(userId, folder, settings));
    const for_today = learning_due + review_due + newToday;
    const frozen = (data ?? []).filter((r: any) => r.status === 'frozen').length;
    const total = active.length;

    return {
      for_today,        // the big number in hero
      not_studied,      // "New"
      learning,         // "Learning" pill count (total, not just due)
      mastered,
      review_due,
      learning_due,
      frozen,
      total,
    };
  }

  /** How many new cards can still be introduced today, given the folder's daily cap. */
  static async remainingNewCapForToday(
    userId: string, folder: StudyQueueFolder, settings: AlgorithmSettings
  ): Promise<number> {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    // A card is "introduced today" if last_reviewed is today AND it was previously not_studied.
    // Approx: count card_reviews where prev_interval=0 AND reviewed_at >= today.
    let q = supabase
      .from('card_reviews')
      .select('id, card_id, cards!inner(subject, section_group, microtopic)', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('prev_interval', 0)
      .gte('reviewed_at', startOfDay.toISOString());
    if (folder.subject) q = q.eq('cards.subject', folder.subject);
    if (folder.section && folder.section !== 'General') q = q.eq('cards.section_group', folder.section);
    if (folder.microtopic) q = q.eq('cards.microtopic', folder.microtopic);

    const { count, error } = await q;
    if (error) {
      // Non-fatal — fall back to full cap
      return settings.new_cards_per_day;
    }
    return Math.max(0, settings.new_cards_per_day - (count ?? 0));
  }

  // ============ CREATE ============
  static async createCard(userId: string, input: NewCardInput) {
    if (!input.front_text?.trim()) throw new Error('Front text required');
    if (!input.back_text?.trim()) throw new Error('Back text required');

    let card: { id: string } | null = null;
    if (input.question_id) {
      const { data } = await supabase.from('cards').select('id').eq('question_id', input.question_id).maybeSingle();
      if (data) card = data;
    }

    if (!card) {
      const { data, error } = await supabase
        .from('cards')
        .insert({
          question_id: input.question_id || `manual_${Date.now()}`,
          subject: input.subject || 'General',
          section_group: input.section_group || 'General',
          microtopic: input.microtopic || 'General',
          front_text: input.front_text,
          back_text: input.back_text,
          front_image_url: input.front_image_url || null,
          back_image_url: input.back_image_url || null,
          card_type: input.card_type || 'manual',
          source: input.source || {},
          test_id: input.test_id || 'manual',
          // legacy fields kept for backward compat:
          question_text: input.front_text,
          answer_text: input.back_text,
        })
        .select('id').single();
      if (error) throw error;
      card = data;
    }

    // Link in user_cards (idempotent).
    // NOTE: `user_cards.next_review` is NOT NULL in production schema,
    // so initialize with "now" for not_studied cards.
    const { data: existing } = await supabase
      .from('user_cards').select('id').eq('user_id', userId).eq('card_id', card!.id).maybeSingle();
    if (!existing) {
      const { error } = await supabase.from('user_cards').insert({
        user_id: userId, card_id: card!.id,
        ease_factor: DEFAULT_SETTINGS.starting_ease,
        interval_days: 0, repetitions: 0, lapses: 0,
        next_review: new Date().toISOString(),
        status: 'active',
        learning_status: 'not_studied',
        learning_step: 0,
        is_relearning: false,
      });
      if (error) throw error;
    }

    return card!.id;
  }

  static async createFromQuestion(userId: string, q: any) {
    const opts = q.options ?? {};
    const front_text = `${q.question_text || q.questionText || ''}`.trim();

    const correctKey = q.correct_answer || q.correctAnswer;
    const correctText = correctKey && opts[correctKey] ? `**Correct: (${correctKey.toUpperCase()})** ${opts[correctKey]}` : '';
    const explanation = q.explanation_markdown || q.explanation || '';
    const back_text = [correctText, explanation].filter(Boolean).join('\n\n');

    return this.createCard(userId, {
      front_text, back_text,
      subject: q.subject || 'General',
      section_group: q.section_group || 'General',
      microtopic: q.micro_topic || q.microtopic || 'General',
      card_type: 'qa',
      question_id: q.id,
      test_id: q.test_id || q.testId || q.tests?.id || 'manual',
      source: { kind: 'question', question_id: q.id, options: opts, correct_answer: correctKey } as any,
    });
  }

  /** @deprecated use createFromQuestion */
  static async createFlashcardFromQuestion(userId: string, q: any) {
    return this.createFromQuestion(userId, q);
  }

  static async createFromNoteBlock(userId: string, params: {
    note_id: string; block_id?: string;
    front_text: string; back_text: string;
    subject?: string; section_group?: string; microtopic?: string;
    front_image_url?: string | null; back_image_url?: string | null;
  }) {
    return this.createCard(userId, {
      front_text: params.front_text, back_text: params.back_text,
      subject: params.subject, section_group: params.section_group, microtopic: params.microtopic,
      card_type: 'note_block',
      front_image_url: params.front_image_url, back_image_url: params.back_image_url,
      source: { kind: 'note', note_id: params.note_id, block_id: params.block_id },
    });
  }

  // ============ EDIT / DELETE ============
  static async updateCard(cardId: string, patch: Partial<NewCardInput>) {
    const updateData: any = { ...patch, updated_at: new Date().toISOString() };
    if (patch.front_text) updateData.question_text = patch.front_text;
    if (patch.back_text) updateData.answer_text = patch.back_text;
    const { error } = await supabase.from('cards').update(updateData).eq('id', cardId);
    if (error) throw error;
  }

  static async deleteCardForUser(userId: string, cardId: string) {
    const { error } = await supabase.from('user_cards').delete().eq('user_id', userId).eq('card_id', cardId);
    if (error) throw error;
  }

  // ============ REVIEW ============
  /**
   * Main review method. `grade` is 'again'|'hard'|'good'|'easy' (Noji 4-button).
   * Settings are resolved from the card's folder hierarchy.
   */
  static async reviewCard(userId: string, cardId: string, grade: Grade) {
    // 1) Load user_card + card folder
    const { data: cur, error } = await supabase
      .from('user_cards')
      .select('*, cards!inner(subject, section_group, microtopic)')
      .eq('user_id', userId).eq('card_id', cardId).single();
    if (error) throw error;

    const card = (cur as any).cards;
    const settings = await FolderSettingsSvc.resolve(
      userId, card.subject, card.section_group, card.microtopic
    );

    // 2) Apply SM-2 with folder settings
    const sm = applySM2({
      ease_factor: Number(cur.ease_factor ?? settings.starting_ease),
      interval_days: Number(cur.interval_days ?? 0),
      repetitions: Number(cur.repetitions ?? 0),
      lapses: Number(cur.lapses ?? 0),
      learning_step: Number(cur.learning_step ?? ((cur.repetitions ?? 0) > 0 ? -1 : 0)),
      is_relearning: Boolean(cur.is_relearning ?? false),
      grade,
    }, settings);

    const next_review = new Date(Date.now() + sm.due_in_ms).toISOString();
    const quality = gradeToQuality(grade);
    const nowIso = new Date().toISOString();

    // Interval in minutes (for sub-day learning-step precision; schema supports this)
    const interval_minutes = sm.due_in_ms > 0 && sm.due_in_ms < 24 * 60 * 60 * 1000
      ? Math.max(1, Math.round(sm.due_in_ms / 60000))
      : 0;

    // 3) Offline-first: write to LocalStore first (synchronous, 0-ms), then sync to Supabase.
    //    If the server write fails (offline), LocalStore keeps it in the dirty queue.
    const { LocalStore } = await import('../lib/localStore');
    LocalStore.commitReview({
      user_id: userId,
      card_id: cardId,
      status: 'active',
      learning_status: sm.learning_status as any,
      repetitions: sm.repetitions,
      interval_days: sm.interval_days,
      interval_minutes,
      ease_factor: sm.ease_factor,
      lapses: sm.lapses,
      learning_step: sm.learning_step,
      is_relearning: sm.is_relearning,
      next_review,
      last_reviewed: nowIso,
      last_quality: quality,
      again_count: (cur.again_count ?? 0) + (grade === 'again' ? 1 : 0),
    });

    // 4) Server write — best-effort. On failure the row stays in LocalStore's dirty queue.
    const { error: upErr } = await supabase.from('user_cards').update({
      ease_factor: sm.ease_factor,
      interval_days: sm.interval_days,
      interval_minutes,
      repetitions: sm.repetitions,
      lapses: sm.lapses,
      learning_step: sm.learning_step,
      is_relearning: sm.is_relearning,
      learning_status: sm.learning_status,
      next_review,
      last_reviewed: nowIso,
      last_quality: quality,
      again_count: (cur.again_count ?? 0) + (grade === 'again' ? 1 : 0),
      times_seen: (cur.times_seen ?? 0) + 1,
      client_updated_at: nowIso,
      dirty: false,
      updated_at: nowIso,
    }).eq('user_id', userId).eq('card_id', cardId);
    if (upErr) console.warn('[FlashcardSvc] server write deferred:', upErr.message);

    // 5) Audit log — also best-effort
    await supabase.from('card_reviews').insert({
      user_id: userId, card_id: cardId,
      quality,
      rating: grade,
      learning_step: sm.learning_step,
      prev_interval: cur.interval_days ?? 0,
      new_interval: sm.interval_days,
      prev_minutes: cur.interval_minutes ?? 0,
      new_minutes: interval_minutes,
      prev_ef: cur.ease_factor ?? settings.starting_ease,
      new_ef: sm.ease_factor,
    }).then(() => {}, (e) => console.warn('[FlashcardSvc] card_reviews insert deferred:', e?.message));

    return { ...sm, next_review };
  }

  /** Live preview of what each button will do for the current card. */
  static async previewCard(userId: string, cardId: string): Promise<Record<Grade, { due_in_ms: number; label: string }>> {
    const { data: cur, error } = await supabase
      .from('user_cards')
      .select('*, cards!inner(subject, section_group, microtopic)')
      .eq('user_id', userId).eq('card_id', cardId).single();
    if (error) throw error;
    const card = (cur as any).cards;
    const settings = await FolderSettingsSvc.resolve(userId, card.subject, card.section_group, card.microtopic);
    return previewAllGrades({
      ease_factor: Number(cur.ease_factor ?? settings.starting_ease),
      interval_days: Number(cur.interval_days ?? 0),
      repetitions: Number(cur.repetitions ?? 0),
      lapses: Number(cur.lapses ?? 0),
      learning_step: Number(cur.learning_step ?? ((cur.repetitions ?? 0) > 0 ? -1 : 0)),
      is_relearning: Boolean(cur.is_relearning ?? false),
    }, settings);
  }

  // ============ MENU ACTION HELPERS ============
  private static async ensureUserHasCard(userId: string, cardId: string) {
    const { data, error } = await supabase
      .from('user_cards')
      .select('id, user_id, card_id, status')
      .eq('user_id', userId).eq('card_id', cardId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Card not found for this user');
    return data;
  }

  private static async getCard(cardId: string) {
    const { data, error } = await supabase.from('cards').select('*').eq('id', cardId).single();
    if (error) throw error;
    return data;
  }

  private static async ensureEditableCardForUser(userId: string, cardId: string): Promise<string> {
    await this.ensureUserHasCard(userId, cardId);
    const card = await this.getCard(cardId);
    const isManual = card.card_type === 'manual' || String(card.question_id || '').startsWith('manual_');
    if (isManual) return cardId;

    const now = new Date().toISOString();
    const { data: clone, error: cloneErr } = await supabase
      .from('cards')
      .insert({
        question_id: `manual_copy_${Date.now()}`,
        test_id: 'manual',
        question_text: card.front_text || card.question_text || '',
        answer_text: card.back_text || card.answer_text || '',
        front_text: card.front_text || card.question_text || '',
        back_text: card.back_text || card.answer_text || '',
        front_image_url: card.front_image_url || null,
        back_image_url: card.back_image_url || null,
        subject: card.subject || 'General',
        section_group: card.section_group || 'General',
        microtopic: card.microtopic || 'General',
        provider: 'User',
        card_type: 'manual',
        source: { ...(card.source || {}), cloned_from: card.id, cloned_at: now },
        explanation_markdown: card.explanation_markdown || card.back_text || card.answer_text || '',
      })
      .select('id').single();
    if (cloneErr) throw cloneErr;

    const { error: linkErr } = await supabase
      .from('user_cards')
      .update({ card_id: clone.id, updated_at: now })
      .eq('user_id', userId).eq('card_id', cardId);
    if (linkErr) throw linkErr;
    return clone.id as string;
  }

  static async saveNote(userId: string, cardId: string, note: string) {
    await this.ensureUserHasCard(userId, cardId);
    const { error } = await supabase
      .from('user_cards')
      .update({ user_note: note ?? '', updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('card_id', cardId);
    if (error) throw error;
  }

  static async freezeCard(userId: string, cardId: string) {
    await this.ensureUserHasCard(userId, cardId);
    const { error } = await supabase
      .from('user_cards')
      .update({ status: 'frozen', updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('card_id', cardId);
    if (error) throw error;
  }
  static async unfreezeCard(userId: string, cardId: string) {
    await this.ensureUserHasCard(userId, cardId);
    const { error } = await supabase
      .from('user_cards')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('card_id', cardId);
    if (error) throw error;
  }
  static async toggleFreeze(userId: string, cardId: string, currentStatus: string) {
    if (currentStatus === 'frozen') return this.unfreezeCard(userId, cardId);
    return this.freezeCard(userId, cardId);
  }

  static async updateCardForUser(userId: string, cardId: string, patch: Partial<NewCardInput>) {
    const editableCardId = await this.ensureEditableCardForUser(userId, cardId);
    await this.updateCard(editableCardId, patch);
    return editableCardId;
  }

  static async reverseCardForUser(userId: string, cardId: string) {
    const editableCardId = await this.ensureEditableCardForUser(userId, cardId);
    const card = await this.getCard(editableCardId);
    const front = card.front_text || card.question_text || '';
    const back  = card.back_text  || card.answer_text  || '';
    const frontImg = card.front_image_url || null;
    const backImg  = card.back_image_url || null;
    const { error } = await supabase.from('cards').update({
      front_text: back, back_text: front,
      question_text: back, answer_text: front,
      front_image_url: backImg, back_image_url: frontImg,
      updated_at: new Date().toISOString(),
    }).eq('id', editableCardId);
    if (error) throw error;
    return editableCardId;
  }

  static async duplicateCardForUser(userId: string, cardId: string) {
    await this.ensureUserHasCard(userId, cardId);
    const card = await this.getCard(cardId);
    const { data: newCard, error: cardErr } = await supabase
      .from('cards')
      .insert({
        question_id: `manual_dup_${Date.now()}`,
        test_id: 'manual',
        question_text: card.front_text || card.question_text || '',
        answer_text: card.back_text || card.answer_text || '',
        front_text: card.front_text || card.question_text || '',
        back_text: card.back_text || card.answer_text || '',
        front_image_url: card.front_image_url || null,
        back_image_url: card.back_image_url || null,
        subject: card.subject || 'General',
        section_group: card.section_group || 'General',
        microtopic: card.microtopic || 'General',
        provider: 'User', card_type: 'manual',
        source: { ...(card.source || {}), duplicated_from: card.id },
        explanation_markdown: card.explanation_markdown || '',
      })
      .select('id').single();
    if (cardErr) throw cardErr;

    const { error: userCardErr } = await supabase
      .from('user_cards')
      .insert({
        user_id: userId, card_id: newCard.id,
        status: 'active', learning_status: 'not_studied',
        repetitions: 0, interval_days: 0,
        ease_factor: DEFAULT_SETTINGS.starting_ease,
        next_review: new Date().toISOString(),
        learning_step: 0, is_relearning: false,
        user_note: '',
      });
    if (userCardErr) throw userCardErr;
    return newCard.id as string;
  }

  static async moveCardForUser(
    userId: string, cardId: string,
    target: { subject: string; section_group: string; microtopic: string }
  ) {
    const editableCardId = await this.ensureEditableCardForUser(userId, cardId);
    const { error } = await supabase.from('cards').update({
      subject: target.subject.trim(),
      section_group: target.section_group.trim(),
      microtopic: target.microtopic.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', editableCardId);
    if (error) throw error;
    return editableCardId;
  }

  static async softDeleteCardForUser(userId: string, cardId: string) {
    await this.ensureUserHasCard(userId, cardId);
    const { error } = await supabase
      .from('user_cards')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('card_id', cardId);
    if (error) throw error;
  }
  static async restoreDeletedCardForUser(userId: string, cardId: string) {
    const { error } = await supabase
      .from('user_cards')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('card_id', cardId).eq('status', 'deleted');
    if (error) throw error;
  }

  static async getLearningHistory(userId: string, cardId: string, limit = 30, offset = 0) {
    const to = offset + limit - 1;
    const { data, error } = await supabase
      .from('card_reviews')
      .select('id, reviewed_at, quality, prev_interval, new_interval, prev_ef, new_ef')
      .eq('user_id', userId).eq('card_id', cardId)
      .order('reviewed_at', { ascending: false })
      .range(offset, to);
    if (error) throw error;
    return data || [];
  }

  /** @deprecated  Legacy call-sites passing 0..5 quality. Routes to `reviewCard`. */
  static async updateCardProgress(userId: string, cardId: string, performance: number) {
    const grade: Grade =
      performance < 3 ? 'again' :
      performance === 3 ? 'hard' :
      performance === 4 ? 'good' : 'easy';
    return this.reviewCard(userId, cardId, grade);
  }
}

function gradeToQuality(g: Grade): number {
  return g === 'again' ? 0 : g === 'hard' ? 3 : g === 'good' ? 4 : 5;
}

/**
 * SM-2 Spaced-Repetition Engine — Noji / Anki style (config-driven).
 *
 * Grade buttons (4-button UI):
 *   'again' → lapse: reset to learning queue, next due = learning_steps[0] minutes
 *   'hard'  → interval *= hard_interval_factor (default 1.2), ease -= 0.15
 *   'good'  → graduates to graduating_interval on first pass, then interval *= ease
 *   'easy'  → graduates to easy_interval on first pass, then interval *= ease * easy_bonus
 *
 * All intervals honour real time:
 *   - learning_steps are in MINUTES (e.g. [1, 10])
 *   - graduating_interval / easy_interval / mature intervals are in DAYS
 *   - next_review is ALWAYS `now + delta` — no rounding that leaks into "today"
 */

export type Grade = 'again' | 'hard' | 'good' | 'easy';

export interface AlgorithmSettings {
  learning_steps: number[];        // minutes
  relearning_steps: number[];      // minutes
  graduating_interval: number;     // days
  easy_interval: number;           // days
  starting_ease: number;
  minimum_ease: number;
  hard_interval_factor: number;
  easy_bonus: number;
  lapse_new_interval_factor: number; // 0..1 of prior interval kept after lapse (0 = reset)
  leech_threshold: number;
  maximum_interval: number;        // days
  mastered_threshold: number;      // days
  new_cards_per_day: number;
  max_reviews_per_day: number;
}

export const DEFAULT_SETTINGS: AlgorithmSettings = {
  learning_steps: [1, 10],
  relearning_steps: [10],
  graduating_interval: 4,
  easy_interval: 7,
  starting_ease: 2.5,
  minimum_ease: 1.3,
  hard_interval_factor: 1.2,
  easy_bonus: 1.3,
  lapse_new_interval_factor: 0.0,
  leech_threshold: 8,
  maximum_interval: 365,
  mastered_threshold: 60,
  new_cards_per_day: 20,
  max_reviews_per_day: 200,
};

export interface SM2Input {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  learning_step: number;    // -1 = past learning (in review queue); else index into steps
  is_relearning: boolean;
  grade: Grade;
}

export interface SM2Output {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  learning_step: number;
  is_relearning: boolean;
  due_in_ms: number;
  learning_status: 'learning' | 'review' | 'mastered' | 'leech';
  lapsed: boolean;
}

const MIN = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function applySM2(input: SM2Input, s: AlgorithmSettings = DEFAULT_SETTINGS): SM2Output {
  let {
    ease_factor, interval_days, repetitions, lapses,
    learning_step, is_relearning, grade,
  } = input;

  if (!Number.isFinite(ease_factor) || ease_factor <= 0) ease_factor = s.starting_ease;
  ease_factor = Math.max(ease_factor, s.minimum_ease);
  interval_days = Math.max(0, Math.floor(interval_days || 0));
  repetitions = Math.max(0, Math.floor(repetitions || 0));
  lapses = Math.max(0, Math.floor(lapses || 0));
  if (!Number.isFinite(learning_step)) learning_step = repetitions > 0 ? -1 : 0;

  const inLearningQueue = learning_step >= 0;
  let due_in_ms = 0;
  let lapsed = false;
  let status: SM2Output['learning_status'] = 'learning';

  if (grade === 'again') {
    if (inLearningQueue) {
      learning_step = 0;
      const steps = is_relearning ? s.relearning_steps : s.learning_steps;
      due_in_ms = (steps[0] ?? 1) * MIN;
    } else {
      lapses += 1;
      lapsed = true;
      is_relearning = true;
      learning_step = 0;
      interval_days = Math.max(1, Math.round(interval_days * s.lapse_new_interval_factor));
      repetitions = 0;
      ease_factor = Math.max(s.minimum_ease, ease_factor - 0.2);
      due_in_ms = (s.relearning_steps[0] ?? 10) * MIN;
    }
    status = 'learning';
  } else if (grade === 'hard') {
    if (inLearningQueue) {
      const steps = is_relearning ? s.relearning_steps : s.learning_steps;
      due_in_ms = (steps[learning_step] ?? 1) * MIN;
    } else {
      interval_days = clamp(
        Math.max(interval_days + 1, Math.round(interval_days * s.hard_interval_factor)),
        1, s.maximum_interval
      );
      repetitions += 1;
      ease_factor = Math.max(s.minimum_ease, ease_factor - 0.15);
      due_in_ms = interval_days * DAY;
    }
    status = inLearningQueue ? 'learning' : 'review';
  } else if (grade === 'good') {
    if (inLearningQueue) {
      const steps = is_relearning ? s.relearning_steps : s.learning_steps;
      const nextStep = learning_step + 1;
      if (nextStep >= steps.length) {
        learning_step = -1;
        is_relearning = false;
        if (interval_days === 0) interval_days = Math.max(1, s.graduating_interval);
        else interval_days = Math.max(interval_days, s.graduating_interval);
        repetitions = Math.max(1, repetitions + 1);
        due_in_ms = interval_days * DAY;
        status = 'review';
      } else {
        learning_step = nextStep;
        due_in_ms = (steps[nextStep] ?? 10) * MIN;
        status = 'learning';
      }
    } else {
      interval_days = clamp(Math.round(interval_days * ease_factor), 1, s.maximum_interval);
      repetitions += 1;
      due_in_ms = interval_days * DAY;
      status = 'review';
    }
  } else {
    // easy
    if (inLearningQueue) {
      learning_step = -1;
      is_relearning = false;
      interval_days = Math.max(s.easy_interval, s.graduating_interval + 1);
      interval_days = Math.min(interval_days, s.maximum_interval);
      repetitions = Math.max(1, repetitions + 1);
      ease_factor += 0.15;
    } else {
      interval_days = clamp(
        Math.round(interval_days * ease_factor * s.easy_bonus),
        1, s.maximum_interval
      );
      repetitions += 1;
      ease_factor += 0.15;
    }
    due_in_ms = interval_days * DAY;
    status = 'review';
  }

  if (interval_days >= s.mastered_threshold && learning_step < 0) status = 'mastered';
  if (lapses >= s.leech_threshold) status = 'leech';

  ease_factor = Math.max(s.minimum_ease, Math.min(3.5, Math.round(ease_factor * 100) / 100));

  return {
    ease_factor, interval_days, repetitions, lapses,
    learning_step, is_relearning, due_in_ms,
    learning_status: status, lapsed,
  };
}

export function dueDateFromNow(due_in_ms: number): string {
  return new Date(Date.now() + due_in_ms).toISOString();
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return 'now';
  const mins = ms / MIN;
  if (mins < 60) return `${Math.max(1, Math.round(mins))}m`;
  const hours = mins / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d`;
  const months = days / 30;
  if (months < 12) return `${Math.round(months)}mo`;
  return `${Math.round(days / 365)}y`;
}

export function previewAllGrades(
  input: Omit<SM2Input, 'grade'>,
  s: AlgorithmSettings = DEFAULT_SETTINGS
): Record<Grade, { due_in_ms: number; label: string }> {
  const grades: Grade[] = ['again', 'hard', 'good', 'easy'];
  const out = {} as Record<Grade, { due_in_ms: number; label: string }>;
  for (const g of grades) {
    const r = applySM2({ ...input, grade: g }, s);
    out[g] = { due_in_ms: r.due_in_ms, label: formatDuration(r.due_in_ms) };
  }
  return out;
}

/**
 * @deprecated Back-compat wrapper for legacy quality 0..5 callers.
 * Maps 0..2 → again, 3 → hard, 4 → good, 5 → easy.
 */
export function applySM2ByQuality(
  input: { ease_factor: number; interval_days: number; repetitions: number; quality: number },
  lapses = 0
): SM2Output {
  const grade: Grade =
    input.quality < 3 ? 'again' :
    input.quality === 3 ? 'hard' :
    input.quality === 4 ? 'good' : 'easy';
  return applySM2({
    ease_factor: input.ease_factor,
    interval_days: input.interval_days,
    repetitions: input.repetitions,
    lapses,
    learning_step: input.repetitions > 0 ? -1 : 0,
    is_relearning: false,
    grade,
  });
}

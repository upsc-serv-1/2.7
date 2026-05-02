/**
 * SM-2 engine self-test suite.
 *
 * Run with:   npx tsx src/services/__tests__/sm2.test.ts
 * (no Jest needed — tiny runner below prints PASS / FAIL)
 *
 * These tests pin down the EXACT behaviour the user complained about:
 *   - "4 days" actually means 4 × 24h
 *   - Cards due tomorrow never leak into "today"
 *   - Learning → review graduates to the configured interval
 *   - Lapses push a card back to the learning queue, not the review queue
 *   - Leech threshold flips learning_status to 'leech'
 */

import { applySM2, AlgorithmSettings, DEFAULT_SETTINGS, previewAllGrades, SM2Input, formatDuration } from '../sm2';

const MIN = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

let passed = 0, failed = 0;
const results: { name: string; ok: boolean; msg?: string }[] = [];

function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, ok: true }); passed += 1; }
  catch (e: any) { results.push({ name, ok: false, msg: e?.message }); failed += 1; }
}
function eq<T>(actual: T, expected: T, msg = 'values differ') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
function near(actual: number, expected: number, tol: number, msg = 'not near') {
  if (Math.abs(actual - expected) > tol) throw new Error(`${msg}: expected ≈${expected}, got ${actual}`);
}

const fresh = (overrides: Partial<SM2Input> = {}): SM2Input => ({
  ease_factor: 2.5, interval_days: 0, repetitions: 0, lapses: 0,
  learning_step: 0, is_relearning: false, grade: 'good', ...overrides,
});

// ============= TESTS =============

test('new card + Good → learning step 1 (10 min)', () => {
  const r = applySM2(fresh({ grade: 'good' }));
  eq(r.learning_step, 1);
  near(r.due_in_ms, 10 * MIN, 1);
  eq(r.learning_status, 'learning');
  eq(r.interval_days, 0);
});

test('after 2nd Good in learning queue → GRADUATES to 4 days (default graduating_interval)', () => {
  const step1 = applySM2(fresh({ grade: 'good' }));
  const r = applySM2({ ...fresh(), learning_step: step1.learning_step, grade: 'good' });
  eq(r.learning_step, -1, 'graduated');
  eq(r.interval_days, 4, 'graduates to 4 days');
  near(r.due_in_ms, 4 * DAY, 1);
  eq(r.learning_status, 'review');
});

test('"4 days" interval literally means +4 × 24h — not 3 or 5', () => {
  // Custom graduating_interval = 4 — graduate then verify exact due delay
  const s: AlgorithmSettings = { ...DEFAULT_SETTINGS, graduating_interval: 4, learning_steps: [1] };
  const step1 = applySM2(fresh({ grade: 'good' }), s);                   // graduates immediately (only 1 learning step)
  near(step1.due_in_ms, 4 * DAY, 1);
  eq(step1.interval_days, 4);
  eq(step1.learning_status, 'review');
});

test('Easy on a fresh card → graduates to easy_interval (7d default)', () => {
  const r = applySM2(fresh({ grade: 'easy' }));
  eq(r.learning_step, -1);
  eq(r.interval_days, 7);
  near(r.due_in_ms, 7 * DAY, 1);
});

test('Good from review queue → interval * ease (≈)', () => {
  const r = applySM2({ ease_factor: 2.5, interval_days: 10, repetitions: 2, lapses: 0, learning_step: -1, is_relearning: false, grade: 'good' });
  eq(r.interval_days, 25);
  near(r.due_in_ms, 25 * DAY, 1);
});

test('Hard from review queue → interval * 1.2 (min +1)', () => {
  const r = applySM2({ ease_factor: 2.5, interval_days: 10, repetitions: 5, lapses: 0, learning_step: -1, is_relearning: false, grade: 'hard' });
  eq(r.interval_days, 12);
});

test('Again from REVIEW queue → lapse, goes back to re-learning steps (10m)', () => {
  const r = applySM2({ ease_factor: 2.5, interval_days: 30, repetitions: 5, lapses: 2, learning_step: -1, is_relearning: false, grade: 'again' });
  eq(r.lapsed, true);
  eq(r.lapses, 3);
  eq(r.learning_step, 0);
  eq(r.is_relearning, true);
  near(r.due_in_ms, 10 * MIN, 1);
  eq(r.learning_status, 'learning');
});

test('Again in LEARNING queue → just resets to step 0 (no lapse count)', () => {
  const r = applySM2({ ease_factor: 2.5, interval_days: 0, repetitions: 0, lapses: 0, learning_step: 1, is_relearning: false, grade: 'again' });
  eq(r.lapses, 0);
  eq(r.learning_step, 0);
  near(r.due_in_ms, 1 * MIN, 1);
});

test('Reaching leech_threshold flips status to leech', () => {
  const s: AlgorithmSettings = { ...DEFAULT_SETTINGS, leech_threshold: 3 };
  const r = applySM2({ ease_factor: 2.0, interval_days: 5, repetitions: 2, lapses: 2, learning_step: -1, is_relearning: false, grade: 'again' }, s);
  eq(r.lapses, 3);
  eq(r.learning_status, 'leech');
});

test('mastered when interval >= mastered_threshold (default 60d)', () => {
  const r = applySM2({ ease_factor: 2.5, interval_days: 30, repetitions: 6, lapses: 0, learning_step: -1, is_relearning: false, grade: 'good' });
  // 30 * 2.5 = 75 ≥ 60 → mastered
  eq(r.learning_status, 'mastered');
});

test('maximum_interval clamps runaway intervals', () => {
  const s: AlgorithmSettings = { ...DEFAULT_SETTINGS, maximum_interval: 100 };
  const r = applySM2({ ease_factor: 3.0, interval_days: 80, repetitions: 10, lapses: 0, learning_step: -1, is_relearning: false, grade: 'easy' }, s);
  eq(r.interval_days, 100);
});

test('previewAllGrades gives a readable label for every button (no "NaN")', () => {
  const p = previewAllGrades({ ease_factor: 2.5, interval_days: 0, repetitions: 0, lapses: 0, learning_step: 0, is_relearning: false });
  for (const k of ['again', 'hard', 'good', 'easy'] as const) {
    if (!p[k]?.label || p[k].label.includes('NaN')) throw new Error(`Bad label for ${k}: ${p[k]?.label}`);
  }
  // Good on brand new card should read "10m" (learning step 1)
  eq(p.good.label, '10m');
  // Easy instant-graduates to 7d by default
  eq(p.easy.label, '7d');
});

test('formatDuration boundary cases', () => {
  eq(formatDuration(0), 'now');
  eq(formatDuration(30 * 1000), '1m');     // <1m rounds to 1m
  eq(formatDuration(30 * MIN), '30m');
  eq(formatDuration(2 * 60 * MIN), '2h');
  eq(formatDuration(3 * DAY), '3d');
  eq(formatDuration(45 * DAY), '2mo');
});

test('repeated Good-Good from new → first due in 10m, second due in 4 days', () => {
  // Step 1: first Good on brand-new card
  const a = applySM2({ ease_factor: 2.5, interval_days: 0, repetitions: 0, lapses: 0, learning_step: 0, is_relearning: false, grade: 'good' });
  near(a.due_in_ms, 10 * MIN, 1);
  // Step 2: second Good (now at learning_step 1) — graduates
  const b = applySM2({ ...a, grade: 'good' });
  near(b.due_in_ms, 4 * DAY, 1);
});

test('BUG REPRODUCTION: "studying 12 cards when only 10 are due" — each card progresses correctly so due count decreases', () => {
  // Simulate: card rated Good in learning → next_review = now + 10m (not today)
  // Card rated Good twice → graduates to +4d (tomorrow or later, NOT today)
  const after1st = applySM2({ ease_factor: 2.5, interval_days: 0, repetitions: 0, lapses: 0, learning_step: 0, is_relearning: false, grade: 'good' });
  const after2nd = applySM2({ ...after1st, grade: 'good' });
  if (after2nd.due_in_ms <= DAY) throw new Error(`Graduated card incorrectly due within 24h (due_in_ms=${after2nd.due_in_ms})`);
});

// ============= REPORT =============
console.log('\nSM-2 Self-Test Report');
console.log('─'.repeat(64));
for (const r of results) {
  const mark = r.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`${mark} ${r.name}`);
  if (!r.ok && r.msg) console.log(`    └─ ${r.msg}`);
}
console.log('─'.repeat(64));
console.log(`${passed} passed, ${failed} failed, ${results.length} total\n`);

if (failed > 0) process.exit(1);

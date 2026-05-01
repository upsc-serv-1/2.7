/**
 * LocalStore — AnkiPro / Noji-style hybrid offline-first engine.
 *
 * Strategy
 *   1. During study sessions, every review writes to MMKV synchronously (0 ms lag).
 *   2. A queue of "dirty" user_card updates is kept alongside.
 *   3. A background sync worker flushes the dirty queue to Supabase in batches.
 *   4. On app launch / network reconnect we also pull server-side changes since
 *      `last_server_sync` and apply server-newer rows locally (last-writer-wins
 *      using `client_updated_at` — already present on `user_cards`).
 *
 * Gracefully degrades: if MMKV isn't installed (Expo Go / web), we fall back to
 * AsyncStorage + in-memory map. Same interface, slightly slower.
 *
 * This is intentionally dependency-light so it works even if the user hasn't
 * added `react-native-mmkv` yet. Install it for full offline:
 *     yarn add react-native-mmkv
 * …and rebuild the native app (`npx expo prebuild`).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// --- MMKV (optional) ------------------------------------------------------
type KVBackend = {
  getString: (k: string) => string | null | undefined;
  set: (k: string, v: string) => void;
  delete: (k: string) => void;
  getAllKeys: () => string[];
};

let backend: KVBackend | null = null;

try {
  if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MMKV } = require('react-native-mmkv');
    const mmkv = new MMKV({ id: 'ankipro-study-cache' });
    backend = {
      getString: (k) => mmkv.getString(k) ?? null,
      set: (k, v) => mmkv.set(k, v),
      delete: (k) => mmkv.delete(k),
      getAllKeys: () => mmkv.getAllKeys(),
    };
  }
} catch {
  backend = null;
}

// --- Fallback backend (AsyncStorage + in-memory mirror) -------------------
const memCache = new Map<string, string>();
const asyncBackend: KVBackend = {
  getString: (k) => (memCache.has(k) ? memCache.get(k)! : null),
  set: (k, v) => { memCache.set(k, v); AsyncStorage.setItem(k, v).catch(() => {}); },
  delete: (k) => { memCache.delete(k); AsyncStorage.removeItem(k).catch(() => {}); },
  getAllKeys: () => Array.from(memCache.keys()),
};

// Preload AsyncStorage keys on module init (only used in fallback path)
if (!backend) {
  AsyncStorage.getAllKeys().then(keys => {
    const relevant = (keys as string[]).filter(k => k.startsWith(PREFIX));
    if (relevant.length === 0) return;
    return AsyncStorage.multiGet(relevant).then(pairs => {
      pairs.forEach(([k, v]) => { if (v !== null) memCache.set(k, v); });
    });
  }).catch(() => {});
}

const kv: KVBackend = backend ?? asyncBackend;

// --- Keys -----------------------------------------------------------------
const PREFIX = 'ap:';
const K_USER_CARD = (userId: string, cardId: string) => `${PREFIX}uc:${userId}:${cardId}`;
const K_DIRTY_QUEUE = (userId: string) => `${PREFIX}dirty:${userId}`;
const K_LAST_SYNC = (userId: string) => `${PREFIX}lastSync:${userId}`;

// --- Types ----------------------------------------------------------------
export interface LocalUserCard {
  user_id: string;
  card_id: string;
  status: 'active' | 'frozen' | 'deleted';
  learning_status: 'not_studied' | 'learning' | 'review' | 'mastered' | 'leech';
  repetitions: number;
  interval_days: number;
  interval_minutes: number;
  ease_factor: number;
  next_review: string | null;
  last_reviewed: string | null;
  last_quality: number | null;
  lapses: number;
  learning_step: number | null;
  is_relearning: boolean;
  again_count: number;
  times_seen: number;
  user_note: string | null;
  client_updated_at: string;
}

// --- Helpers --------------------------------------------------------------
function parse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function loadDirtySet(userId: string): Set<string> {
  return new Set<string>(parse<string[]>(kv.getString(K_DIRTY_QUEUE(userId))) ?? []);
}

function saveDirtySet(userId: string, set: Set<string>) {
  kv.set(K_DIRTY_QUEUE(userId), JSON.stringify(Array.from(set)));
}

// --- Public API -----------------------------------------------------------
export class LocalStore {
  static isMMKV() { return backend !== null; }

  /** Read the local snapshot of a user_card (returns null if not cached). */
  static get(userId: string, cardId: string): LocalUserCard | null {
    return parse<LocalUserCard>(kv.getString(K_USER_CARD(userId, cardId)));
  }

  /** Overwrite local snapshot (does NOT mark dirty — use for pulls-from-server). */
  static put(card: LocalUserCard) {
    kv.set(K_USER_CARD(card.user_id, card.card_id), JSON.stringify(card));
  }

  /**
   * Synchronous write path used during study — writes to local cache + marks dirty.
   * The value of `client_updated_at` is automatically bumped.
   */
  static commitReview(patch: Partial<LocalUserCard> & { user_id: string; card_id: string }): LocalUserCard {
    const prev = this.get(patch.user_id, patch.card_id);
    const merged: LocalUserCard = {
      user_id: patch.user_id,
      card_id: patch.card_id,
      status: patch.status ?? prev?.status ?? 'active',
      learning_status: patch.learning_status ?? prev?.learning_status ?? 'not_studied',
      repetitions: patch.repetitions ?? prev?.repetitions ?? 0,
      interval_days: patch.interval_days ?? prev?.interval_days ?? 0,
      interval_minutes: patch.interval_minutes ?? prev?.interval_minutes ?? 0,
      ease_factor: patch.ease_factor ?? prev?.ease_factor ?? 2.5,
      next_review: patch.next_review ?? prev?.next_review ?? null,
      last_reviewed: patch.last_reviewed ?? prev?.last_reviewed ?? null,
      last_quality: patch.last_quality ?? prev?.last_quality ?? null,
      lapses: patch.lapses ?? prev?.lapses ?? 0,
      learning_step: patch.learning_step ?? prev?.learning_step ?? null,
      is_relearning: patch.is_relearning ?? prev?.is_relearning ?? false,
      again_count: patch.again_count ?? prev?.again_count ?? 0,
      times_seen: (prev?.times_seen ?? 0) + 1,
      user_note: patch.user_note ?? prev?.user_note ?? null,
      client_updated_at: new Date().toISOString(),
    };
    this.put(merged);
    const set = loadDirtySet(patch.user_id);
    set.add(patch.card_id);
    saveDirtySet(patch.user_id, set);
    return merged;
  }

  static getLastSync(userId: string): string | null {
    return kv.getString(K_LAST_SYNC(userId)) ?? null;
  }
  static setLastSync(userId: string, iso: string) {
    kv.set(K_LAST_SYNC(userId), iso);
  }

  /**
   * Push dirty user_card rows to Supabase. Returns { flushed, failed }.
   * Safe to call repeatedly — only dirty rows are pushed, and on success they're un-marked.
   */
  static async flushToServer(userId: string, opts: { batchSize?: number } = {}): Promise<{ flushed: number; failed: number }> {
    const set = loadDirtySet(userId);
    if (set.size === 0) return { flushed: 0, failed: 0 };

    const batch = opts.batchSize ?? 25;
    const ids = Array.from(set);
    let flushed = 0;
    let failed = 0;

    for (let i = 0; i < ids.length; i += batch) {
      const slice = ids.slice(i, i + batch);
      const rows = slice.map(cid => this.get(userId, cid)).filter(Boolean) as LocalUserCard[];
      if (rows.length === 0) continue;

      // UPSERT into user_cards (the schema has (user_id, card_id) unique).
      const { error } = await supabase
        .from('user_cards')
        .upsert(
          rows.map(r => ({
            user_id: r.user_id,
            card_id: r.card_id,
            status: r.status,
            learning_status: r.learning_status,
            repetitions: r.repetitions,
            interval_days: r.interval_days,
            interval_minutes: r.interval_minutes,
            ease_factor: r.ease_factor,
            next_review: r.next_review,
            last_reviewed: r.last_reviewed,
            last_quality: r.last_quality,
            lapses: r.lapses,
            learning_step: r.learning_step,
            is_relearning: r.is_relearning,
            again_count: r.again_count,
            times_seen: r.times_seen,
            user_note: r.user_note,
            client_updated_at: r.client_updated_at,
            dirty: false,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'user_id,card_id' }
        );

      if (error) {
        console.warn('[LocalStore] flush failed for batch:', error.message);
        failed += rows.length;
      } else {
        rows.forEach(r => set.delete(r.card_id));
        saveDirtySet(userId, set);
        flushed += rows.length;
      }
    }

    if (flushed > 0) this.setLastSync(userId, new Date().toISOString());
    return { flushed, failed };
  }

  /**
   * Pull server-side changes (since last sync) and overwrite local snapshots
   * ONLY when `client_updated_at` on server is newer than local.
   */
  static async pullFromServer(userId: string): Promise<{ pulled: number }> {
    const since = this.getLastSync(userId) ?? new Date(0).toISOString();
    const { data, error } = await supabase
      .from('user_cards')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', since)
      .limit(500);
    if (error) {
      console.warn('[LocalStore] pull failed:', error.message);
      return { pulled: 0 };
    }
    let pulled = 0;
    (data ?? []).forEach((r: any) => {
      const local = this.get(userId, r.card_id);
      const remoteNewer = !local || (r.client_updated_at && r.client_updated_at > local.client_updated_at);
      if (remoteNewer) {
        this.put({
          user_id: r.user_id,
          card_id: r.card_id,
          status: r.status,
          learning_status: r.learning_status,
          repetitions: r.repetitions ?? 0,
          interval_days: r.interval_days ?? 0,
          interval_minutes: r.interval_minutes ?? 0,
          ease_factor: r.ease_factor ?? 2.5,
          next_review: r.next_review,
          last_reviewed: r.last_reviewed,
          last_quality: r.last_quality ?? null,
          lapses: r.lapses ?? 0,
          learning_step: r.learning_step ?? null,
          is_relearning: r.is_relearning ?? false,
          again_count: r.again_count ?? 0,
          times_seen: r.times_seen ?? 0,
          user_note: r.user_note ?? null,
          client_updated_at: r.client_updated_at ?? r.updated_at,
        });
        pulled += 1;
      }
    });
    this.setLastSync(userId, new Date().toISOString());
    return { pulled };
  }

  /** Does a full round-trip: pull newer server rows, then flush dirty local rows. */
  static async sync(userId: string) {
    const pull = await this.pullFromServer(userId).catch(() => ({ pulled: 0 }));
    const flush = await this.flushToServer(userId).catch(() => ({ flushed: 0, failed: 0 }));
    return { ...pull, ...flush };
  }

  /** Returns the count of dirty rows awaiting sync (for UI indicator). */
  static dirtyCount(userId: string): number {
    return loadDirtySet(userId).size;
  }
}

/**
 * Kick off a lightweight background sync loop — call once at app bootstrap.
 * Uses setInterval so it works on Expo Go (no BackgroundFetch needed for first cut).
 */
let _loop: any = null;
export function startBackgroundSync(userId: string, periodMs = 60_000) {
  if (_loop) return;
  _loop = setInterval(() => { LocalStore.sync(userId).catch(() => {}); }, periodMs);
}
export function stopBackgroundSync() {
  if (_loop) { clearInterval(_loop); _loop = null; }
}

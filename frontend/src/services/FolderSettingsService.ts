/**
 * Per-folder algorithm settings (Noji-style).
 *
 * Folder hierarchy:  GLOBAL  →  subject  →  subject|section  →  subject|section|microtopic
 *
 * Settings resolve by walking UP the chain — the first folder that has an
 * explicit override wins for each field (so you can set "4-day graduating
 * interval" on a subject and a child microtopic inherits it automatically).
 */

import { supabase } from '../lib/supabase';
import { AlgorithmSettings, DEFAULT_SETTINGS } from './sm2';

export type FolderKey = string; // e.g. "" (global) | "Polity" | "Polity|Preamble" | "Polity|Preamble|Key Terms"

export interface FolderSettingsRow {
  user_id: string;
  folder_key: FolderKey;
  settings: Partial<AlgorithmSettings>;
  inherit: boolean;
  updated_at?: string;
}

export function makeFolderKey(subject?: string | null, section?: string | null, microtopic?: string | null): FolderKey {
  const parts = [subject, section, microtopic].filter(Boolean) as string[];
  return parts.join('|');
}

/** Return the chain from most-specific to least-specific (ends with ""/GLOBAL). */
export function folderChain(subject?: string | null, section?: string | null, microtopic?: string | null): FolderKey[] {
  const chain: FolderKey[] = [];
  if (subject && section && microtopic) chain.push(`${subject}|${section}|${microtopic}`);
  if (subject && section) chain.push(`${subject}|${section}`);
  if (subject) chain.push(subject);
  chain.push(''); // global
  return chain;
}

const memCache = new Map<string, { at: number; rows: FolderSettingsRow[] }>();
const CACHE_TTL = 30_000;

export class FolderSettingsSvc {
  /** Fetch ALL folder settings for a user (small table). Cached for 30 s. */
  static async listAll(userId: string): Promise<FolderSettingsRow[]> {
    const hit = memCache.get(userId);
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.rows;

    const { data, error } = await supabase
      .from('folder_algorithm_settings')
      .select('user_id, folder_key, settings, inherit, updated_at')
      .eq('user_id', userId);

    if (error) {
      // Table might not exist yet — treat as empty.
      console.warn('[FolderSettings] listAll error:', error.message);
      memCache.set(userId, { at: Date.now(), rows: [] });
      return [];
    }
    const rows = (data as FolderSettingsRow[]) || [];
    memCache.set(userId, { at: Date.now(), rows });
    return rows;
  }

  static invalidate(userId: string) { memCache.delete(userId); }

  /**
   * Resolve effective settings for a folder by walking the chain.
   *   - If the most-specific row has `inherit=false`, its own settings REPLACE the parent chain.
   *   - If `inherit=true` (default), settings MERGE on top of parent chain.
   */
  static async resolve(
    userId: string,
    subject?: string | null,
    section?: string | null,
    microtopic?: string | null
  ): Promise<AlgorithmSettings> {
    const rows = await this.listAll(userId);
    const map = new Map<FolderKey, FolderSettingsRow>();
    rows.forEach(r => map.set(r.folder_key, r));

    const chain = folderChain(subject, section, microtopic);
    // Start with DEFAULTS, then apply from least-specific to most-specific.
    let merged: AlgorithmSettings = { ...DEFAULT_SETTINGS };
    const reversed = [...chain].reverse(); // global first, then subject, then ...

    for (const key of reversed) {
      const row = map.get(key);
      if (!row) continue;
      if (row.inherit === false) {
        // Hard override: reset to defaults + this row's explicit fields
        merged = { ...DEFAULT_SETTINGS, ...(row.settings || {}) };
      } else {
        merged = { ...merged, ...(row.settings || {}) };
      }
    }
    return merged;
  }

  /** Get the raw row for a folder (to populate the settings modal with only explicit overrides). */
  static async getRaw(userId: string, folder_key: FolderKey): Promise<FolderSettingsRow | null> {
    const rows = await this.listAll(userId);
    return rows.find(r => r.folder_key === folder_key) || null;
  }

  /** Upsert explicit overrides for a folder. Empty `settings` + inherit=true effectively "resets" to parent. */
  static async upsert(
    userId: string,
    folder_key: FolderKey,
    settings: Partial<AlgorithmSettings>,
    inherit = true
  ) {
    const payload = {
      user_id: userId,
      folder_key,
      settings,
      inherit,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('folder_algorithm_settings')
      .upsert(payload, { onConflict: 'user_id,folder_key' });
    if (error) throw error;
    this.invalidate(userId);
  }

  static async reset(userId: string, folder_key: FolderKey) {
    const { error } = await supabase
      .from('folder_algorithm_settings')
      .delete()
      .eq('user_id', userId)
      .eq('folder_key', folder_key);
    if (error) throw error;
    this.invalidate(userId);
  }
}

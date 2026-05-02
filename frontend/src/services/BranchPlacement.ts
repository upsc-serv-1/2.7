/**
 * BranchPlacement — places a flashcard into the deck hierarchy.
 *
 * Two modes:
 *   - autoPlace(userId, cardId, hint): creates/uses Subject → Section Group → Microtopic
 *     branches and links the card to the leaf branch.
 *   - placeAt(userId, cardId, branchId): links the card to a specific branch.
 *
 * Branches are idempotent — looking up by (user_id, parent_id, name) before insert.
 */

import { supabase } from '../lib/supabase';
import { BranchSvc, Branch } from './BranchService';

export interface PlacementHint {
  subject?: string | null;
  section_group?: string | null;
  microtopic?: string | null;
}

export class BranchPlacement {
  /** Find a branch by exact (user_id, parent_id, name) — case-insensitive. */
  static async findChild(userId: string, parentId: string | null, name: string): Promise<Branch | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    let q = supabase
      .from('flashcard_branches')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .ilike('name', trimmed);
    if (parentId === null) q = q.is('parent_id', null);
    else q = q.eq('parent_id', parentId);
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) return null;
    return (data as Branch) ?? null;
  }

  /** Get-or-create a branch as a child of `parentId` (null = root). */
  static async ensureBranch(userId: string, parentId: string | null, name: string): Promise<Branch> {
    const trimmed = (name || '').trim() || 'General';
    const existing = await this.findChild(userId, parentId, trimmed);
    if (existing) return existing;
    return BranchSvc.create(userId, trimmed, parentId);
  }

  /**
   * Auto-place a card into Subject → Section Group → Microtopic branch hierarchy.
   * Falls back to "General" segments for missing fields.
   * Returns the leaf branch the card was added to.
   */
  static async autoPlace(userId: string, cardId: string, hint: PlacementHint): Promise<Branch> {
    const subject = (hint.subject || 'General').trim() || 'General';
    const section = (hint.section_group || 'General').trim() || 'General';
    const micro   = (hint.microtopic || 'General').trim() || 'General';

    const subjectBranch = await this.ensureBranch(userId, null, subject);
    const sectionBranch = await this.ensureBranch(userId, subjectBranch.id, section);
    const leaf = await this.ensureBranch(userId, sectionBranch.id, micro);

    await BranchSvc.addCardToBranch(userId, leaf.id, cardId);
    return leaf;
  }

  /** Link an existing card to a specific branch (manual placement). */
  static async placeAt(userId: string, cardId: string, branchId: string): Promise<void> {
    await BranchSvc.addCardToBranch(userId, branchId, cardId);
  }

  /** Move a card from one branch to another. */
  static async moveCard(userId: string, cardId: string, fromBranchId: string, toBranchId: string): Promise<void> {
    if (fromBranchId === toBranchId) return;

    // Ensure destination link exists first (idempotent).
    await BranchSvc.addCardToBranch(userId, toBranchId, cardId);

    // Then remove old links. We intentionally remove from *all* other branches,
    // because the caller may not always know the exact source branch (e.g. recursive views).
    const { error } = await supabase
      .from('flashcard_branch_cards')
      .delete()
      .eq('user_id', userId)
      .eq('card_id', cardId)
      .neq('branch_id', toBranchId);

    if (error) throw error;
  }

  /** Build a human-readable path for a leaf branch (for confirmation toasts). */
  static buildPathLabel(leaf: { path?: string; name: string }): string {
    return leaf.path && leaf.path.length > 0 ? leaf.path : leaf.name;
  }
}

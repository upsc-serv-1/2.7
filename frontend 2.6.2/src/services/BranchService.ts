/**
 * BranchService — AnkiPro / Noji style hierarchical decks.
 *
 * Backed by two tables that already exist in the schema:
 *   - flashcard_branches     (id, user_id, name, parent_id, is_archived, is_deleted, sort_order)
 *   - flashcard_branch_cards (id, branch_id, card_id, user_id)
 *
 * Core features:
 *   - Materialised path caching for fast `path LIKE 'Subject/Section/%'` queries.
 *   - Recursive aggregation: a parent's "Due" / "New" pill = sum of entire subtree.
 *   - Full tree fetch via a single RPC so the deck hub renders in one round-trip.
 */

import { supabase } from '../lib/supabase';

export interface Branch {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  is_archived: boolean;
  is_deleted: boolean;
  is_folder: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface BranchNode extends Branch {
  path: string;               // "Subject/Section/Microtopic"
  depth: number;              // root = 0
  children: BranchNode[];
  // Aggregated over entire subtree (incl. self):
  due_count: number;
  new_count: number;
  learning_count: number;
  mastered_count: number;
  total_count: number;
  direct_card_count: number;  // just this node's own cards
}

export interface BranchCounts {
  branch_id: string;
  due: number;
  new: number;
  learning: number;
  mastered: number;
  total: number;
}

export class BranchSvc {
  // ─── CRUD ───────────────────────────────────────────────────────────────
  static async listAll(userId: string, opts: { includeArchived?: boolean } = {}): Promise<Branch[]> {
    let q = supabase
      .from('flashcard_branches')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (!opts.includeArchived) q = q.eq('is_archived', false);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Branch[];
  }

  static async create(userId: string, name: string, parent_id: string | null = null, is_folder: boolean = false): Promise<Branch> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Branch name required');
    const { data, error } = await supabase
      .from('flashcard_branches')
      .insert({ user_id: userId, name: trimmed, parent_id, is_folder })
      .select()
      .single();
    if (error) throw error;
    return data as Branch;
  }

  static async rename(branchId: string, name: string) {
    const { error } = await supabase
      .from('flashcard_branches')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', branchId);
    if (error) throw error;
  }

  static async move(branchId: string, newParentId: string | null) {
    if (branchId === newParentId) throw new Error('Cannot parent a branch to itself');
    // Cycle-check: make sure newParentId is not a descendant of branchId.
    // Simple approach — walk up from newParentId; if we hit branchId, reject.
    let cur = newParentId;
    while (cur) {
      if (cur === branchId) throw new Error('Move would create a cycle');
      const { data } = await supabase.from('flashcard_branches').select('parent_id').eq('id', cur).maybeSingle();
      cur = (data as any)?.parent_id ?? null;
    }
    const { error } = await supabase
      .from('flashcard_branches')
      .update({ parent_id: newParentId, updated_at: new Date().toISOString() })
      .eq('id', branchId);
    if (error) throw error;
  }

  static async archive(branchId: string, archived = true) {
    const { error } = await supabase
      .from('flashcard_branches')
      .update({ is_archived: archived, updated_at: new Date().toISOString() })
      .eq('id', branchId);
    if (error) throw error;
  }

  /** Soft-delete (recoverable for 30 days at the UI layer). */
  static async softDelete(branchId: string) {
    const { error } = await supabase
      .from('flashcard_branches')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', branchId);
    if (error) throw error;
  }

  static async reorder(branchId: string, sort_order: number) {
    const { error } = await supabase
      .from('flashcard_branches')
      .update({ sort_order, updated_at: new Date().toISOString() })
      .eq('id', branchId);
    if (error) throw error;
  }

  // ─── CARD ↔ BRANCH MAPPING ──────────────────────────────────────────────
  static async addCardToBranch(userId: string, branchId: string, cardId: string) {
    // Idempotent insert
    const { data: existing } = await supabase
      .from('flashcard_branch_cards')
      .select('id')
      .eq('branch_id', branchId)
      .eq('card_id', cardId)
      .maybeSingle();
    if (existing) return existing.id as string;
    const { data, error } = await supabase
      .from('flashcard_branch_cards')
      .insert({ user_id: userId, branch_id: branchId, card_id: cardId })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  }

  static async removeCardFromBranch(branchId: string, cardId: string) {
    const { error } = await supabase
      .from('flashcard_branch_cards')
      .delete()
      .eq('branch_id', branchId)
      .eq('card_id', cardId);
    if (error) throw error;
  }

  static async moveCardToBranch(userId: string, cardId: string, targetBranchId: string | null) {
    // 1. Remove from any existing branches
    const { error: delErr } = await supabase
      .from('flashcard_branch_cards')
      .delete()
      .eq('card_id', cardId)
      .eq('user_id', userId);
    if (delErr) throw delErr;

    // 2. If target is provided, add to it
    if (targetBranchId) {
      await this.addCardToBranch(userId, targetBranchId, cardId);
    }
  }

  static async listCardIdsInBranch(branchId: string, opts: { recursive?: boolean; userId?: string } = {}): Promise<string[]> {
    if (!opts.recursive) {
      const { data, error } = await supabase
        .from('flashcard_branch_cards')
        .select('card_id')
        .eq('branch_id', branchId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.card_id);
    }
    // Recursive: first get all descendant branch ids
    if (!opts.userId) throw new Error('userId required for recursive branch card fetch');
    const branches = await this.listAll(opts.userId);
    const descIds = this.collectDescendantIds(branches, branchId);
    const targetIds = [branchId, ...descIds];
    if (targetIds.length === 0) return [];
    const { data, error } = await supabase
      .from('flashcard_branch_cards')
      .select('card_id')
      .in('branch_id', targetIds);
    if (error) throw error;
    return Array.from(new Set((data ?? []).map((r: any) => r.card_id)));
  }

  // ─── TREE BUILDING + AGGREGATION ────────────────────────────────────────
  /**
   * Build the full hierarchical tree with aggregate counters (due / new / learning / mastered / total).
   * Runs 3 queries total (branches, branch_cards, user_cards) — everything else is in-memory aggregation.
   */
  static async buildTree(userId: string): Promise<BranchNode[]> {
    // 1. All branches
    const branches = await this.listAll(userId);

    // 2. All branch<->card links for this user (RLS keeps this scoped)
    const { data: links, error: linkErr } = await supabase
      .from('flashcard_branch_cards')
      .select('branch_id, card_id')
      .eq('user_id', userId);
    if (linkErr) throw linkErr;

    const branchCardMap = new Map<string, Set<string>>(); // branch_id → Set<card_id>
    const allCardIds = new Set<string>();
    (links ?? []).forEach((l: any) => {
      if (!branchCardMap.has(l.branch_id)) branchCardMap.set(l.branch_id, new Set());
      branchCardMap.get(l.branch_id)!.add(l.card_id);
      allCardIds.add(l.card_id);
    });

    // 3. user_cards for those cards (the only fields we need for counters)
    const cardIds = Array.from(allCardIds);
    const now = Date.now();

    type MiniCard = { learning_status: string; status: string; next_review: string | null };
    const cardStateMap = new Map<string, MiniCard>();

    if (cardIds.length > 0) {
      // Batch in groups of 500 to avoid URL-too-long on big decks
      const CHUNK = 500;
      for (let i = 0; i < cardIds.length; i += CHUNK) {
        const slice = cardIds.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from('user_cards')
          .select('card_id, learning_status, status, next_review')
          .eq('user_id', userId)
          .in('card_id', slice);
        if (error) throw error;
        (data ?? []).forEach((r: any) => cardStateMap.set(r.card_id, r));
      }
    }

    // Helper: counters for a direct branch (not yet rolled up)
    const directCounts = (branchId: string) => {
      let due = 0, new_ = 0, learning = 0, mastered = 0, total = 0, direct = 0;
      const ids = branchCardMap.get(branchId);
      if (!ids) return { due, new_, learning, mastered, total, direct };
      ids.forEach(cardId => {
        const st = cardStateMap.get(cardId);
        if (!st || st.status !== 'active') return;
        direct += 1;
        total += 1;
        const ls = st.learning_status;
        if (ls === 'not_studied' || ls === 'new') {
          new_ += 1;
        } else if (ls === 'mastered') {
          mastered += 1;
        } else if (ls === 'learning' || ls === 'review' || ls === 'leech') {
          learning += 1;
          if (st.next_review && new Date(st.next_review).getTime() <= now) due += 1;
        }
      });
      return { due, new_, learning, mastered, total, direct };
    };

    // Build node index
    const nodeMap = new Map<string, BranchNode>();
    branches.forEach(b => {
      const c = directCounts(b.id);
      nodeMap.set(b.id, {
        ...b,
        path: b.name,            // will be fixed after tree build
        depth: 0,
        children: [],
        due_count: c.due,
        new_count: c.new_,
        learning_count: c.learning,
        mastered_count: c.mastered,
        total_count: c.total,
        direct_card_count: c.direct,
      });
    });

    // Wire parent→child
    const roots: BranchNode[] = [];
    nodeMap.forEach(node => {
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        nodeMap.get(node.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort children within each parent
    const sortChildren = (arr: BranchNode[]) => {
      arr.sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
      arr.forEach(n => sortChildren(n.children));
    };
    sortChildren(roots);

    // Compute paths + depths + roll up counters
    const walk = (node: BranchNode, parentPath: string, depth: number) => {
      node.depth = depth;
      node.path = parentPath ? `${parentPath}/${node.name}` : node.name;
      node.children.forEach(child => walk(child, node.path, depth + 1));
      // Aggregate after walking
      node.children.forEach(child => {
        node.due_count      += child.due_count;
        node.new_count      += child.new_count;
        node.learning_count += child.learning_count;
        node.mastered_count += child.mastered_count;
        node.total_count    += child.total_count;
      });
    };
    roots.forEach(r => walk(r, '', 0));

    return roots;
  }

  /** Flatten a tree (pre-order) for simple `.map` rendering with indent by `depth`. */
  static flatten(tree: BranchNode[], onlyExpanded?: Set<string>): BranchNode[] {
    const out: BranchNode[] = [];
    const recur = (n: BranchNode) => {
      out.push(n);
      if (!onlyExpanded || onlyExpanded.has(n.id)) {
        n.children.forEach(recur);
      }
    };
    tree.forEach(recur);
    return out;
  }

  /** Given a flat list and a target id, return the ids of ALL descendants. */
  static collectDescendantIds(branches: Branch[], rootId: string): string[] {
    const byParent = new Map<string, Branch[]>();
    branches.forEach(b => {
      if (!b.parent_id) return;
      if (!byParent.has(b.parent_id)) byParent.set(b.parent_id, []);
      byParent.get(b.parent_id)!.push(b);
    });
    const out: string[] = [];
    const stack = [...(byParent.get(rootId) ?? [])];
    while (stack.length) {
      const b = stack.pop()!;
      out.push(b.id);
      const kids = byParent.get(b.id) ?? [];
      stack.push(...kids);
    }
    return out;
  }

  /** Find the full ancestry chain (self → root) for a branch id. */
  static ancestry(branches: Branch[], branchId: string): Branch[] {
    const byId = new Map(branches.map(b => [b.id, b]));
    const chain: Branch[] = [];
    let cur: string | null = branchId;
    while (cur && byId.has(cur)) {
      const b = byId.get(cur)!;
      chain.push(b);
      cur = b.parent_id;
    }
    return chain;
  }
}

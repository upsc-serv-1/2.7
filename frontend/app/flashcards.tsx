import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView,
  TouchableOpacity, Modal, TextInput, Alert, FlatList, RefreshControl, Pressable,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  Plus, Search as SearchIcon, X, Flame, Clock, Sparkles, Layers, ArrowUpDown,
} from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { ThemeSwitcher } from '../src/components/ThemeSwitcher';
import { PageWrapper } from '../src/components/PageWrapper';
import { BranchSvc, BranchNode, Branch } from '../src/services/BranchService';
import { DeckRow, DeckRowAction } from '../src/components/flashcards/DeckRow';
import { FolderAlgorithmModal } from '../src/components/flashcards/FolderAlgorithmModal';

type DeckSort = 'name' | 'created' | 'due';

export default function FlashcardsHub() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const uid = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tree, setTree] = useState<BranchNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<DeckSort>('name');
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);

  // Modals
  const [createModal, setCreateModal] = useState<{ parent: BranchNode | null } | null>(null);
  const [renameModal, setRenameModal] = useState<{ node: BranchNode } | null>(null);
  const [moveModal, setMoveModal] = useState<{ node: BranchNode } | null>(null);
  const [algoModal, setAlgoModal] = useState<{ node: BranchNode } | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const t = await BranchSvc.buildTree(uid);
      setTree(t);
      // Auto-expand top-level if there's only one root
      if (t.length === 1) setExpanded(new Set([t[0].id]));
    } catch (e: any) {
      console.error('[DeckHub] load error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); };

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Flatten tree with search + sort
  const rows = useMemo(() => {
    const sorted = [...tree];
    const sortNodes = (arr: BranchNode[]) => {
      arr.sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'due')  return b.due_count - a.due_count;
        if (sort === 'created') return (a.created_at || '').localeCompare(b.created_at || '');
        return 0;
      });
      arr.forEach(n => sortNodes(n.children));
    };
    sortNodes(sorted);

    let flat = BranchSvc.flatten(sorted, expanded);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      flat = flat.filter(n => n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q));
    }
    return flat;
  }, [tree, expanded, sort, search]);

  const aggregateStats = useMemo(() => {
    let due = 0, new_ = 0, total = 0;
    tree.forEach(n => { due += n.due_count; new_ += n.new_count; total += n.total_count; });
    return { due, new: new_, total };
  }, [tree]);

  // ─── Actions ───
  const openCreate = (parent: BranchNode | null) => {
    setNameDraft('');
    setCreateModal({ parent });
  };

  const doCreate = async () => {
    if (!uid) return;
    const name = nameDraft.trim();
    if (!name) return;
    try {
      await BranchSvc.create(uid, name, createModal?.parent?.id ?? null);
      setCreateModal(null);
      await load();
    } catch (e: any) { Alert.alert('Failed', e?.message); }
  };

  const doRename = async () => {
    if (!renameModal) return;
    const name = nameDraft.trim();
    if (!name) return;
    try {
      await BranchSvc.rename(renameModal.node.id, name);
      setRenameModal(null);
      await load();
    } catch (e: any) { Alert.alert('Failed', e?.message); }
  };

  const doMove = async (targetParentId: string | null) => {
    if (!moveModal) return;
    try {
      await BranchSvc.move(moveModal.node.id, targetParentId);
      setMoveModal(null);
      await load();
    } catch (e: any) { Alert.alert('Move failed', e?.message); }
  };

  const confirmDelete = (node: BranchNode) => {
    const total = node.total_count;
    Alert.alert(
      'Delete deck?',
      `"${node.name}" and its ${countDescendants(node)} sub-decks will be archived. ${total} cards will stay in your library.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
            try { await BranchSvc.softDelete(node.id); await load(); }
            catch (e: any) { Alert.alert('Failed', e?.message); }
          } },
      ]
    );
  };

  const handleAction = (node: BranchNode, action: DeckRowAction) => {
    switch (action) {
      case 'settings': setAlgoModal({ node }); return;
      case 'rename':   setNameDraft(node.name); setRenameModal({ node }); return;
      case 'move':     setMoveModal({ node }); return;
      case 'delete':   confirmDelete(node); return;
    }
  };

  const openDeck = (node: BranchNode) => {
    // For leaf-like decks with no children, drill into microtopic screen with recursive mode.
    router.push({
      pathname: '/flashcards/microtopic',
      params: { branchId: node.id, branchName: node.name, recursive: '1' },
    } as any);
  };

  return (
    <PageWrapper>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerTop}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Deck Hub</Text>
            <View style={styles.headerBtns}>
              <TouchableOpacity onPress={() => openCreate(null)} style={styles.iconBtn} testID="btn-new-root-deck">
                <Plus size={22} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSearchVisible(v => !v)} style={styles.iconBtn} testID="btn-search">
                <SearchIcon size={22} color={colors.textPrimary} />
              </TouchableOpacity>
              <ThemeSwitcher />
            </View>
          </View>
          {searchVisible && (
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SearchIcon size={16} color={colors.textTertiary} />
              <TextInput
                value={search} onChangeText={setSearch} placeholder="Search decks..."
                placeholderTextColor={colors.textTertiary}
                style={[styles.searchInput, { color: colors.textPrimary }]}
                autoFocus
                testID="search-input"
              />
              <TouchableOpacity onPress={() => { setSearch(''); setSearchVisible(false); }}>
                <X size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Top stats */}
        <View style={styles.statsBar}>
          <View style={[styles.statBox, { backgroundColor: '#ef444412', borderColor: '#ef444430' }]}>
            <Clock size={14} color="#ef4444" />
            <Text style={[styles.statNum, { color: '#ef4444' }]}>{aggregateStats.due}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Due</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#3b82f612', borderColor: '#3b82f630' }]}>
            <Sparkles size={14} color="#3b82f6" />
            <Text style={[styles.statNum, { color: '#3b82f6' }]}>{aggregateStats.new}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>New</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Layers size={14} color={colors.textSecondary} />
            <Text style={[styles.statNum, { color: colors.textPrimary }]}>{aggregateStats.total}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Total</Text>
          </View>
        </View>

        {/* Sort toolbar */}
        <View style={styles.sortRow}>
          <TouchableOpacity
            onPress={() => {
              const next = sort === 'name' ? 'due' : sort === 'due' ? 'created' : 'name';
              setSort(next);
            }}
            style={[styles.sortBtn, { borderColor: colors.border }]}
            testID="btn-sort-toggle"
          >
            <ArrowUpDown size={14} color={colors.textSecondary} />
            <Text style={[styles.sortText, { color: colors.textSecondary }]}>
              {sort === 'name' ? 'Alphabetical' : sort === 'due' ? 'Most due' : 'Newest'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Body */}
        {loading && tree.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : tree.length === 0 ? (
          <EmptyState colors={colors} onCreate={() => openCreate(null)} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            contentContainerStyle={{ paddingBottom: 120, paddingTop: 4 }}
            renderItem={({ item }) => (
              <DeckRow
                node={item}
                expanded={expanded.has(item.id)}
                onToggle={() => toggle(item.id)}
                onOpen={() => openDeck(item)}
                onAction={(act) => handleAction(item, act)}
              />
            )}
            ListEmptyComponent={
              search ? (
                <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 40 }}>
                  No decks match "{search}"
                </Text>
              ) : null
            }
          />
        )}

        {/* FAB: global create */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => openCreate(null)}
          testID="btn-fab-create"
        >
          <Plus size={26} color="#04223a" />
        </TouchableOpacity>

        {/* CREATE MODAL */}
        <NameModal
          visible={!!createModal}
          title={createModal?.parent ? `New deck inside "${createModal.parent.name}"` : 'New root deck'}
          value={nameDraft}
          onChange={setNameDraft}
          onClose={() => setCreateModal(null)}
          onConfirm={doCreate}
          confirmLabel="Create"
          testID="modal-create"
        />
        {/* RENAME MODAL */}
        <NameModal
          visible={!!renameModal}
          title="Rename deck"
          value={nameDraft}
          onChange={setNameDraft}
          onClose={() => setRenameModal(null)}
          onConfirm={doRename}
          confirmLabel="Save"
          testID="modal-rename"
        />
        {/* MOVE MODAL */}
        <MoveModal
          visible={!!moveModal}
          node={moveModal?.node}
          tree={tree}
          onClose={() => setMoveModal(null)}
          onConfirm={doMove}
        />
        {/* ALGO MODAL — per-deck settings */}
        {algoModal && (
          <FolderAlgorithmModal
            visible
            userId={uid}
            subject={algoModal.node.path.split('/')[0] || algoModal.node.name}
            section={algoModal.node.path.split('/')[1] || null}
            microtopic={algoModal.node.path.split('/')[2] || null}
            onClose={() => setAlgoModal(null)}
            onSaved={load}
          />
        )}
      </SafeAreaView>
    </PageWrapper>
  );
}

function countDescendants(node: BranchNode): number {
  let c = node.children.length;
  node.children.forEach(ch => { c += countDescendants(ch); });
  return c;
}

function EmptyState({ colors, onCreate }: any) {
  return (
    <View style={{ alignItems: 'center', padding: 40, marginTop: 40 }}>
      <Flame size={64} color={colors.border} />
      <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '900', marginTop: 18 }}>Start your first deck</Text>
      <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 8, textAlign: 'center', maxWidth: 260 }}>
        Decks can have sub-decks — great for subjects & chapters.
      </Text>
      <TouchableOpacity
        style={{ marginTop: 24, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
        onPress={onCreate}
        testID="btn-empty-create"
      >
        <Text style={{ color: '#04223a', fontWeight: '900' }}>Create a deck</Text>
      </TouchableOpacity>
    </View>
  );
}

function NameModal({ visible, title, value, onChange, onClose, onConfirm, confirmLabel, testID }: any) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()} testID={testID}>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Deck name"
            placeholderTextColor={colors.textTertiary}
            style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
            autoFocus
            testID={`${testID}-input`}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <TouchableOpacity onPress={onClose} style={[styles.modalBtnSec, { borderColor: colors.border }]}>
              <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={[styles.modalBtnPri, { backgroundColor: colors.primary }]} testID={`${testID}-confirm`}>
              <Text style={{ color: '#04223a', fontWeight: '900' }}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MoveModal({ visible, node, tree, onClose, onConfirm }: any) {
  const { colors } = useTheme();
  if (!node) return null;

  const flat = BranchSvc.flatten(tree);
  // Exclude self + descendants
  const descIds = new Set(BranchSvc.collectDescendantIds(flat as any, node.id));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { backgroundColor: colors.surface, maxHeight: '70%' }]} onPress={(e) => e.stopPropagation()} testID="modal-move">
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Move "{node.name}"</Text>
          <Text style={{ color: colors.textTertiary, marginBottom: 10, fontSize: 12 }}>Choose a new parent — or move to root.</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            <TouchableOpacity
              onPress={() => onConfirm(null)}
              style={[styles.moveItem, { borderColor: colors.border }]}
              testID="move-to-root"
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>— Root —</Text>
            </TouchableOpacity>
            {flat.filter((n: any) => n.id !== node.id && !descIds.has(n.id)).map((n: any) => (
              <TouchableOpacity
                key={n.id}
                onPress={() => onConfirm(n.id)}
                style={[styles.moveItem, { borderColor: colors.border, paddingLeft: 12 + (n.depth * 14) }]}
                testID={`move-to-${n.id}`}
              >
                <Text style={{ color: colors.textPrimary }}>{n.name}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 11 }} numberOfLines={1}>{n.path}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={onClose} style={[styles.modalBtnSec, { borderColor: colors.border, marginTop: 14 }]}>
            <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  headerTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 42, borderRadius: 12, borderWidth: 1, gap: 8, marginTop: 4 },
  searchInput: { flex: 1, fontSize: 14 },
  statsBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1, gap: 4 },
  statNum: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  sortRow: { paddingHorizontal: 14, paddingVertical: 4, flexDirection: 'row' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  sortText: { fontSize: 12, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { padding: 20, paddingBottom: 30, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  modalTitle: { fontSize: 20, fontWeight: '900', marginBottom: 14 },
  modalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '600' },
  modalBtnSec: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  modalBtnPri: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  moveItem: { padding: 12, borderBottomWidth: 1, borderRadius: 8 },
});

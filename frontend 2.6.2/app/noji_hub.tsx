import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView,
  TouchableOpacity, Modal, TextInput, Alert, FlatList, RefreshControl, Pressable,
  KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  Plus, Search as SearchIcon, X, Flame, Clock, Sparkles, Layers, ArrowUpDown,
  Folder, CheckCircle2, Minus, ChevronLeft, ArrowUpRight, Settings, MoreVertical,
  FolderPlus
} from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { ThemeSwitcher } from '../src/components/ThemeSwitcher';
import { PageWrapper } from '../src/components/PageWrapper';
import { BranchSvc, BranchNode } from '../src/services/BranchService';
import { DeckRow } from '../src/components/flashcards/DeckRow';
import { PremiumMoveModal } from '../src/components/flashcards/PremiumMoveModal';

export default function NojiHub() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const uid = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tree, setTree] = useState<BranchNode[]>([]);
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<BranchNode | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const navLock = React.useRef(false);
  
  const [moveModal, setMoveModal] = useState<{ node: BranchNode } | null>(null);
  const [createModal, setCreateModal] = useState<{ type: 'folder' | 'deck' } | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const t = await BranchSvc.buildTree(uid);
      setTree(t);
      
      if (currentFolder) {
        const flat = BranchSvc.flatten(t);
        const updated = flat.find(n => n.id === currentFolder.id);
        if (updated) {
          // Only update if stats actually changed to avoid unnecessary re-renders
          setCurrentFolder(prev => {
            if (prev?.due_count === updated.due_count && prev?.total_count === updated.total_count) return prev;
            return updated;
          });
        } else {
          setCurrentFolder(null);
        }
      }
    } catch (e: any) {
      console.error('[NojiHub] load error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      navLock.current = false; // Reset lock on load (when focus returns)
    }
  }, [uid, currentFolder]);

  useFocusEffect(useCallback(() => { 
    navLock.current = false; // Reset lock when Hub gets focus
    load(); 
  }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const displayRows = useMemo(() => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return BranchSvc.flatten(tree).filter(n => n.name.toLowerCase().includes(q));
    }
    
    if (currentFolder) {
      // Inside a folder: Show recursive tree starting from currentFolder's children
      const baseDepth = currentFolder.depth + 1;
      return BranchSvc.flatten(currentFolder.children, expanded).map(n => ({
        ...n,
        depth: Math.max(0, n.depth - baseDepth)
      }));
    }
    
    // Root level: Only show top-level "Folders" (Decks)
    return tree;
  }, [tree, search, currentFolder, expanded]);

  const aggregateStats = useMemo(() => {
    let due = 0, new_ = 0, total = 0;
    const targetSet = currentFolder ? [currentFolder] : tree;
    targetSet.forEach(n => { due += n.due_count; new_ += n.new_count; total += n.total_count; });
    return { due, new: new_, total };
  }, [tree, currentFolder]);

  const handleMove = async (targetParentId: string | null) => {
    if (!moveModal) return;
    try {
      await BranchSvc.move(moveModal.node.id, targetParentId);
      setMoveModal(null);
      await load();
    } catch (e: any) { Alert.alert('Move failed', e?.message); }
  };

  const handleCreate = async () => {
    if (!uid || !nameDraft.trim() || !createModal) return;
    try {
      const isFolder = createModal.type === 'folder';
      const parentId = createModal.type === 'deck' ? currentFolder?.id : null;
      await BranchSvc.create(uid, nameDraft.trim(), parentId ?? null, isFolder);
      setCreateModal(null);
      setNameDraft('');
      await load();
    } catch (e: any) { Alert.alert('Error', e?.message); }
  };

  const openDeck = (node: BranchNode) => {
    if (navLock.current) return;
    navLock.current = true;
    router.push({
      pathname: '/flashcards/microtopic',
      params: { branchId: node.id, branchName: node.name, recursive: '1' },
    } as any);
  };

  const startStudy = (mode: 'due' | 'new') => {
    router.push({
      pathname: '/flashcards/study',
      params: { mode, recursive: '1' }
    } as any);
  };

  return (
    <PageWrapper>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Header (Original style from flashcards.tsx) */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {currentFolder && (
                <TouchableOpacity onPress={() => setCurrentFolder(null)} style={styles.iconBtn}>
                  <ChevronLeft size={28} color={colors.primary} />
                </TouchableOpacity>
              )}
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                {currentFolder ? currentFolder.name : 'Home'}
              </Text>
            </View>
            <View style={styles.headerBtns}>
              <TouchableOpacity onPress={() => setCreateModal({ type: currentFolder ? 'deck' : 'folder' })} style={styles.iconBtn}>
                <Plus size={22} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSearchVisible(v => !v)} style={styles.iconBtn}>
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
              />
              <TouchableOpacity onPress={() => { setSearch(''); setSearchVisible(false); Keyboard.dismiss(); }}>
                <X size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {currentFolder && (
           <View style={[styles.breadcrumb, { backgroundColor: colors.surface }]}>
             <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Home / </Text>
             <Text style={{ color: colors.textPrimary, fontSize: 12 }}>{currentFolder.name}</Text>
           </View>
        )}

        {/* Stats Bar (Original style from flashcards.tsx) */}
        <View style={styles.statsBar}>
          <TouchableOpacity 
            onPress={() => startStudy('due')}
            style={[styles.statBox, { backgroundColor: '#ef444412', borderColor: '#ef444430' }]}
          >
            <Clock size={14} color="#ef4444" />
            <Text style={[styles.statNum, { color: '#ef4444' }]}>{aggregateStats.due}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Due</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => startStudy('new')}
            style={[styles.statBox, { backgroundColor: '#3b82f612', borderColor: '#3b82f630' }]}
          >
            <Sparkles size={14} color="#3b82f6" />
            <Text style={[styles.statNum, { color: '#3b82f6' }]}>{aggregateStats.new}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>New</Text>
          </TouchableOpacity>

          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Layers size={14} color={colors.textSecondary} />
            <Text style={[styles.statNum, { color: colors.textPrimary }]}>{aggregateStats.total}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Total</Text>
          </View>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Library Content */}
          <View style={{ paddingHorizontal: 4 }}>
            {displayRows.map((item) => {
              if (!currentFolder && !search) {
                // ROOT LEVEL: Distinguish Folders vs Decks based on is_folder
                if (item.is_folder) {
                  return (
                    <TouchableOpacity 
                      key={item.id}
                      style={[styles.officialFolderRow, { borderBottomColor: colors.border + '30' }]}
                      onPress={() => setCurrentFolder(item)}
                    >
                      <View style={[styles.officialFolderIcon, { backgroundColor: '#e0f2fe' }]}>
                        <Folder size={20} color="#0ea5e9" />
                      </View>
                      <Text style={[styles.officialRowText, { color: colors.textPrimary }]}>{item.name}</Text>
                      <ChevronLeft size={20} color={colors.border} style={{ transform: [{ rotate: '180deg' }] }} />
                    </TouchableOpacity>
                  );
                }
              }

              // Normal DeckRow (Inside folder OR root decks)
              return (
                <View key={item.id}>
                   <DeckRow
                    node={item}
                    expanded={expanded.has(item.id)}
                    onToggle={() => toggleExpand(item.id)}
                    onOpen={() => openDeck(item)}
                    onAction={() => setMoveModal({ node: item })}
                  />
                </View>
              );
            })}
          </View>

          {displayRows.length === 0 && (
            <View style={styles.empty}>
              <Layers size={48} color={colors.border} />
              <Text style={{ color: colors.textTertiary, marginTop: 12 }}>Empty</Text>
            </View>
          )}
        </ScrollView>

        {/* Floating Create Button */}
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => setCreateModal({ type: currentFolder ? 'deck' : 'folder' })}
        >
          <Plus size={28} color="#04223a" />
        </TouchableOpacity>

        <Modal visible={!!createModal} transparent animationType="fade">
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
          >
            <View style={styles.modalOverlay}>
              <Pressable style={{ flex: 1 }} onPress={() => setCreateModal(null)} />
              <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {createModal?.type === 'folder' ? 'New Study Folder' : `New Deck in ${currentFolder?.name}`}
                </Text>
                <TextInput
                  placeholder={createModal?.type === 'folder' ? "Folder Name" : "Deck Name"}
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]}
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  autoFocus
                />
                <View style={styles.modalBtns}>
                  <TouchableOpacity onPress={() => setCreateModal(null)} style={styles.modalCancel}>
                    <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCreate} style={[styles.modalCreate, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: '#04223a', fontWeight: '900' }}>Create</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <PremiumMoveModal 
          visible={!!moveModal} 
          node={moveModal?.node} 
          tree={tree} 
          onClose={() => setMoveModal(null)} 
          onConfirm={handleMove} 
        />
      </View>
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  headerTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  breadcrumb: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 8, marginTop: -4 },
  statsBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1, gap: 4 },
  statNum: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 42, borderRadius: 12, borderWidth: 1, gap: 8, marginTop: 4 },
  searchInput: { flex: 1, fontSize: 14 },

  officialFolderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  officialFolderIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  officialRowText: { flex: 1, fontSize: 18, fontWeight: '600' },
  
  fab: { position: 'absolute', bottom: 30, right: 20, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },

  empty: { padding: 80, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: '900', marginBottom: 20 },
  modalInput: { borderWidth: 1, borderRadius: 16, padding: 16, fontSize: 16, fontWeight: '600', marginBottom: 20 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, alignItems: 'center', padding: 16 },
  modalCreate: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 16 },
});

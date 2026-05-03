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
  FolderPlus, Play, ChevronRight
} from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { ThemeSwitcher } from '../src/components/ThemeSwitcher';
import { PageWrapper } from '../src/components/PageWrapper';
import { BranchSvc, BranchNode } from '../src/services/BranchService';
import { DeckRow } from '../src/components/flashcards/DeckRow';
import { PremiumMoveModal } from '../src/components/flashcards/PremiumMoveModal';

export default function FlashcardsHub() {
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
  
  // Modals
  const [addMenuVisible, setAddMenuVisible] = useState(false);
  const [createModal, setCreateModal] = useState<{ type: 'folder' | 'deck', parentId?: string | null, parentName?: string, color?: string } | null>(null);
  const [renameModal, setRenameModal] = useState<{ node: BranchNode } | null>(null);
  const [moveModal, setMoveModal] = useState<{ node: BranchNode } | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  
  const FOLDER_COLORS = ['#bae6fd', '#e0e7ff', '#fef3c7', '#fee2e2', '#dcfce7'];
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0]);
  


  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const t = await BranchSvc.buildTree(uid);
      setTree(t);
      
      setCurrentFolder(prev => {
        if (!prev) return null;
        const flat = BranchSvc.flatten(t);
        return flat.find(n => n.id === prev.id) ?? null;
      });
    } catch (e: any) {
      console.error('[NojiHub] load error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      navLock.current = false;
    }
  }, [uid]);

  useFocusEffect(useCallback(() => { 
    navLock.current = false; 
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
      const baseDepth = currentFolder.depth + 1;
      return BranchSvc.flatten(currentFolder.children, expanded).map(n => ({
        ...n,
        depth: Math.max(0, n.depth - baseDepth)
      }));
    }
    
    return BranchSvc.flatten(tree, expanded);
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
      const pid = createModal.parentId !== undefined ? createModal.parentId : (currentFolder?.id ?? null);
      await BranchSvc.create(uid, nameDraft.trim(), pid, isFolder);
      if (pid) {
        setExpanded(prev => {
          const next = new Set(prev);
          next.add(pid);
          return next;
        });
      }
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

  const onAction = (node: BranchNode, action: string) => {
    switch (action) {
      case 'move':
        setMoveModal({ node });
        break;
      case 'rename':
        setRenameModal({ node });
        setNameDraft(node.name);
        break;
      case 'delete':
        Alert.alert('Delete?', `Are you sure you want to delete ${node.name}?`, [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive', 
            onPress: async () => {
              try {
                await BranchSvc.softDelete(node.id);
                await load();
              } catch (e: any) { Alert.alert('Delete failed', e?.message); }
            } 
          }
        ]);
        break;
      case 'add':
        setCreateModal({ type: 'deck', parentId: node.id, parentName: node.name });
        break;
      case 'settings':
        openDeck(node);
        break;
    }
  };

  const handleRename = async () => {
    if (!renameModal || !nameDraft.trim()) return;
    try {
      await BranchSvc.rename(renameModal.node.id, nameDraft.trim());
      setRenameModal(null);
      setNameDraft('');
      await load();
    } catch (e: any) { Alert.alert('Rename failed', e?.message); }
  };

  const startStudy = (mode: 'due' | 'new') => {
    router.push({
      pathname: '/flashcards/review',
      params: { 
        mode, 
        recursive: '1',
        branchId: currentFolder?.id || undefined
      }
    } as any);
  };



  return (
    <PageWrapper>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => currentFolder ? setCurrentFolder(null) : router.back()} style={styles.iconBtn}>
                <ChevronLeft size={28} color={colors.primary} />
              </TouchableOpacity>
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
              <TextInput value={search} onChangeText={setSearch} placeholder="Search..." placeholderTextColor={colors.textTertiary} style={[styles.searchInput, { color: colors.textPrimary }]} autoFocus />
              <TouchableOpacity onPress={() => { setSearch(''); setSearchVisible(false); Keyboard.dismiss(); }}><X size={16} color={colors.textTertiary} /></TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.topActionArea}>
          <View style={[styles.statsBar, { marginHorizontal: 0, width: '100%' }]}>
            <TouchableOpacity onPress={() => startStudy('due')} style={[styles.statBox, { backgroundColor: '#ef444412', borderColor: '#ef444430' }]}>
              <Clock size={14} color="#ef4444" />
              <Text style={[styles.statNum, { color: '#ef4444' }]}>{aggregateStats.due}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Due</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => startStudy('new')} style={[styles.statBox, { backgroundColor: '#3b82f612', borderColor: '#3b82f630' }]}>
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
        </View>

        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={{ paddingHorizontal: 4 }}>
            {displayRows.map((item) => (
              <View key={item.id}>
                 <DeckRow node={item} expanded={expanded.has(item.id)} onToggle={() => toggleExpand(item.id)} onOpen={() => { if (item.is_folder && item.depth === 0) setCurrentFolder(item); else openDeck(item); }} onAction={(action) => onAction(item, action)} />
              </View>
            ))}
          </View>
          {displayRows.length === 0 && (
            <View style={styles.empty}><Layers size={48} color={colors.border} /><Text style={{ color: colors.textTertiary, marginTop: 12 }}>Empty</Text></View>
          )}
        </ScrollView>

        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setAddMenuVisible(true)}>
          <Plus size={28} color="#04223a" />
        </TouchableOpacity>

        {/* Modals */}
        {/* Add Menu Modal */}
        <Modal visible={addMenuVisible} transparent animationType="fade" onRequestClose={() => setAddMenuVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setAddMenuVisible(false)}>
            <View style={[styles.addMenuContent, { backgroundColor: colors.surface }]}>
              <AddMenuItem 
                icon={<Layers size={22} color={colors.textPrimary} />} 
                title="Create deck" 
                sub="Organize flashcards into decks" 
                onPress={() => { setAddMenuVisible(false); setCreateModal({ type: 'deck' }); }} 
              />
              <AddMenuItem 
                icon={<FolderPlus size={22} color={colors.textPrimary} />} 
                title="Create folder" 
                sub="Organize decks into folders" 
                onPress={() => { setAddMenuVisible(false); setCreateModal({ type: 'folder' }); }} 
              />
            </View>
          </Pressable>
        </Modal>

        {/* Create Modal */}
        <Modal visible={!!createModal} transparent animationType="fade">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.modalOverlay}>
              <Pressable style={{ flex: 1 }} onPress={() => setCreateModal(null)} />
              <View style={[styles.createSheet, { backgroundColor: colors.surface }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                    {createModal?.type === 'folder' ? 'Create folder' : 'Create deck'}
                  </Text>
                  <TouchableOpacity onPress={() => setCreateModal(null)} style={styles.closeBtn}>
                    <X size={20} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <TextInput 
                  placeholder={createModal?.type === 'folder' ? 'Folder name' : 'Deck name'} 
                  placeholderTextColor={colors.textTertiary} 
                  style={[styles.premiumInput, { color: colors.textPrimary, backgroundColor: colors.surfaceStrong }]} 
                  value={nameDraft} 
                  onChangeText={setNameDraft} 
                  autoFocus 
                />

                {createModal?.type === 'folder' && (
                  <View style={styles.iconColorSection}>
                    <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Icon and color</Text>
                    <View style={styles.colorRow}>
                      <View style={[styles.iconBox, { backgroundColor: colors.surfaceStrong }]}>
                        <Folder size={20} color={selectedColor} />
                      </View>
                      <View style={styles.colorsList}>
                        {FOLDER_COLORS.map(c => (
                          <TouchableOpacity 
                            key={c} 
                            onPress={() => setSelectedColor(c)} 
                            style={[
                              styles.colorCircle, 
                              { backgroundColor: c },
                              selectedColor === c && { borderWidth: 2, borderColor: colors.primary }
                            ]} 
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                <TouchableOpacity 
                  onPress={handleCreate} 
                  style={[styles.bigCreateBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.bigCreateBtnTxt}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        
        <Modal visible={!!renameModal} transparent animationType="fade">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.modalOverlay}>
              <Pressable style={{ flex: 1 }} onPress={() => setRenameModal(null)} />
              <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Rename</Text>
                <TextInput placeholder="New name" placeholderTextColor={colors.textTertiary} style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]} value={nameDraft} onChangeText={setNameDraft} autoFocus />
                <View style={styles.modalBtns}>
                  <TouchableOpacity onPress={() => setRenameModal(null)} style={styles.modalCancel}><Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity onPress={handleRename} style={[styles.modalCreate, { backgroundColor: colors.primary }]}><Text style={{ color: '#04223a', fontWeight: '900' }}>Save</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <PremiumMoveModal visible={!!moveModal} node={moveModal?.node} tree={tree} onClose={() => setMoveModal(null)} onConfirm={handleMove} />
        

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
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 42, borderRadius: 12, borderWidth: 1, gap: 8, marginTop: 4 },
  searchInput: { flex: 1, fontSize: 14 },
  topActionArea: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginVertical: 16, gap: 12 },
  statsBar: { flexDirection: 'row', gap: 10, paddingVertical: 12 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1, gap: 4 },
  statNum: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  fab: { position: 'absolute', bottom: 30, right: 20, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  empty: { padding: 80, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderRadius: 24, padding: 24, width: '100%', maxWidth: 500, alignSelf: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '900', marginBottom: 20 },
  modalInput: { borderWidth: 1, borderRadius: 16, padding: 16, fontSize: 16, fontWeight: '600', marginBottom: 20 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, alignItems: 'center', padding: 16 },
  modalCreate: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 16 },
  
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addMenuContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, width: '100%', position: 'absolute', bottom: 0 },
  addMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16 },
  addItemIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addItemContent: { flex: 1 },
  addItemTitle: { fontSize: 18, fontWeight: '700' },
  addItemSub: { fontSize: 13, marginTop: 2 },
  createSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, width: '100%', position: 'absolute', bottom: 0 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f2f2f7', alignItems: 'center', justifyContent: 'center' },
  premiumInput: { height: 64, borderRadius: 20, paddingHorizontal: 20, fontSize: 18, fontWeight: '600', marginVertical: 20 },
  iconColorSection: { marginBottom: 30 },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBox: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  colorsList: { flexDirection: 'row', gap: 10, flex: 1 },
  colorCircle: { width: 44, height: 44, borderRadius: 22 },
  bigCreateBtn: { height: 64, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  bigCreateBtnTxt: { color: '#04223a', fontSize: 18, fontWeight: '900' },
});

function AddMenuItem({ icon, title, sub, onPress }: { icon: any, title: string, sub: string, onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={styles.addMenuItem}>
      <View style={[styles.addItemIcon, { backgroundColor: colors.surfaceStrong }]}>
        {icon}
      </View>
      <View style={styles.addItemContent}>
        <Text style={[styles.addItemTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.addItemSub, { color: colors.textTertiary }]}>{sub}</Text>
      </View>
      <ChevronRight size={20} color={colors.border} />
    </TouchableOpacity>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal,
  Alert, Pressable, ActivityIndicator, SafeAreaView, FlatList, Dimensions,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, router, useLocalSearchParams } from 'expo-router';
import { BackHandler } from 'react-native';
import {
  ChevronRight, Folder, FileText, Plus, PenLine, FolderInput, Trash2, Home,
  BookOpen, Search as SearchIcon, X, Grid3x3, List, ChevronLeft, Clock,
  FolderPlus, Star, PlusCircle, Sparkles, PencilLine
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePreventRemove, useNavigation } from '@react-navigation/native';
import { PremiumMoveSheet, MoveTarget } from '../../src/components/common/PremiumMoveSheet';

type NodeType = 'folder' | 'notebook' | 'note';
type Node = {
  id: string; user_id: string; parent_id: string | null;
  type: NodeType; title: string; note_id: string | null;
  is_archived: boolean; updated_at?: string; created_at?: string;
};
type ViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'notes_pro_view_mode';
const COL_GAP = 14;
const SCREEN_W = Dimensions.get('window').width;
const TILE_W = (SCREEN_W - 16 * 2 - COL_GAP) / 2; // 2 columns with 16 px screen padding

export default function NotesIndex() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ parentId?: string; title?: string }>();
  const parentId = params.parentId || null;
  const currentTitle = params.title || 'Notes';

  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [view, setView] = useState<ViewMode>('list');

  // Modals
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<NodeType>('folder');
  const [createTitle, setCreateTitle] = useState('');
  const [actionNode, setActionNode] = useState<Node | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);

  // Load saved view mode
  useEffect(() => {
    AsyncStorage.getItem(VIEW_MODE_KEY).then(v => { if (v === 'grid' || v === 'list') setView(v); });
  }, []);
  const setViewPersist = (v: ViewMode) => { setView(v); AsyncStorage.setItem(VIEW_MODE_KEY, v).catch(() => {}); };

  const refresh = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    const { data, error } = await supabase.from('user_note_nodes')
      .select('*').eq('user_id', session.user.id).eq('is_archived', false);
    if (!error) setNodes((data || []) as Node[]);
    setLoading(false);
  }, [session]);
  useEffect(() => { refresh(); }, [refresh]);
  
  const navigation = useNavigation();
  
  const currentParent = parentId;
  const inFolder = !!parentId;

  const childrenOf = useCallback((pid: string | null) => nodes.filter(n => n.parent_id === pid), [nodes]);

  // Carousel items: 5 most recently updated notes (globally or in current folder? let's do global for "Quick Access")
  const recentNotes = useMemo(() => {
    return nodes
      .filter(n => n.type === 'note' && n.note_id)
      .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
      .slice(0, 6);
  }, [nodes]);

  // visible items in current folder + optional search filter
  const visible = useMemo(() => {
    const items = childrenOf(currentParent);
    const q = search.trim().toLowerCase();
    const filtered = q ? nodes.filter(n => n.title.toLowerCase().includes(q)) : items;
    // Folders first, then notebooks, then notes — alphabetical inside each
    const order: Record<NodeType, number> = { folder: 0, notebook: 1, note: 2 };
    return [...filtered].sort((a, b) => order[a.type] - order[b.type] || a.title.localeCompare(b.title));
  }, [nodes, currentParent, search, childrenOf]);

  const moveTargets = useMemo<MoveTarget[]>(() => {
    return nodes
      .filter(n => n.type === 'folder' || n.type === 'notebook')
      .map(n => ({
        id: n.id,
        name: n.title,
        type: n.type as 'folder' | 'notebook',
        parent_id: n.parent_id,
      }));
  }, [nodes]);

  // Counts on a folder/notebook (kids count) for tile subtitle
  const countOf = (n: Node) => (n.type === 'note' ? 0 : nodes.filter(x => x.parent_id === n.id).length);

  // ─── CRUD ───
  const doCreate = async () => {
    if (!createTitle.trim() || !session?.user.id) return;
    if (createType === 'notebook' || createType === 'note') {
      const { data: note } = await supabase.from('user_notes')
        .insert({ user_id: session.user.id, subject: 'General', title: createTitle.trim(), items: [] })
        .select().single();
      await supabase.from('user_note_nodes').insert({
        user_id: session.user.id, parent_id: currentParent, type: createType,
        title: createTitle.trim(), note_id: note?.id,
      });
    } else {
      await supabase.from('user_note_nodes').insert({
        user_id: session.user.id, parent_id: currentParent, type: createType,
        title: createTitle.trim(),
      });
    }
    setCreateOpen(false); setCreateTitle('');
    refresh();
  };

  const doRename = async () => {
    if (!actionNode || !renameValue.trim() || !session?.user.id) return;
    const { error } = await supabase.rpc('rename_note_node', {
      p_node_id: actionNode.id, p_user_id: session.user.id, p_title: renameValue.trim(),
    });
    if (error) { Alert.alert('Rename failed', error.message); return; }
    setRenameOpen(false); setActionNode(null); refresh();
  };

  const doMove = async (newParentId: string | null) => {
    if (!actionNode || !session?.user.id) return;
    const { error } = await supabase.rpc('move_note_node', {
      p_node_id: actionNode.id, p_user_id: session.user.id, p_new_parent_id: newParentId,
    });
    if (error) { Alert.alert('Move failed', error.message); return; }
    setMoveOpen(false); setActionNode(null); refresh();
  };

  const doDuplicate = async (n: Node) => {
    if (!session?.user.id) return;
    try {
      if (n.type === 'note' && n.note_id) {
        const { data: src } = await supabase.from('user_notes').select('*').eq('id', n.note_id).single();
        const { data: clone } = await supabase.from('user_notes').insert({
          user_id: session.user.id, subject: src?.subject || 'General',
          title: `${src?.title || n.title} (copy)`,
          items: src?.items || [],
        }).select().single();
        await supabase.from('user_note_nodes').insert({
          user_id: session.user.id, parent_id: n.parent_id, type: 'note',
          title: `${n.title} (copy)`, note_id: clone?.id,
        });
      } else {
        await supabase.from('user_note_nodes').insert({
          user_id: session.user.id, parent_id: n.parent_id, type: n.type,
          title: `${n.title} (copy)`,
        });
      }
      setActionNode(null); refresh();
    } catch (e: any) { Alert.alert('Duplicate failed', e?.message || ''); }
  };

  const doDelete = () => {
    if (!actionNode || !session?.user.id) return;
    Alert.alert('Delete?', `Permanently delete "${actionNode.title}" and everything inside?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('delete_note_node_cascade', {
            p_node_id: actionNode.id, p_user_id: session.user.id,
          });
          if (error) { Alert.alert('Delete failed', error.message); return; }
          setActionNode(null); refresh();
        }
      },
    ]);
  };

  const openNode = (n: Node) => {
    if ((n.type === 'note' || n.type === 'notebook') && n.note_id) {
      router.push({ pathname: '/notes/editor', params: { id: n.note_id, title: n.title } });
    } else if (n.type === 'folder') {
      router.push({ pathname: '/notes', params: { parentId: n.id, title: n.title } });
    }
  };

  const back = () => router.back();

  const iconFor = (n: Node, size = 22) => {
    if (n.type === 'note') return <FileText size={size} color={colors.primary} />;
    if (n.type === 'notebook') return <BookOpen size={size} color="#10b981" />;
    return <Folder size={size} color="#f59e0b" />;
  };

  // ─── Renderers ───
  const renderTile = ({ item: n }: { item: Node }) => (
    <TouchableOpacity
      style={[styles.tile, { borderColor: colors.border, width: TILE_W }]}
      onPress={() => openNode(n)}
      onLongPress={() => setActionNode(n)}
      delayLongPress={300}
      testID={`tile-${n.id}`}
    >
      <LinearGradient
        colors={[colors.surface + '80', colors.surface + '30']}
        style={styles.tileGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.tileIconWrap}>{iconFor(n, 36)}</View>
        <Text numberOfLines={2} style={[styles.tileTitle, { color: colors.textPrimary }]}>{n.title}</Text>
        <View style={styles.tileMeta}>
          <Text style={[styles.tileMetaText, { color: colors.textTertiary }]}>
            {n.type === 'note' ? 'Note' : `${countOf(n)} item${countOf(n) === 1 ? '' : 's'}`}
          </Text>
          <TouchableOpacity onPress={() => setActionNode(n)} hitSlop={8} testID={`tile-menu-${n.id}`}>
            <Text style={{ color: colors.textTertiary, fontSize: 18, fontWeight: '900' }}>⋯</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderRow = ({ item: n }: { item: Node }) => (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => openNode(n)}
      onLongPress={() => setActionNode(n)}
      delayLongPress={300}
      testID={`row-${n.id}`}
    >
      <LinearGradient
        colors={[colors.surface + '60', 'transparent']}
        style={styles.rowGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.rowIconWrap}>{iconFor(n, 26)}</View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>{n.title}</Text>
          <Text style={[styles.rowSub, { color: colors.textTertiary }]} numberOfLines={1}>
            {n.type === 'note' ? 'Note' : `${countOf(n)} item${countOf(n) === 1 ? '' : 's'}`}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setActionNode(n)} hitSlop={10} style={styles.rowMenu} testID={`row-menu-${n.id}`}>
          <Text style={{ color: colors.textTertiary, fontSize: 22, fontWeight: '900' }}>⋯</Text>
        </TouchableOpacity>
        <ChevronRight size={16} color={colors.textTertiary} style={{ marginLeft: 4 }} />
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderCarouselItem = ({ item: n }: { item: Node }) => (
    <TouchableOpacity
      style={[styles.carouselCard, { borderColor: colors.primary + '30' }]}
      onPress={() => openNode(n)}
    >
      <LinearGradient
        colors={[colors.primary + '15', 'transparent']}
        style={styles.carouselGradient}
      >
        <FileText size={20} color={colors.primary} />
        <Text style={[styles.carouselTitle, { color: colors.textPrimary }]} numberOfLines={2}>{n.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
          <Clock size={10} color={colors.textTertiary} />
          <Text style={[styles.carouselMeta, { color: colors.textTertiary }]}>
            {new Date(n.updated_at || 0).toLocaleDateString()}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (loading) return <View style={[styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.primary} /></View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.iconBtn} 
          testID="btn-back"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={28} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 17, marginLeft: -4 }}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowSearch(v => !v)} style={styles.iconBtnRight} testID="btn-search">
          <SearchIcon size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Big title */}
      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
        <Text style={[styles.bigTitle, { color: colors.textPrimary }]}>{currentTitle}</Text>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SearchIcon size={16} color={colors.textTertiary} />
          <TextInput
            value={search} onChangeText={setSearch}
            placeholder="Search notes…"
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            autoFocus
            testID="search-input"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}><X size={16} color={colors.textTertiary} /></TouchableOpacity>
          )}
        </View>
      )}

      {/* Header Scrollable Content */}
      <FlatList
        data={visible}
        keyExtractor={(n) => n.id}
        numColumns={view === 'grid' ? 2 : 1}
        key={view} // Force re-render when switching columns
        columnWrapperStyle={view === 'grid' ? { gap: COL_GAP, paddingHorizontal: 16 } : null}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <>
            {/* Quick Access Carousel */}
            {!search && !inFolder && recentNotes.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>QUICK ACCESS</Text>
                  <Clock size={14} color={colors.textTertiary} />
                </View>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={recentNotes}
                  keyExtractor={(n) => `carousel-${n.id}`}
                  renderItem={renderCarouselItem}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                />
              </View>
            )}

            {/* View toggle row */}
            <View style={styles.toolRow}>
              <Text style={[styles.countLabel, { color: colors.textTertiary }]}>
                {visible.length} item{visible.length === 1 ? '' : 's'}
              </Text>
              <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.segmentBtn, view === 'list' && { backgroundColor: colors.primary }]}
                  onPress={() => setViewPersist('list')}
                  testID="seg-list"
                >
                  <List size={16} color={view === 'list' ? '#04223a' : colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, view === 'grid' && { backgroundColor: colors.primary }]}
                  onPress={() => setViewPersist('grid')}
                  testID="seg-grid"
                >
                  <Grid3x3 size={16} color={view === 'grid' ? '#04223a' : colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {visible.length === 0 && (
              <View style={styles.center}>
                <Text style={{ color: colors.textTertiary, textAlign: 'center', maxWidth: 240 }}>
                  {search ? `No matches for "${search}"` : 'Empty here. Tap + to create a folder, notebook, or note.'}
                </Text>
              </View>
            )}
          </>
        )}
        renderItem={view === 'grid' ? renderTile : renderRow}
      />

      {/* ADD MENU */}
      <Modal visible={addMenuOpen} transparent animationType="fade" onRequestClose={() => setAddMenuOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setAddMenuOpen(false)}>
          <View style={[styles.addMenuContent, { backgroundColor: colors.surface }]}>
            <AddMenuItem 
              icon={<FolderPlus size={22} color="#f59e0b" />} 
              title="Create Folder" 
              sub="Organize your notes into folders" 
              onPress={() => { setAddMenuOpen(false); setCreateType('folder'); setCreateOpen(true); }} 
            />
            <AddMenuItem 
              icon={<BookOpen size={22} color="#10b981" />} 
              title="Create Notebook" 
              sub="A collection of related notes" 
              onPress={() => { setAddMenuOpen(false); setCreateType('notebook'); setCreateOpen(true); }} 
            />
          </View>
        </Pressable>
      </Modal>

      {/* CREATE SHEET */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.overlay}>
            <Pressable style={{ flex: 1 }} onPress={() => setCreateOpen(false)} />
            <View style={[styles.createSheet, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.dialogTitle, { color: colors.textPrimary }]}>
                  {createType === 'folder' ? 'New Folder' : createType === 'notebook' ? 'New Notebook' : 'New Note'}
                </Text>
                <TouchableOpacity onPress={() => setCreateOpen(false)} style={styles.closeBtn}>
                  <X size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <TextInput 
                testID="create-title-input" 
                value={createTitle} 
                onChangeText={setCreateTitle} 
                placeholder="Enter title..." 
                placeholderTextColor={colors.textTertiary}
                style={[styles.premiumInput, { color: colors.textPrimary, backgroundColor: colors.surfaceStrong }]} 
                autoFocus 
              />

              <TouchableOpacity 
                testID="create-confirm" 
                onPress={doCreate} 
                style={[styles.bigCreateBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.bigCreateBtnTxt}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ACTION SHEET */}
      <Modal transparent visible={!!actionNode && !renameOpen && !moveOpen} animationType="fade" onRequestClose={() => setActionNode(null)}>
        <Pressable style={styles.overlay} onPress={() => setActionNode(null)}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]} numberOfLines={1}>{actionNode?.title}</Text>

            <AddMenuItem 
              icon={<Plus size={22} color={colors.primary} />} 
              title="Add inside" 
              sub="Create a new item in this folder" 
              onPress={() => {
                router.push({ pathname: '/notes', params: { parentId: actionNode!.id, title: actionNode!.title } });
                setActionNode(null); setCreateType('folder'); setCreateOpen(true);
              }} 
            />
            <TouchableOpacity testID="act-rename" style={styles.sheetItem} onPress={() => { setRenameValue(actionNode!.title); setRenameOpen(true); }}>
              <PenLine size={18} color="#3B82F6" /><Text style={[styles.sheetText, { color: colors.textPrimary }]}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="act-move" style={styles.sheetItem} onPress={() => setMoveOpen(true)}>
              <FolderInput size={18} color="#10B981" /><Text style={[styles.sheetText, { color: colors.textPrimary }]}>Move</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="act-duplicate" style={styles.sheetItem} onPress={() => doDuplicate(actionNode!)}>
              <FileText size={18} color="#A855F7" /><Text style={[styles.sheetText, { color: colors.textPrimary }]}>Duplicate</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="act-delete" style={styles.sheetItem} onPress={doDelete}>
              <Trash2 size={18} color="#EF4444" /><Text style={[styles.sheetText, { color: '#EF4444' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* RENAME */}
      <Modal transparent visible={renameOpen} animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { backgroundColor: colors.surface }]}>
            <Text style={[styles.dialogTitle, { color: colors.textPrimary }]}>Rename</Text>
            <TextInput testID="rename-input" value={renameValue} onChangeText={setRenameValue} autoFocus
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]} />
            <View style={styles.dialogActions}>
              <TouchableOpacity onPress={() => setRenameOpen(false)}><Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity testID="rename-save" onPress={doRename}><Text style={{ color: colors.primary, fontWeight: '900' }}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PremiumMoveSheet
        visible={moveOpen}
        title={`Move "${actionNode?.title}" to…`}
        targets={moveTargets.filter(f => f.id !== actionNode?.id)}
        currentSelectedId={actionNode?.parent_id}
        onClose={() => setMoveOpen(false)}
        onConfirm={doMove}
      />
      <TouchableOpacity testID="btn-create" style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setAddMenuOpen(true)}>
        <Plus size={28} color="#04223a" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 44 },
  iconBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
  iconBtnRight: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  bigTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  searchBar: { marginHorizontal: 16, marginBottom: 6, height: 40, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  toolRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, marginBottom: 8 },
  countLabel: { fontSize: 12, fontWeight: '700' },
  segment: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, padding: 2 },
  segmentBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  
  // Section Header for Carousel
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },

  // Carousel
  carouselCard: { width: 160, height: 110, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  carouselGradient: { flex: 1, padding: 16 },
  carouselTitle: { fontSize: 14, fontWeight: '800', marginTop: 8 },
  carouselMeta: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase' },

  // Tiles (grid) - Glassmorphism
  tile: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', minHeight: 130 },
  tileGradient: { flex: 1, padding: 16, gap: 10 },
  tileIconWrap: { height: 44, justifyContent: 'flex-start' },
  tileTitle: { fontSize: 14, fontWeight: '800', minHeight: 36 },
  tileMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tileMetaText: { fontSize: 11, fontWeight: '700' },
  
  // Rows (list) - Glassmorphism
  row: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  rowGradient: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  rowIconWrap: { width: 38, alignItems: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowSub: { fontSize: 12, marginTop: 3, fontWeight: '500' },
  rowMenu: { paddingHorizontal: 8, paddingVertical: 4 },
  
  // FAB
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10 },
  
  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  dialog: { borderRadius: 16, padding: 20, gap: 12 },
  dialogTitle: { fontSize: 20, fontWeight: '900' },
  dialogActions: { flexDirection: 'row', gap: 18, justifyContent: 'flex-end', marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  sheet: { borderRadius: 20, padding: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '900', marginBottom: 8 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4 },
  sheetText: { fontSize: 15, fontWeight: '700', flex: 1 },

  // Premium Add Menu
  addMenuContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, width: '100%' },
  addMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16 },
  addItemIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addItemContent: { flex: 1 },
  addItemTitle: { fontSize: 17, fontWeight: '800' },
  addItemSub: { fontSize: 13, marginTop: 2 },
  
  // Premium Create Sheet
  createSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, width: '100%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f2f2f7', alignItems: 'center', justifyContent: 'center' },
  premiumInput: { height: 60, borderRadius: 18, paddingHorizontal: 20, fontSize: 17, fontWeight: '600', marginVertical: 24 },
  bigCreateBtn: { height: 60, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  bigCreateBtnTxt: { color: '#04223a', fontSize: 17, fontWeight: '900' },
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

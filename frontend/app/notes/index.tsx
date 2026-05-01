import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal, Alert, Pressable, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Folder, FolderOpen, FileText, Plus, PenLine, FolderInput, Trash2, Home, BookOpen } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';

type NodeType = 'folder' | 'notebook' | 'note';
type Node = { id: string; user_id: string; parent_id: string | null; type: NodeType; title: string; note_id: string | null; is_archived: boolean; };

export default function NotesIndex() {
  const { colors } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [currentParent, setCurrentParent] = useState<string | null>(null);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<NodeType>('folder');
  const [createTitle, setCreateTitle] = useState('');

  // Action sheet + rename + move
  const [actionNode, setActionNode] = useState<Node | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    const { data, error } = await supabase.from('user_note_nodes')
      .select('*').eq('user_id', session.user.id).eq('is_archived', false);
    if (!error) setNodes((data || []) as Node[]);
    setLoading(false);
  }, [session]);

  useEffect(() => { refresh(); }, [refresh]);

  const childrenOf = useCallback((pid: string | null) => nodes.filter(n => n.parent_id === pid), [nodes]);

  const moveTargets = useMemo(
    () => nodes.filter(n => n.type === 'folder' || n.type === 'notebook'),
    [nodes]
  );

  // CREATE
  const doCreate = async () => {
    if (!createTitle.trim() || !session?.user.id) return;
    if (createType === 'note') {
      const { data: note } = await supabase.from('user_notes')
        .insert({ user_id: session.user.id, subject: 'General', title: createTitle.trim(), items: [] })
        .select().single();
      await supabase.from('user_note_nodes').insert({
        user_id: session.user.id, parent_id: currentParent, type: 'note',
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

  // RENAME
  const doRename = async () => {
    if (!actionNode || !renameValue.trim() || !session?.user.id) return;
    const { error } = await supabase.rpc('rename_note_node', {
      p_node_id: actionNode.id, p_user_id: session.user.id, p_title: renameValue.trim(),
    });
    if (error) { Alert.alert('Rename failed', error.message); return; }
    setRenameOpen(false); setActionNode(null);
    refresh();
  };

  // MOVE
  const doMove = async (newParentId: string | null) => {
    if (!actionNode || !session?.user.id) return;
    const { error } = await supabase.rpc('move_note_node', {
      p_node_id: actionNode.id, p_user_id: session.user.id, p_new_parent_id: newParentId,
    });
    if (error) { Alert.alert('Move failed', error.message); return; }
    setMoveOpen(false); setActionNode(null);
    refresh();
  };

  // DELETE
  const doDelete = () => {
    if (!actionNode || !session?.user.id) return;
    Alert.alert('Delete?', `Permanently delete "${actionNode.title}" and everything inside?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('delete_note_node_cascade', {
            p_node_id: actionNode.id, p_user_id: session.user.id,
          });
          if (error) { Alert.alert('Delete failed', error.message); return; }
          setActionNode(null);
          refresh();
        }
      },
    ]);
  };

  const openNode = (n: Node) => {
    if (n.type === 'note' && n.note_id) {
      router.push({ pathname: '/notes/editor', params: { id: n.note_id } });
    } else {
      setExpanded(prev => ({ ...prev, [n.id]: !prev[n.id] }));
    }
  };

  const renderNode = (n: Node, depth = 0) => {
    const isOpen = expanded[n.id];
    const kids = n.type !== 'note' ? childrenOf(n.id) : [];
    const Icon = n.type === 'note' ? FileText : n.type === 'notebook' ? BookOpen : (isOpen ? FolderOpen : Folder);
    return (
      <View key={n.id}>
        <View style={[styles.row, { paddingLeft: 12 + depth * 18, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity testID={`node-${n.id}`} onPress={() => openNode(n)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
            {n.type !== 'note' && <ChevronRight size={14} color={colors.textTertiary} style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }} />}
            <Icon size={18} color={colors.primary} />
            <Text style={{ color: colors.textPrimary, fontWeight: '700', flex: 1 }} numberOfLines={1}>{n.title}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID={`node-menu-${n.id}`} onPress={() => setActionNode(n)} style={styles.menuBtn}>
            <Text style={{ color: colors.textTertiary, fontSize: 22, fontWeight: '900' }}>⋯</Text>
          </TouchableOpacity>
        </View>
        {isOpen && kids.map(k => renderNode(k, depth + 1))}
      </View>
    );
  };

  if (loading) return <View style={[styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Notes</Text>
        <TouchableOpacity testID="create-btn" onPress={() => { setCreateType('folder'); setCurrentParent(null); setCreateOpen(true); }} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
          <Plus size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800' }}>New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {childrenOf(null).map(n => renderNode(n))}
        {childrenOf(null).length === 0 && (
          <View style={styles.center}><Text style={{ color: colors.textTertiary }}>No folders yet. Tap + New to create one.</Text></View>
        )}
      </ScrollView>

      {/* CREATE modal */}
      <Modal transparent visible={createOpen} animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setCreateOpen(false)}>
          <View style={[styles.dialog, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.dialogTitle, { color: colors.textPrimary }]}>Create</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['folder', 'notebook', 'note'] as NodeType[]).map(t => (
                <TouchableOpacity key={t} testID={`create-type-${t}`} onPress={() => setCreateType(t)}
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: createType === t ? colors.primary : 'transparent' }]}>
                  <Text style={{ color: createType === t ? '#fff' : colors.textPrimary, fontWeight: '800', fontSize: 12 }}>{t.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput testID="create-title-input" value={createTitle} onChangeText={setCreateTitle} placeholder="Title…" placeholderTextColor={colors.textTertiary}
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]} autoFocus />
            <View style={styles.dialogActions}>
              <TouchableOpacity onPress={() => setCreateOpen(false)}><Text style={{ color: colors.textSecondary }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity testID="create-confirm" onPress={doCreate}><Text style={{ color: colors.primary, fontWeight: '900' }}>Create</Text></TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ACTION SHEET — tappable buttons (no long-press) */}
      <Modal transparent visible={!!actionNode && !renameOpen && !moveOpen} animationType="fade" onRequestClose={() => setActionNode(null)}>
        <Pressable style={styles.overlay} onPress={() => setActionNode(null)}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]} numberOfLines={1}>{actionNode?.title}</Text>

            {actionNode?.type !== 'note' && (
              <TouchableOpacity testID="act-add-child" style={styles.sheetItem} onPress={() => {
                setCurrentParent(actionNode!.id); setActionNode(null); setCreateType('folder'); setCreateOpen(true);
              }}>
                <Plus size={18} color={colors.primary} /><Text style={[styles.sheetText, { color: colors.textPrimary }]}>Add inside</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity testID="act-rename" style={styles.sheetItem} onPress={() => { setRenameValue(actionNode!.title); setRenameOpen(true); }}>
              <PenLine size={18} color="#3B82F6" /><Text style={[styles.sheetText, { color: colors.textPrimary }]}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="act-move" style={styles.sheetItem} onPress={() => setMoveOpen(true)}>
              <FolderInput size={18} color="#10B981" /><Text style={[styles.sheetText, { color: colors.textPrimary }]}>Move</Text>
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
              <TouchableOpacity onPress={() => setRenameOpen(false)}><Text style={{ color: colors.textSecondary }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity testID="rename-save" onPress={doRename}><Text style={{ color: colors.primary, fontWeight: '900' }}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MOVE PICKER — all folders/notebooks + Root */}
      <Modal transparent visible={moveOpen} animationType="slide" onRequestClose={() => setMoveOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setMoveOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.surface, maxHeight: '80%' }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Move "{actionNode?.title}" to…</Text>
            <ScrollView>
              <TouchableOpacity testID="move-root" style={styles.sheetItem} onPress={() => doMove(null)}>
                <Home size={16} color={colors.primary} /><Text style={[styles.sheetText, { color: colors.textPrimary }]}>Root (top level)</Text>
              </TouchableOpacity>
              {moveTargets.filter(f => f.id !== actionNode?.id).map(f => (
                <TouchableOpacity key={f.id} testID={`move-to-${f.id}`} style={styles.sheetItem} onPress={() => doMove(f.id)}>
                  {f.type === 'notebook' ? <BookOpen size={16} color={colors.primary} /> : <Folder size={16} color={colors.primary} />}
                  <Text style={[styles.sheetText, { color: colors.textPrimary }]} numberOfLines={1}>{f.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setMoveOpen(false)} style={{ padding: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 22, fontWeight: '900' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  menuBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  dialog: { borderRadius: 16, padding: 20, gap: 12 },
  dialogTitle: { fontSize: 18, fontWeight: '900' },
  dialogActions: { flexDirection: 'row', gap: 16, justifyContent: 'flex-end', marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  sheet: { borderRadius: 20, padding: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '900', marginBottom: 8 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4 },
  sheetText: { fontSize: 15, fontWeight: '700', flex: 1 },
});

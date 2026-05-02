/**
 * NotebookLocationPicker — popup tree picker for the in-engine notebook editor.
 * Shows the user's notes hierarchy (Folders → Notebooks). Tap to select a
 * notebook directly, or pick a folder and tap "Create new notebook here".
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { ChevronDown, ChevronRight, Folder, BookOpen, Plus, X, Home } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

type NodeType = 'folder' | 'notebook' | 'note';
type Node = {
  id: string; user_id: string; parent_id: string | null;
  type: NodeType; title: string; note_id: string | null; is_archived: boolean;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string;
  /** Called when user taps an existing notebook. Receives the underlying user_notes.id. */
  onPickNotebook: (notebook: { node_id: string; note_id: string; title: string; folder_id: string | null }) => void;
}

export function NotebookLocationPicker({ visible, onClose, userId, onPickNotebook }: Props) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pickedFolderId, setPickedFolderId] = useState<string | null | undefined>(undefined);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase.from('user_note_nodes')
      .select('*').eq('user_id', userId).eq('is_archived', false);
    if (!error) setNodes((data || []) as Node[]);
    setLoading(false);
  };

  useEffect(() => {
    if (visible) {
      setPickedFolderId(undefined);
      setNewName('');
      refresh();
    }
  }, [visible, userId]);

  const childrenOf = (pid: string | null) => nodes.filter(n => n.parent_id === pid);
  const folders = useMemo(() => nodes.filter(n => n.type === 'folder'), [nodes]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pickNotebook = (n: Node) => {
    if (!n.note_id) return;
    onPickNotebook({ node_id: n.id, note_id: n.note_id, title: n.title, folder_id: n.parent_id });
    onClose();
  };

  const createNotebookHere = async () => {
    const title = newName.trim();
    if (!title) return;
    setCreating(true);
    try {
      const { data: note, error: noteErr } = await supabase.from('user_notes')
        .insert({ user_id: userId, subject: 'General', title, items: [] })
        .select().single();
      if (noteErr) throw noteErr;
      const { data: nodeRow, error: nodeErr } = await supabase.from('user_note_nodes')
        .insert({ user_id: userId, parent_id: pickedFolderId ?? null, type: 'notebook', title, note_id: note?.id })
        .select().single();
      if (nodeErr) throw nodeErr;
      onPickNotebook({ node_id: nodeRow!.id, note_id: note!.id, title, folder_id: pickedFolderId ?? null });
      onClose();
    } catch (e: any) {
      Alert.alert('Could not create notebook', e?.message || '');
    } finally { setCreating(false); }
  };

  const renderNode = (n: Node, depth = 0) => {
    if (n.type === 'note') return null;
    const kids = childrenOf(n.id);
    const isOpen = expanded.has(n.id);
    const isSelectedFolder = n.type === 'folder' && pickedFolderId === n.id;
    return (
      <View key={n.id}>
        <View style={[s.row, { borderBottomColor: colors.border, paddingLeft: 14 + depth * 16 }]}>
          {n.type === 'folder' ? (
            <TouchableOpacity onPress={() => toggle(n.id)} style={s.chev}>
              {isOpen ? <ChevronDown size={16} color={colors.textSecondary} /> : <ChevronRight size={16} color={colors.textSecondary} />}
            </TouchableOpacity>
          ) : <View style={s.chev} />}
          <TouchableOpacity
            style={s.label}
            onPress={() => n.type === 'notebook' ? pickNotebook(n) : setPickedFolderId(isSelectedFolder ? undefined : n.id)}
            testID={`loc-${n.id}`}
          >
            {n.type === 'notebook'
              ? <BookOpen size={18} color="#10b981" />
              : <Folder size={18} color={isSelectedFolder ? colors.primary : '#f59e0b'} />}
            <Text
              style={[s.labelText, { color: colors.textPrimary }, isSelectedFolder && { color: colors.primary, fontWeight: '900' }]}
              numberOfLines={1}
            >{n.title}</Text>
            {n.type === 'notebook' && <Text style={[s.hint, { color: colors.textTertiary }]}>Tap to use</Text>}
            {isSelectedFolder && <Text style={[s.hint, { color: colors.primary }]}>Selected ✓</Text>}
          </TouchableOpacity>
        </View>
        {isOpen && kids.map(k => renderNode(k, depth + 1))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: colors.bg, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
          <View style={[s.head, { borderBottomColor: colors.border }]}>
            <Text style={[s.title, { color: colors.textPrimary }]}>Choose location</Text>
            <TouchableOpacity onPress={onClose}><X size={22} color={colors.textPrimary} /></TouchableOpacity>
          </View>

          <View style={[s.rootBar, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={[s.rootChip, pickedFolderId === null && { backgroundColor: colors.primary + '15', borderColor: colors.primary }, { borderColor: colors.border }]}
              onPress={() => setPickedFolderId(pickedFolderId === null ? undefined : null)}
            >
              <Home size={14} color={pickedFolderId === null ? colors.primary : colors.textSecondary} />
              <Text style={{ color: pickedFolderId === null ? colors.primary : colors.textSecondary, fontWeight: '800', fontSize: 12 }}>
                Root {pickedFolderId === null ? '✓' : ''}
              </Text>
            </TouchableOpacity>
            <Text style={{ color: colors.textTertiary, fontSize: 11, flex: 1, textAlign: 'right' }}>
              Tap a notebook to use it, or a folder to create a new one inside it.
            </Text>
          </View>

          {loading ? (
            <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
          ) : nodes.length === 0 ? (
            <View style={{ padding: 30, alignItems: 'center' }}>
              <Text style={{ color: colors.textTertiary, textAlign: 'center', maxWidth: 240 }}>
                No notes structure yet. Pick "Root" above and create your first notebook below.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 320 }}>
              {childrenOf(null).map(n => renderNode(n))}
            </ScrollView>
          )}

          {pickedFolderId !== undefined && (
            <View style={[s.createWrap, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={[s.createLbl, { color: colors.textTertiary }]}>
                CREATE NEW NOTEBOOK IN: {pickedFolderId === null ? 'Root' : (folders.find(f => f.id === pickedFolderId)?.title || 'Folder')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Notebook name…"
                  placeholderTextColor={colors.textTertiary}
                  style={[s.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                  onSubmitEditing={createNotebookHere}
                  autoFocus
                />
                <TouchableOpacity
                  onPress={createNotebookHere}
                  disabled={creating || !newName.trim()}
                  style={[s.createBtn, { backgroundColor: colors.primary, opacity: creating || !newName.trim() ? 0.5 : 1 }]}
                >
                  {creating
                    ? <ActivityIndicator color="#04223a" size="small" />
                    : <><Plus size={14} color="#04223a" /><Text style={{ color: '#04223a', fontWeight: '900', fontSize: 12 }}>Create</Text></>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', borderTopWidth: 1, minHeight: '50%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '900' },
  rootBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  rootChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingRight: 12, minHeight: 46 },
  chev: { width: 28, alignItems: 'center', justifyContent: 'center', height: 46 },
  label: { flex: 1, height: 46, flexDirection: 'row', alignItems: 'center', gap: 10 },
  labelText: { fontSize: 14, fontWeight: '700', flex: 1 },
  hint: { fontSize: 10, fontWeight: '700' },
  createWrap: { padding: 14, borderTopWidth: 1 },
  createLbl: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  input: { flex: 1, height: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  createBtn: { height: 40, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
});

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
    try {
      const { data, error } = await supabase.from('user_note_nodes')
        .select('*').eq('user_id', userId).eq('is_archived', false);
      if (!error) setNodes((data || []) as Node[]);
    } finally {
      setLoading(false);
    }
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
    const indent = depth * 24;

    return (
      <View key={n.id}>
        <TouchableOpacity 
          onPress={() => {
            if (n.type === 'notebook') pickNotebook(n);
            else {
              toggle(n.id);
              setPickedFolderId(isSelectedFolder ? undefined : n.id);
            }
          }}
          style={[
            s.row, 
            { paddingLeft: 16 + indent },
            isSelectedFolder && { backgroundColor: colors.primary + '10', borderRadius: 12 }
          ]}
        >
          <View style={s.chev}>
            {n.type === 'folder' && kids.length > 0 ? (
              isOpen ? <ChevronDown size={18} color={colors.textTertiary} /> : <ChevronRight size={18} color={colors.textTertiary} />
            ) : <View style={{ width: 18 }} />}
          </View>
          
          <View style={s.iconWrap}>
            {n.type === 'notebook' 
              ? <BookOpen size={20} color="#10b981" /> 
              : <Folder size={20} color={isSelectedFolder ? colors.primary : '#f59e0b'} />}
          </View>
          
          <Text style={[s.labelText, { color: colors.textPrimary }, isSelectedFolder && { color: colors.primary, fontWeight: '900' }]} numberOfLines={1}>
            {n.title}
          </Text>
          
          {n.type === 'notebook' && (
            <View style={[s.tag, { backgroundColor: '#10b98120' }]}>
              <Text style={{ color: '#10b981', fontSize: 9, fontWeight: '900' }}>SELECT</Text>
            </View>
          )}
        </TouchableOpacity>
        {isOpen && kids.map(k => renderNode(k, depth + 1))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: colors.surface }]}>
          <View style={s.handle} />
          
          <View style={s.head}>
            <View style={{ width: 40 }} />
            <Text style={[s.title, { color: colors.textPrimary }]}>Choose Location</Text>
            <TouchableOpacity onPress={onClose} style={[s.closeBtn, { backgroundColor: colors.border + '40' }]}>
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={{ padding: 10 }}>
              <TouchableOpacity
                style={[s.row, { paddingLeft: 16 }, pickedFolderId === null && { backgroundColor: colors.primary + '10', borderRadius: 12 }]}
                onPress={() => setPickedFolderId(pickedFolderId === null ? undefined : null)}
              >
                <View style={s.chev}><View style={{ width: 18 }} /></View>
                <View style={s.iconWrap}><Home size={20} color={colors.primary} /></View>
                <Text style={[s.labelText, { color: colors.textPrimary }, pickedFolderId === null && { color: colors.primary, fontWeight: '900' }]}>
                  Home (Root)
                </Text>
              </TouchableOpacity>

              {loading ? (
                <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
              ) : (
                childrenOf(null).map(n => renderNode(n))
              )}
            </View>
          </ScrollView>

          {pickedFolderId !== undefined && (
            <View style={[s.createBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <Text style={[s.createTitle, { color: colors.textTertiary }]}>
                NEW NOTEBOOK IN: <Text style={{ color: colors.textPrimary }}>{pickedFolderId === null ? 'ROOT' : (folders.find(f => f.id === pickedFolderId)?.title.toUpperCase() || 'FOLDER')}</Text>
              </Text>
              <View style={s.inputRow}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Notebook Name..."
                  placeholderTextColor={colors.textTertiary}
                  style={[s.input, { color: colors.textPrimary, borderColor: colors.border }]}
                  onSubmitEditing={createNotebookHere}
                  autoFocus
                />
                <TouchableOpacity
                  onPress={createNotebookHere}
                  disabled={creating || !newName.trim()}
                  style={[s.confirmBtn, { backgroundColor: colors.primary, opacity: creating || !newName.trim() ? 0.6 : 1 }]}
                >
                  {creating ? <ActivityIndicator color="#fff" size="small" /> : <Plus size={20} color="#fff" />}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20 },
  sheet: { width: '94%', maxWidth: 500, height: '80%', borderRadius: 40, overflow: 'hidden', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 10 },
  title: { fontSize: 19, fontWeight: '900' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingRight: 16, marginBottom: 2 },
  chev: { width: 28, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  labelText: { fontSize: 15, fontWeight: '700', flex: 1 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  createBox: { margin: 16, padding: 16, borderRadius: 24, borderWidth: 1 },
  createTitle: { fontSize: 10, fontWeight: '900', marginBottom: 12, letterSpacing: 0.5 },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, height: 48, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, fontSize: 15 },
  confirmBtn: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});

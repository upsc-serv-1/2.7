/**
 * AddToFlashcardSheet — universal "Add to Flashcard" sheet shown across the app
 * (quiz engine, analyse section, repo cards, attempt result, notes editor).
 *
 * Two modes:
 *   1. AUTO  → builds Subject → Section Group → Microtopic hierarchy and drops
 *              the card into the leaf branch (creating branches if needed).
 *   2. MANUAL → opens the user's full deck tree to pick a destination.
 *               Includes inline "+ Create new deck here" affordance.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Pressable, TextInput, Alert,
} from 'react-native';
import { ChevronDown, ChevronRight, Plus, Sparkles, FolderTree, X, Check } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { BranchSvc, BranchNode } from '../../services/BranchService';
import { BranchPlacement, PlacementHint } from '../../services/BranchPlacement';

export interface AddToFlashcardSheetProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  /** Card already created in DB (we only need its id to link). */
  cardId: string | null;
  /** Hint values for auto placement (Subject/Section/Microtopic). */
  hint: PlacementHint;
  /** Called once placement succeeds. Receives the destination path label. */
  onPlaced?: (pathLabel: string) => void;
  /** When set, the sheet operates in MOVE mode: it removes the card from
   *  `fromBranchId` after adding to the chosen destination. The "Auto" choice
   *  is hidden in this mode. */
  fromBranchId?: string | null;
  /** Custom title override (e.g. "Move card"). */
  title?: string;
}

type Mode = 'choose' | 'auto-busy' | 'manual';

export function AddToFlashcardSheet(props: AddToFlashcardSheetProps) {
  const { visible, onClose, userId, cardId, hint, onPlaced, fromBranchId, title } = props;
  const isMoveMode = !!fromBranchId;
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>('choose');
  const [tree, setTree] = useState<BranchNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingTree, setLoadingTree] = useState(false);
  const [placingId, setPlacingId] = useState<string | null>(null);

  // Inline "create deck" state
  const [createParentId, setCreateParentId] = useState<string | null | undefined>(undefined);
  const [newName, setNewName] = useState('');

  // Reset on each open. In MOVE mode, jump straight to manual picker.
  useEffect(() => {
    if (visible) {
      setMode(isMoveMode ? 'manual' : 'choose');
      setNewName('');
      setCreateParentId(undefined);
    }
  }, [visible, isMoveMode]);

  // Lazy-load tree when entering manual mode
  useEffect(() => {
    if (mode === 'manual' && tree.length === 0 && userId) {
      (async () => {
        setLoadingTree(true);
        try {
          const t = await BranchSvc.buildTree(userId);
          setTree(t);
          if (t.length === 1) setExpanded(new Set([t[0].id]));
        } catch (e: any) { Alert.alert('Failed to load decks', e?.message || ''); }
        finally { setLoadingTree(false); }
      })();
    }
  }, [mode, userId, tree.length]);

  const autoPathLabel = useMemo(() => {
    const subject = (hint.subject || 'General').trim() || 'General';
    const section = (hint.section_group || 'General').trim() || 'General';
    const micro   = (hint.microtopic || 'General').trim() || 'General';
    return `${subject} → ${section} → ${micro}`;
  }, [hint]);

  const doAutoPlace = async () => {
    if (!cardId || !userId) return;
    setMode('auto-busy');
    try {
      const leaf = await BranchPlacement.autoPlace(userId, cardId, hint);
      onPlaced?.(BranchPlacement.buildPathLabel({ name: leaf.name }));
      onClose();
      Alert.alert('Added to Flashcards', `Saved to: ${autoPathLabel}`);
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not place flashcard');
      setMode('choose');
    }
  };

  const doManualPlace = async (node: BranchNode) => {
    if (!cardId) return;
    if (isMoveMode && fromBranchId === node.id) {
      Alert.alert('Already here', 'This card is already in this deck.');
      return;
    }
    setPlacingId(node.id);
    try {
      if (isMoveMode && fromBranchId) {
        await BranchPlacement.moveCard(userId, cardId, fromBranchId, node.id);
      } else {
        await BranchPlacement.placeAt(userId, cardId, node.id);
      }
      onPlaced?.(node.path || node.name);
      onClose();
      Alert.alert(isMoveMode ? 'Card moved' : 'Added to Flashcards', `${isMoveMode ? 'Moved to' : 'Saved to'}: ${node.path || node.name}`);
    } catch (e: any) {
      Alert.alert('Failed', e?.message || '');
    } finally { setPlacingId(null); }
  };

  const reloadTree = async () => {
    setLoadingTree(true);
    try {
      const t = await BranchSvc.buildTree(userId);
      setTree(t);
    } finally { setLoadingTree(false); }
  };

  const doCreateDeck = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await BranchSvc.create(userId, name, createParentId ?? null);
      setNewName('');
      setCreateParentId(undefined);
      await reloadTree();
    } catch (e: any) { Alert.alert('Could not create', e?.message || ''); }
  };

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const renderNode = (node: BranchNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id);
    return (
      <View key={node.id}>
        <View style={[s.deckRow, { borderBottomColor: colors.border, paddingLeft: 14 + depth * 18 }]}>
          {hasChildren ? (
            <TouchableOpacity onPress={() => toggle(node.id)} style={s.chev} testID={`chev-${node.id}`}>
              {isOpen ? <ChevronDown size={16} color={colors.textSecondary} /> : <ChevronRight size={16} color={colors.textSecondary} />}
            </TouchableOpacity>
          ) : <View style={s.chev} />}
          <TouchableOpacity
            style={s.deckName}
            onPress={() => doManualPlace(node)}
            disabled={placingId === node.id}
            testID={`place-deck-${node.id}`}
          >
            <Text style={[s.deckText, { color: colors.textPrimary }]} numberOfLines={1}>
              {node.name}
            </Text>
            {placingId === node.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Check size={16} color={colors.textTertiary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setCreateParentId(node.id); setNewName(''); }}
            style={s.addInline}
            testID={`add-child-${node.id}`}
          >
            <Plus size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
        {createParentId === node.id && (
          <View style={[s.createInline, { paddingLeft: 14 + (depth + 1) * 18, borderBottomColor: colors.border }]}>
            <TextInput
              autoFocus
              value={newName}
              onChangeText={setNewName}
              placeholder="New sub-deck name…"
              placeholderTextColor={colors.textTertiary}
              style={[s.createInput, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border }]}
              onSubmitEditing={doCreateDeck}
              testID="create-inline-input"
            />
            <TouchableOpacity onPress={doCreateDeck} style={[s.createBtn, { backgroundColor: colors.primary }]}>
              <Text style={{ color: '#04223a', fontWeight: '900', fontSize: 12 }}>Create</Text>
            </TouchableOpacity>
          </View>
        )}
        {isOpen && node.children.map(c => renderNode(c, depth + 1))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: colors.bg, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={[s.head, { borderBottomColor: colors.border }]}>
            <Text style={[s.title, { color: colors.textPrimary }]}>
              {title || (mode === 'manual' ? (isMoveMode ? 'Move card to…' : 'Choose deck') : 'Add to Flashcards')}
            </Text>
            <TouchableOpacity onPress={onClose} testID="aff-close"><X size={22} color={colors.textPrimary} /></TouchableOpacity>
          </View>

          {/* CHOICE MODE */}
          {mode === 'choose' && (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <TouchableOpacity
                style={[s.choice, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={doAutoPlace}
                testID="aff-auto"
              >
                <View style={[s.choiceIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Sparkles size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.choiceTitle, { color: colors.textPrimary }]}>Auto-place by hierarchy</Text>
                  <Text style={[s.choiceSub, { color: colors.textTertiary }]} numberOfLines={2}>
                    {autoPathLabel}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.choice, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setMode('manual')}
                testID="aff-manual"
              >
                <View style={[s.choiceIcon, { backgroundColor: '#10b98120' }]}>
                  <FolderTree size={22} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.choiceTitle, { color: colors.textPrimary }]}>Choose location</Text>
                  <Text style={[s.choiceSub, { color: colors.textTertiary }]}>
                    Browse your decks and pick a destination.
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* AUTO BUSY MODE */}
          {mode === 'auto-busy' && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Placing into {autoPathLabel}…</Text>
            </View>
          )}

          {/* MANUAL MODE */}
          {mode === 'manual' && (
            <View style={{ flex: 1 }}>
              {/* Top: create-at-root */}
              <View style={[s.rootCreateRow, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                  style={[s.rootCreateBtn, { borderColor: colors.border }]}
                  onPress={() => { setCreateParentId(null); setNewName(''); }}
                  testID="aff-create-root"
                >
                  <Plus size={14} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>New root deck</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode('choose')} testID="aff-back">
                  <Text style={{ color: colors.textSecondary, fontWeight: '800' }}>‹ Back</Text>
                </TouchableOpacity>
              </View>

              {createParentId === null && (
                <View style={[s.createInline, { paddingLeft: 14, borderBottomColor: colors.border }]}>
                  <TextInput
                    autoFocus
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="New deck name…"
                    placeholderTextColor={colors.textTertiary}
                    style={[s.createInput, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border }]}
                    onSubmitEditing={doCreateDeck}
                  />
                  <TouchableOpacity onPress={doCreateDeck} style={[s.createBtn, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: '#04223a', fontWeight: '900', fontSize: 12 }}>Create</Text>
                  </TouchableOpacity>
                </View>
              )}

              {loadingTree ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : tree.length === 0 ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={{ color: colors.textTertiary, textAlign: 'center' }}>
                    No decks yet. Tap "New root deck" above to create one.
                  </Text>
                </View>
              ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
                  {tree.map(n => renderNode(n))}
                </ScrollView>
              )}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', borderTopWidth: 1, minHeight: '40%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '900' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, borderWidth: 1 },
  choiceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  choiceTitle: { fontSize: 15, fontWeight: '900' },
  choiceSub: { fontSize: 12, marginTop: 4 },
  rootCreateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1 },
  rootCreateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  deckRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingRight: 8 },
  chev: { width: 28, alignItems: 'center', justifyContent: 'center', height: 44 },
  deckName: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 },
  deckText: { fontSize: 14, fontWeight: '700', flex: 1 },
  addInline: { padding: 8 },
  createInline: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  createInput: { flex: 1, height: 36, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, fontSize: 13 },
  createBtn: { height: 36, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});

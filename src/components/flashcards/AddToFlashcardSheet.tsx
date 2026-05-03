/**
 * AddToFlashcardSheet ΓÇö universal "Add to Flashcard" sheet shown across the app
 * (quiz engine, analyse section, repo cards, attempt result, notes editor).
 *
 * Two modes:
 *   1. AUTO  ΓåÆ builds Subject ΓåÆ Section Group ΓåÆ Microtopic hierarchy and drops
 *              the card into the leaf branch (creating branches if needed).
 *   2. MANUAL ΓåÆ opens the user's full deck tree to pick a destination.
 *               Includes inline "+ Create new deck here" affordance.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { 
  ChevronDown, ChevronRight, Plus, Sparkles, FolderTree, X, Check,
  CheckCircle2, Minus, Layers, Search 
} from 'lucide-react-native';
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
  /** Force manual tree mode (used by manual card creation). */
  manualOnly?: boolean;
  /** Selection-only mode: pick deck without placing/moving a card. */
  selectionOnly?: boolean;
  /** Fired in selection-only mode when a deck is chosen. */
  onSelectDeck?: (deck: { id: string; name: string; path: string }) => void;
}

type Mode = 'choose' | 'auto-busy' | 'manual';

export function AddToFlashcardSheet(props: AddToFlashcardSheetProps) {
  const {
    visible, onClose, userId, cardId, hint, onPlaced, fromBranchId, title,
    manualOnly = false, selectionOnly = false, onSelectDeck,
  } = props;
  
  const isMoveMode = !!fromBranchId;
  const canChooseAuto = !isMoveMode && !manualOnly && !selectionOnly;
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>('choose');
  const [tree, setTree] = useState<BranchNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingTree, setLoadingTree] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [placingBusy, setPlacingBusy] = useState(false);

  // Inline creation
  const [createParentId, setCreateParentId] = useState<string | null | undefined>(undefined);
  const [newName, setNewName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      setMode(canChooseAuto ? 'choose' : 'manual');
      setNewName('');
      setSearchQuery('');
      setCreateParentId(undefined);
      setSelectedDeckId(null);
      setPlacingBusy(false);
      setTree([]);
      setExpanded(new Set());
    }
  }, [visible, canChooseAuto]);

  useEffect(() => {
    if (visible && mode === 'manual' && tree.length === 0 && userId) {
      (async () => {
        setLoadingTree(true);
        try {
          const t = await BranchSvc.buildTree(userId);
          setTree(t);
        } catch (e: any) {
          Alert.alert('Error', e?.message);
        } finally {
          setLoadingTree(false);
        }
      })();
    }
  }, [mode, userId, tree.length, visible]);

  const autoPathLabel = useMemo(() => {
    const subject = (hint.subject || 'General').trim();
    const section = (hint.section_group || 'General').trim();
    const micro = (hint.microtopic || 'General').trim();
    return `${subject} \u2192 ${section} \u2192 ${micro}`;
  }, [hint]);

  const doAutoPlace = async () => {
    if (!cardId || !userId) return;
    setPlacingBusy(true);
    try {
      const leaf = await BranchPlacement.autoPlace(userId, cardId, hint);
      onPlaced?.(BranchPlacement.buildPathLabel({ name: leaf.name }));
      onClose();
    } catch (e: any) {
      Alert.alert('Failed', e?.message);
    } finally {
      setPlacingBusy(false);
    }
  };

  const handleConfirm = async () => {
    // If no deck selected, we can't move/place
    if (selectedDeckId === null && mode === 'manual' && !selectionOnly) {
       // Root is allowed? Usually yes.
    }
    
    if (selectionOnly) {
      const flat = BranchSvc.flatten(tree);
      const node = flat.find(n => n.id === selectedDeckId);
      onSelectDeck?.({ id: selectedDeckId!, name: node?.name || 'Home', path: node?.path || 'Home' });
      onClose();
      return;
    }

    if (!cardId) return;
    setPlacingBusy(true);
    try {
      if (isMoveMode && fromBranchId) {
        await BranchPlacement.moveCard(userId, cardId, fromBranchId, selectedDeckId!);
      } else {
        await BranchPlacement.placeAt(userId, cardId, selectedDeckId!);
      }
      onPlaced?.('Moved');
      onClose();
    } catch (e: any) {
      Alert.alert('Failed', e?.message);
    } finally {
      setPlacingBusy(false);
    }
  };

  const reloadTree = async () => {
    const t = await BranchSvc.buildTree(userId);
    setTree(t);
  };

  const doCreateDeck = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await BranchSvc.create(userId, name, createParentId ?? null);
      setNewName('');
      setCreateParentId(undefined);
      await reloadTree();
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    }
  };

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return tree;
    const query = searchQuery.toLowerCase();
    const filter = (nodes: BranchNode[]): BranchNode[] => {
      return nodes.map(n => {
        const children = filter(n.children);
        if (n.name.toLowerCase().includes(query) || children.length > 0) {
          return { ...n, children };
        }
        return null;
      }).filter(Boolean) as BranchNode[];
    };
    return filter(tree);
  }, [tree, searchQuery]);

  const renderNode = (node: BranchNode, depth = 0) => {
    const isSelected = selectedDeckId === node.id;
    const hasKids = node.children.length > 0;
    const isOpen = expanded.has(node.id) || !!searchQuery.trim();
    const indent = depth * 32;

    return (
      <View key={node.id}>
        <TouchableOpacity
          onPress={() => setSelectedDeckId(node.id)}
          style={[s.moveRow, { borderBottomColor: colors.border + '40' }, isSelected && { backgroundColor: colors.primary + '10' }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingLeft: indent }}>
            {hasKids ? (
              <TouchableOpacity onPress={() => toggle(node.id)} style={s.moveToggle}>
                {isOpen ? <Minus size={14} color={colors.textTertiary} strokeWidth={3} /> : <Plus size={14} color={colors.textTertiary} strokeWidth={3} />}
              </TouchableOpacity>
            ) : <View style={{ width: 32 }} />}
            <Text style={[s.moveRowText, { color: colors.textPrimary }]}>{node.name}</Text>
          </View>
          {isSelected && <CheckCircle2 size={20} color={colors.primary} />}
          
          <TouchableOpacity onPress={() => { setCreateParentId(node.id); setNewName(''); }} style={{ padding: 8 }}>
            <Plus size={16} color={colors.primary} />
          </TouchableOpacity>
        </TouchableOpacity>

        {createParentId === node.id && (
          <View style={[s.createInline, { marginLeft: indent + 32, borderBottomColor: colors.border + '40' }]}>
            <TextInput
              autoFocus
              value={newName}
              onChangeText={setNewName}
              placeholder="New sub-deck name..."
              placeholderTextColor={colors.textTertiary}
              style={[s.createInput, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border + '80' }]}
              onSubmitEditing={doCreateDeck}
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

  const computedTitle = title || "Select location";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
          <View style={[s.moveSheet, { backgroundColor: colors.surface, maxHeight: '90%' }]}>
            {/* Header */}
            <View style={s.moveHeader}>
              <View style={{ width: 40 }} />
              <Text style={[s.moveTitle, { color: colors.textPrimary }]}>{computedTitle}</Text>
              <TouchableOpacity onPress={onClose} style={[s.closeCircle, { backgroundColor: colors.border + '40' }]}>
                <X size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Mode Switcher / Auto */}
            {mode === 'choose' && canChooseAuto && (
              <View style={{ paddingBottom: 20 }}>
                <TouchableOpacity
                  style={[s.premiumChoice, { backgroundColor: colors.surfaceStrong, borderColor: colors.border + '40' }]}
                  onPress={doAutoPlace}
                >
                  <View style={[s.choiceIcon, { backgroundColor: colors.primary + '20' }]}>
                    <Sparkles size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.choiceTitle, { color: colors.textPrimary }]}>Auto-place</Text>
                    <Text style={[s.choiceSub, { color: colors.textTertiary }]} numberOfLines={1}>{autoPathLabel}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.premiumChoice, { backgroundColor: colors.surfaceStrong, borderColor: colors.border + '40', marginTop: 12 }]}
                  onPress={() => setMode('manual')}
                >
                  <View style={[s.choiceIcon, { backgroundColor: '#10b98120' }]}>
                    <FolderTree size={22} color="#10b981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.choiceTitle, { color: colors.textPrimary }]}>Manual selection</Text>
                    <Text style={[s.choiceSub, { color: colors.textTertiary }]}>Pick a specific deck</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Manual List */}
            {mode === 'manual' && (
              <View style={{ flex: 1 }}>
                <View style={s.searchBar}>
                  <Search size={18} color={colors.textTertiary} style={{ marginRight: 8 }} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search decks..."
                    placeholderTextColor={colors.textTertiary}
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: '500' }}
                  />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                  {/* Home Option */}
                  <TouchableOpacity
                    onPress={() => setSelectedDeckId(null)}
                    style={[s.moveRow, { borderBottomColor: colors.border + '40' }, selectedDeckId === null && { backgroundColor: colors.primary + '10' }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={[s.homeIcon, { backgroundColor: colors.primary + '20' }]}>
                        <Layers size={20} color={colors.primary} />
                      </View>
                      <Text style={[s.moveRowText, { color: colors.textPrimary, marginLeft: 12 }]}>Home</Text>
                    </View>
                    {selectedDeckId === null && <CheckCircle2 size={20} color={colors.primary} />}
                  </TouchableOpacity>

                  {/* Create Root Button */}
                  <TouchableOpacity
                    style={[s.createRootBtn, { borderColor: colors.primary + '40' }]}
                    onPress={() => { setCreateParentId(null); setNewName(''); }}
                  >
                    <Plus size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: '800', marginLeft: 8 }}>New root deck</Text>
                  </TouchableOpacity>

                  {createParentId === null && (
                    <View style={[s.createInline, { borderBottomColor: colors.border + '40' }]}>
                      <TextInput
                        autoFocus
                        value={newName}
                        onChangeText={setNewName}
                        placeholder="New deck name..."
                        placeholderTextColor={colors.textTertiary}
                        style={[s.createInput, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border + '80' }]}
                        onSubmitEditing={doCreateDeck}
                      />
                      <TouchableOpacity onPress={doCreateDeck} style={[s.createBtn, { backgroundColor: colors.primary }]}>
                        <Text style={{ color: '#04223a', fontWeight: '900', fontSize: 12 }}>Create</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {loadingTree ? (
                    <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
                  ) : (
                    filteredTree.map(n => renderNode(n))
                  )}
                </ScrollView>

                {/* Footer Action */}
                <View style={s.moveFooter}>
                  <TouchableOpacity
                    onPress={handleConfirm}
                    disabled={placingBusy}
                    style={[s.moveConfirmBtn, { backgroundColor: colors.primary }]}
                  >
                    {placingBusy ? <ActivityIndicator color="#04223a" /> : <Text style={s.moveConfirmText}>Move</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20 },
  moveSheet: { borderRadius: 40, padding: 20, paddingBottom: 30, width: '94%', maxWidth: 500, height: '82%', overflow: 'hidden' },
  moveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  moveTitle: { fontSize: 18, fontWeight: '900' },
  closeCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  premiumChoice: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, borderWidth: 1 },
  choiceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  choiceTitle: { fontSize: 16, fontWeight: '900' },
  choiceSub: { fontSize: 12, marginTop: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f7', paddingHorizontal: 16, height: 50, borderRadius: 14, marginBottom: 16 },
  moveRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, paddingHorizontal: 8, borderRadius: 12 },
  moveRowText: { fontSize: 16, fontWeight: '600', flex: 1 },
  moveToggle: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  homeIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  createRootBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', marginVertical: 12 },
  createInline: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1 },
  createInput: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  createBtn: { height: 40, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  moveFooter: { paddingTop: 20 },
  moveConfirmBtn: { height: 64, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  moveConfirmText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
});

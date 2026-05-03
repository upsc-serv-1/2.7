import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable
} from 'react-native';
import { X, CheckCircle2, Minus, Plus, Layers, Folder } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { BranchSvc, BranchNode } from '../../services/BranchService';

interface PremiumMoveModalProps {
  visible: boolean;
  node: BranchNode | null;
  tree: BranchNode[];
  onClose: () => void;
  onConfirm: (targetParentId: string | null) => void;
  title?: string;
}

export function PremiumMoveModal({ visible, node, tree, onClose, onConfirm, title }: PremiumMoveModalProps) {
  const { colors } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Split into Folders and Decks
  // Show full tree in move list
  const fullTree = tree.filter(n => n.id !== node?.id);
  const visibleNodes = BranchSvc.flatten(fullTree, expanded);

  if (!node && !visible) return null;

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.moveSheet, { backgroundColor: colors.surface, maxHeight: '90%' }]}>
          {/* Header */}
          <View style={styles.moveHeader}>
            <View style={{ width: 40 }} />
            <Text style={[styles.moveTitle, { color: colors.textPrimary }]}>{title || "Select location"}</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeCircle, { backgroundColor: colors.border + '40' }]}>
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {/* Alphabetical Grouping / Full Tree */}
            <View style={{ paddingBottom: 20 }}>
              <TouchableOpacity 
                onPress={() => setSelectedId(null)} 
                style={[styles.moveRow, { borderBottomColor: colors.border + '40' }, selectedId === null && { backgroundColor: colors.primary + '10', borderRadius: 12 }]}
              >
                <View style={styles.moveIconWrap}>
                  <Layers size={20} color={colors.primary} />
                </View>
                <Text style={[styles.moveRowText, { color: colors.textPrimary }]}>Home (Root)</Text>
                {selectedId === null && <CheckCircle2 size={22} color={colors.primary} />}
              </TouchableOpacity>

              {visibleNodes.map(n => {
                const hasKids = n.children.length > 0;
                const isSelected = selectedId === n.id;
                const indent = n.depth * 28;

                return (
                  <TouchableOpacity 
                    key={n.id} 
                    onPress={() => {
                      setSelectedId(n.id);
                      if (hasKids) toggle(n.id);
                    }} 
                    style={[styles.moveRow, { borderBottomColor: colors.border + '40', paddingLeft: 16 + indent }, isSelected && { backgroundColor: colors.primary + '10', borderRadius: 12 }]}
                  >
                    <View style={styles.moveToggleArea}>
                      {n.is_folder ? (
                        <View style={[styles.smallToggle, { backgroundColor: '#e0f2fe' }]}>
                           <Folder size={16} color="#0ea5e9" />
                        </View>
                      ) : (
                        <View style={styles.smallToggle}>
                           <Layers size={14} color={colors.textTertiary} />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.moveRowText, { color: colors.textPrimary }]}>{n.name}</Text>
                    {isSelected && <CheckCircle2 size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Action Button */}
          <View style={styles.moveFooter}>
            <TouchableOpacity 
              onPress={() => onConfirm(selectedId)} 
              style={[styles.bigMoveBtn, { backgroundColor: '#bae6fd' }]}
            >
              <Text style={styles.bigMoveBtnText}>Move</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20 },
  moveSheet: { borderRadius: 40, padding: 20, paddingBottom: 30, width: '94%', maxWidth: 500, height: '82%', overflow: 'hidden' },
  moveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  moveTitle: { fontSize: 20, fontWeight: '900' },
  closeCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  moveRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, paddingHorizontal: 12 },
  moveIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  moveRowText: { fontSize: 17, fontWeight: '700', flex: 1 },
  moveToggleArea: { width: 36, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  smallToggle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f2f2f7', alignItems: 'center', justifyContent: 'center' },
  moveFooter: { marginTop: 24, paddingHorizontal: 10 },
  bigMoveBtn: { height: 64, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#bae6fd' },
  bigMoveBtnText: { color: '#0369a1', fontSize: 18, fontWeight: '900' },
});

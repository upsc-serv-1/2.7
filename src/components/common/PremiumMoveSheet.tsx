import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal
} from 'react-native';
import { X, CheckCircle2, Folder, FileText, Home, ChevronRight, ChevronDown } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export interface MoveTarget {
  id: string;
  name: string;
  type: 'folder' | 'notebook' | 'note' | 'deck';
  parent_id?: string | null;
  children?: MoveTarget[];
  depth?: number;
}

interface PremiumMoveSheetProps {
  visible: boolean;
  title: string;
  targets: MoveTarget[]; // Can be flat list with parent_id
  onClose: () => void;
  onConfirm: (targetId: string | null) => void;
  currentSelectedId?: string | null;
}

export function PremiumMoveSheet({ visible, title, targets, onClose, onConfirm, currentSelectedId }: PremiumMoveSheetProps) {
  const { colors } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(currentSelectedId ?? null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Build tree and flatten with visibility
  const visibleNodes = useMemo(() => {
    // 1. Build Tree
    const map: Record<string, MoveTarget> = {};
    const roots: MoveTarget[] = [];
    
    targets.forEach(t => {
      map[t.id] = { ...t, children: [] };
    });
    
    targets.forEach(t => {
      if (t.parent_id && map[t.parent_id]) {
        map[t.parent_id].children!.push(map[t.id]);
      } else {
        roots.push(map[t.id]);
      }
    });

    // 2. Flatten based on expansion
    const result: MoveTarget[] = [];
    const walk = (nodes: MoveTarget[], depth: number) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name)).forEach(node => {
        result.push({ ...node, depth });
        if (expanded.has(node.id) && node.children && node.children.length > 0) {
          walk(node.children, depth + 1);
        }
      });
    };
    walk(roots, 0);
    return result;
  }, [targets, expanded]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const renderIcon = (type: string) => {
    switch (type) {
      case 'folder': return <Folder size={20} color="#f59e0b" />;
      case 'notebook': return <FileText size={20} color="#10b981" />;
      case 'deck': return <FileText size={20} color="#2563eb" />;
      default: return <FileText size={20} color={colors.textTertiary} />;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.moveSheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.moveHeader}>
            <View style={{ width: 40 }} />
            <Text style={[styles.moveTitle, { color: colors.textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeCircle, { backgroundColor: colors.border + '40' }]}>
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={{ paddingBottom: 20 }}>
              {/* Home / Root Option */}
              <TouchableOpacity 
                onPress={() => setSelectedId(null)} 
                style={[styles.moveRow, { borderBottomColor: colors.border + '40' }, selectedId === null && { backgroundColor: colors.primary + '10', borderRadius: 12 }]}
              >
                <View style={styles.moveIconWrap}>
                  <Home size={22} color={colors.primary} />
                </View>
                <Text style={[styles.moveRowText, { color: colors.textPrimary }]}>Home (Root)</Text>
                {selectedId === null && <CheckCircle2 size={22} color={colors.primary} />}
              </TouchableOpacity>

              {visibleNodes.map(n => {
                const isSelected = selectedId === n.id;
                const hasKids = n.children && n.children.length > 0;
                const isOpen = expanded.has(n.id);
                const indent = (n.depth || 0) * 28;

                return (
                  <TouchableOpacity 
                    key={n.id} 
                    onPress={() => {
                      setSelectedId(n.id);
                      if (hasKids) toggle(n.id);
                    }} 
                    style={[styles.moveRow, { borderBottomColor: colors.border + '40', paddingLeft: 12 + indent }, isSelected && { backgroundColor: colors.primary + '10', borderRadius: 12 }]}
                  >
                    <View style={styles.toggleBtn}>
                      {hasKids ? (
                        isOpen ? <ChevronDown size={18} color={colors.textTertiary} /> : <ChevronRight size={18} color={colors.textTertiary} />
                      ) : <View style={{ width: 18 }} />}
                    </View>
                    <View style={styles.moveIconWrap}>
                      {renderIcon(n.type)}
                    </View>
                    <Text style={[styles.moveRowText, { color: colors.textPrimary }]} numberOfLines={1}>{n.name}</Text>
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
              style={[styles.bigMoveBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.bigMoveBtnText, { color: '#fff' }]}>Move Here</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20 },
  moveSheet: { borderRadius: 40, padding: 20, paddingBottom: 30, width: '94%', maxWidth: 500, height: '80%', overflow: 'hidden' },
  moveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  moveTitle: { fontSize: 19, fontWeight: '900' },
  closeCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  moveRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, paddingHorizontal: 12 },
  toggleBtn: { width: 28, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  moveIconWrap: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  moveRowText: { fontSize: 16, fontWeight: '700', flex: 1 },
  moveFooter: { marginTop: 24, paddingHorizontal: 10 },
  bigMoveBtn: { height: 60, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  bigMoveBtnText: { fontSize: 17, fontWeight: '900' },
});

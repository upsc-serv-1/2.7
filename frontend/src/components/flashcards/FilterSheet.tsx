import React, { useState, useEffect } from 'react';
import { Modal, Pressable, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export type LearningStatusFilter = 'not_studied' | 'learning' | 'mastered';
export type CardStatusFilter = 'active' | 'frozen';

export interface FilterValue {
  learning_status: LearningStatusFilter[];
  card_status: CardStatusFilter[];
}

export const EMPTY_FILTER: FilterValue = { learning_status: [], card_status: [] };

interface Props {
  visible: boolean;
  value: FilterValue;
  onClose: () => void;
  onApply: (v: FilterValue) => void;
}

const LEARNING_OPTS: { key: LearningStatusFilter; label: string }[] = [
  { key: 'not_studied', label: 'Not studied' },
  { key: 'learning',    label: 'Learning' },
  { key: 'mastered',    label: 'Mastered' },
];
const CARD_OPTS: { key: CardStatusFilter; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'frozen', label: 'Frozen' },
];

export function FilterSheet({ visible, value, onClose, onApply }: Props) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<FilterValue>(value);

  useEffect(() => { if (visible) setDraft(value); }, [visible, value]);

  const toggle = <K extends keyof FilterValue>(field: K, key: FilterValue[K][number]) => {
    setDraft(prev => {
      const arr = prev[field] as any[];
      const next = arr.includes(key) ? arr.filter(x => x !== key) : [...arr, key];
      return { ...prev, [field]: next } as FilterValue;
    });
  };

  const reset = () => setDraft(EMPTY_FILTER);
  const apply = () => { onApply(draft); onClose(); };

  const Chip = ({ label, active, onPress, testID }: any) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.pill,
        {
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primary + '18' : 'transparent',
        },
      ]}
      testID={testID}
    >
      <Text style={[styles.pillText, { color: active ? colors.primary : colors.textPrimary, fontWeight: active ? '900' : '700' }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()} testID="filter-sheet">
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Filter by</Text>
            <TouchableOpacity
              onPress={reset}
              style={[styles.resetBtn, { backgroundColor: colors.surfaceStrong || 'rgba(255,255,255,0.08)' }]}
              testID="filter-reset"
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingBottom: 12 }}>
            <Text style={[styles.group, { color: colors.textTertiary }]}>Learning status</Text>
            <View style={styles.col}>
              {LEARNING_OPTS.map(o => (
                <Chip
                  key={o.key}
                  label={o.label}
                  active={draft.learning_status.includes(o.key)}
                  onPress={() => toggle('learning_status', o.key)}
                  testID={`filter-ls-${o.key}`}
                />
              ))}
            </View>

            <Text style={[styles.group, { color: colors.textTertiary, marginTop: 18 }]}>Card status</Text>
            <View style={styles.col}>
              {CARD_OPTS.map(o => (
                <Chip
                  key={o.key}
                  label={o.label}
                  active={draft.card_status.includes(o.key)}
                  onPress={() => toggle('card_status', o.key)}
                  testID={`filter-cs-${o.key}`}
                />
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.apply, { backgroundColor: colors.primary }]}
            onPress={apply}
            testID="filter-apply"
          >
            <Text style={[styles.applyText, { color: '#04223a' }]}>Apply</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 28, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginVertical: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 22, fontWeight: '900' },
  resetBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  group: { fontSize: 14, fontWeight: '800', marginBottom: 10 },
  col: { flexDirection: 'column', gap: 10 },
  pill: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 18 },
  pillText: { fontSize: 17 },
  apply: { height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  applyText: { fontSize: 17, fontWeight: '900' },
});

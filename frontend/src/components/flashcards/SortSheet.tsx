import React from 'react';
import { Modal, Pressable, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export type SortKey = 'next' | 'newest' | 'oldest' | 'az' | 'za';

interface Props {
  visible: boolean;
  value: SortKey;
  onClose: () => void;
  onSelect: (key: SortKey) => void;
}

const OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'next',   label: 'Next review' },
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'az',     label: 'A-Z' },
  { key: 'za',     label: 'Z-A' },
];

export function SortSheet({ visible, value, onClose, onSelect }: Props) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
          testID="sort-sheet"
        >
          <View style={styles.handle} />
          <Text style={[styles.title, { color: colors.textTertiary }]}>Sort by</Text>

          {OPTIONS.map(opt => {
            const active = value === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => { onSelect(opt.key); onClose(); }}
                style={[
                  styles.row,
                  { backgroundColor: colors.surfaceStrong || 'rgba(255,255,255,0.05)' },
                ]}
                testID={`sort-option-${opt.key}`}
              >
                <Text style={[styles.rowText, { color: colors.textPrimary, fontWeight: active ? '900' : '700' }]}>
                  {opt.label}
                </Text>
                {active && <Check size={22} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginVertical: 8 },
  title: { fontSize: 15, fontWeight: '800', marginLeft: 4, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderRadius: 14, marginBottom: 10 },
  rowText: { fontSize: 17 },
});

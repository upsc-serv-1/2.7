import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, Animated, StyleSheet, Modal, Pressable, Text } from 'react-native';
import { Plus, Layers, FileText, Zap, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

/**
 * AnkiPro-style global "Create" Floating Action Button.
 * Renders once from the root layout — tapping opens a radial action menu for
 * creating cards / notes / decks quickly from any tab.
 */
export function GlobalCreateFAB() {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const actions = [
    { key: 'card', label: 'Flashcard', icon: Layers, onPress: () => router.push('/flashcards/new') },
    { key: 'deck', label: 'Deck', icon: Zap, onPress: () => router.push('/flashcards') },
    { key: 'note', label: 'Note', icon: FileText, onPress: () => router.push('/notes') },
  ];

  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    setOpen(true);
  };

  return (
    <>
      <Animated.View style={[styles.fab, { backgroundColor: colors.primary, transform: [{ scale }] }]}>
        <TouchableOpacity onPress={press} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} testID="global-create-fab">
          <Plus size={28} color="#04223a" />
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sheetHeader}>
              <Text style={{ color: colors.textPrimary, fontWeight: '900', fontSize: 18 }}>Create</Text>
              <TouchableOpacity onPress={() => setOpen(false)} testID="close-create-sheet">
                <X size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {actions.map(a => (
              <TouchableOpacity
                key={a.key}
                style={[styles.action, { borderColor: colors.border }]}
                onPress={() => { setOpen(false); setTimeout(a.onPress, 160); }}
                testID={`create-${a.key}`}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.primary + '18' }]}>
                  <a.icon size={20} color={colors.primary} />
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginLeft: 14 }}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowColor: '#000',
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { padding: 18, paddingBottom: 32, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  action: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1 },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});

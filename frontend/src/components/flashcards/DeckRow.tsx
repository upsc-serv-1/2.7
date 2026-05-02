import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, PanResponder, Platform } from 'react-native';
import { ChevronRight, ChevronDown, Folder, Settings as SettingsIcon, Edit2, FolderPlus, Trash2, FolderInput } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { BranchNode } from '../../services/BranchService';

export type DeckRowAction = 'settings' | 'rename' | 'move' | 'delete';

interface Props {
  node: BranchNode;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;         // tap → drill into this deck (microtopic screen)
  onAction: (action: DeckRowAction) => void;
}

const SWIPE_WIDTH = 220;
const ACTION_WIDTH = SWIPE_WIDTH / 4;

export function DeckRow({ node, expanded, onToggle, onOpen, onAction }: Props) {
  const { colors } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpenSwipe = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        // Horizontal swipe only (avoid stealing the scroll)
        return Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy);
      },
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx < 0) {
          translateX.setValue(Math.max(gesture.dx, -SWIPE_WIDTH));
        } else if (isOpenSwipe.current) {
          translateX.setValue(Math.min(0, -SWIPE_WIDTH + gesture.dx));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const open = gesture.dx < -SWIPE_WIDTH / 2 || (isOpenSwipe.current && gesture.dx < SWIPE_WIDTH / 2);
        Animated.spring(translateX, {
          toValue: open ? -SWIPE_WIDTH : 0,
          useNativeDriver: true,
          friction: 8,
        }).start(() => { isOpenSwipe.current = open; });
      },
    })
  ).current;

  const closeSwipe = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    isOpenSwipe.current = false;
  };

  const hasChildren = node.children.length > 0;
  const hasAnyCards = node.total_count > 0;
  const hasDue = node.due_count > 0;
  const hasNew = node.new_count > 0;

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.bg }]}>
      {/* Revealed actions (behind) */}
      <View style={[styles.actionsRow, { width: SWIPE_WIDTH, backgroundColor: colors.bg }]}>
        <ActionBtn
          icon={<SettingsIcon size={18} color="#fff" />} bg="#3b82f6"
          label="Settings" onPress={() => { closeSwipe(); onAction('settings'); }} testID={`deck-action-settings-${node.id}`}
        />
        <ActionBtn
          icon={<Edit2 size={18} color="#fff" />} bg="#f59e0b"
          label="Rename" onPress={() => { closeSwipe(); onAction('rename'); }} testID={`deck-action-rename-${node.id}`}
        />
        <ActionBtn
          icon={<FolderInput size={18} color="#fff" />} bg="#8b5cf6"
          label="Move" onPress={() => { closeSwipe(); onAction('move'); }} testID={`deck-action-move-${node.id}`}
        />
        <ActionBtn
          icon={<Trash2 size={18} color="#fff" />} bg="#ef4444"
          label="Delete" onPress={() => { closeSwipe(); onAction('delete'); }} testID={`deck-action-delete-${node.id}`}
        />
      </View>

      {/* Foreground row */}
      <Animated.View
        style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={{ paddingLeft: node.depth * 18, flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          {hasChildren ? (
            <TouchableOpacity onPress={onToggle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} testID={`deck-toggle-${node.id}`}>
              {expanded ? (
                <ChevronDown size={18} color={colors.textTertiary} />
              ) : (
                <ChevronRight size={18} color={colors.textTertiary} />
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ width: 18 }} />
          )}

          <TouchableOpacity
            onPress={onOpen}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingLeft: 10 }}
            testID={`deck-open-${node.id}`}
          >
            <Folder size={18} color={colors.textSecondary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{node.name}</Text>
              {hasAnyCards ? (
                <Text style={[styles.sub, { color: colors.textTertiary }]}>
                  {node.total_count} {node.total_count === 1 ? 'card' : 'cards'}
                  {hasChildren ? ` · ${countDescendants(node)} subfolders` : ''}
                </Text>
              ) : null}
            </View>

            {/* Pills: Due (red) / New (blue) */}
            <View style={{ flexDirection: 'row', gap: 6, marginLeft: 6 }}>
              {hasDue && (
                <Pill value={node.due_count} bg="#ef4444" testID={`deck-due-${node.id}`} />
              )}
              {hasNew && (
                <Pill value={node.new_count} bg="#3b82f6" testID={`deck-new-${node.id}`} />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

function countDescendants(node: BranchNode): number {
  let c = node.children.length;
  node.children.forEach(ch => { c += countDescendants(ch); });
  return c;
}

function ActionBtn({ icon, bg, label, onPress, testID }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.action, { backgroundColor: bg, width: ACTION_WIDTH }]}
      testID={testID}
    >
      {icon}
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Pill({ value, bg, testID }: any) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]} testID={testID}>
      <Text style={styles.pillText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', marginHorizontal: 14, marginVertical: 3, borderRadius: 14, overflow: 'hidden' },
  actionsRow: { position: 'absolute', top: 0, bottom: 0, right: 0, flexDirection: 'row' },
  action: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionLabel: { color: '#fff', fontSize: 11, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 14, borderRadius: 14, borderWidth: 1 },
  name: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  pill: { minWidth: 26, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, alignItems: 'center' },
  pillText: { color: '#fff', fontSize: 11, fontWeight: '900' },
});

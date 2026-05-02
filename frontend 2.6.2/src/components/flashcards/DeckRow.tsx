import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, PanResponder } from 'react-native';
import { ChevronRight, Minus, Plus } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { BranchNode } from '../../services/BranchService';
import { Settings as SettingsIcon, Edit2, FolderPlus, Trash2, FolderInput } from 'lucide-react-native';

export type DeckRowAction = 'add' | 'settings' | 'rename' | 'move' | 'delete';

interface Props {
  node: BranchNode;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onAction: (action: DeckRowAction) => void;
}

const SWIPE_WIDTH = 275;
const ACTION_WIDTH = SWIPE_WIDTH / 5;

export function DeckRow({ node, expanded, onToggle, onOpen, onAction }: Props) {
  const { colors } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpenSwipe = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
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
  const indentWidth = 32;

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.bg }]}>
      {/* Revealed actions */}
      <View style={[styles.actionsRow, { width: SWIPE_WIDTH, backgroundColor: colors.bg }]}>
        <ActionBtn
          icon={<FolderPlus size={18} />} bg="#10b981"
          label="Add" onPress={() => { closeSwipe(); onAction('add'); }}
        />
        <ActionBtn
          icon={<SettingsIcon size={18} />} bg="#3b82f6"
          label="Settings" onPress={() => { closeSwipe(); onAction('settings'); }}
        />
        <ActionBtn
          icon={<Edit2 size={18} />} bg="#f59e0b"
          label="Rename" onPress={() => { closeSwipe(); onAction('rename'); }}
        />
        <ActionBtn
          icon={<FolderInput size={18} />} bg="#8b5cf6"
          label="Move" onPress={() => { closeSwipe(); onAction('move'); }}
        />
        <ActionBtn
          icon={<Trash2 size={18} />} bg="#ef4444"
          label="Delete" onPress={() => { closeSwipe(); onAction('delete'); }}
        />
      </View>

      {/* Foreground row */}
      <Animated.View
        style={[styles.row, { backgroundColor: colors.bg, borderBottomColor: colors.border + '40', transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.content}>
          {/* Hierarchy Lines */}
          {Array.from({ length: node.depth }).map((_, i) => (
            <View 
              key={i} 
              style={[styles.verticalLine, { left: i * indentWidth + 16, backgroundColor: colors.border + '80' }]} 
            />
          ))}

          {/* Toggle / Icon Area */}
          <View style={[styles.iconArea, { marginLeft: node.depth * indentWidth }]}>
            {hasChildren ? (
              <TouchableOpacity 
                onPress={onToggle} 
                style={[styles.circleIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                {expanded ? (
                  <Minus size={14} color={colors.textTertiary} strokeWidth={3} />
                ) : (
                  <Plus size={14} color={colors.textTertiary} strokeWidth={3} />
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.circlePlaceholder} />
            )}
          </View>

          {/* Text Area */}
          <TouchableOpacity 
            onPress={onOpen} 
            style={styles.textContainer}
            activeOpacity={0.6}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                {node.name}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                Cards for today: {node.due_count + node.new_count}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.border} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

function ActionBtn({ icon, bg, label, onPress }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.action, { width: ACTION_WIDTH }]}
    >
      <View style={styles.actionIconWrap}>
        {React.cloneElement(icon, { color: bg, size: 22 })}
      </View>
      <Text style={[styles.actionLabel, { color: bg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', overflow: 'hidden' },
  actionsRow: { position: 'absolute', top: 0, bottom: 0, right: 0, flexDirection: 'row' },
  action: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionIconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 9, fontWeight: '700' },
  row: { paddingHorizontal: 4, borderBottomWidth: 1 },
  content: { flexDirection: 'row', alignItems: 'center', minHeight: 60 },
  verticalLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
  },
  iconArea: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  circleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePlaceholder: {
    width: 24,
  },
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 1,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
});

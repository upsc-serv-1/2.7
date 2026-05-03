import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight, Minus, Plus } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { BranchNode } from '../../services/BranchService';
import { Settings as SettingsIcon, Edit2, FolderPlus, Trash2, FolderInput, Folder } from 'lucide-react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';

export type DeckRowAction = 'add' | 'settings' | 'rename' | 'move' | 'delete';

interface Props {
  node: BranchNode;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onAction: (action: DeckRowAction) => void;
}

export function DeckRow({ node, expanded, onToggle, onOpen, onAction }: Props) {
  const { colors } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  const closeSwipe = () => {
    swipeableRef.current?.close();
  };

  const renderRightActions = () => {
    return (
      <View style={[styles.actionsRow, { backgroundColor: colors.bg }]}>
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
        {!node.is_folder && (
          <ActionBtn
            icon={<FolderInput size={18} />} bg="#8b5cf6"
            label="Move" onPress={() => { closeSwipe(); onAction('move'); }}
          />
        )}
        <ActionBtn
          icon={<Trash2 size={18} />} bg="#ef4444"
          label="Delete" onPress={() => { closeSwipe(); onAction('delete'); }}
        />
      </View>
    );
  };

  const hasChildren = node.children.length > 0;
  const indentWidth = 40;

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
    >
      <View style={[styles.row, { backgroundColor: colors.bg, borderBottomColor: colors.border + 'A0' }]}>
        <View style={styles.content}>
          {/* Hierarchy Lines */}
          {Array.from({ length: node.depth }).map((_, i) => (
            <View 
              key={i} 
              style={[styles.verticalLine, { left: i * indentWidth + 20, backgroundColor: colors.border + '80' }]} 
            />
          ))}

          {/* Toggle / Icon Area */}
          <View style={[styles.iconArea, { marginLeft: node.depth * indentWidth }]}>
            {node.is_folder && node.depth === 0 ? (
              <TouchableOpacity onPress={onOpen} style={styles.folderIconWrap}>
                 <View style={[styles.officialFolderIcon, { backgroundColor: '#e0f2fe' }]}>
                    <Folder size={18} color="#0ea5e9" />
                 </View>
              </TouchableOpacity>
            ) : hasChildren ? (
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
                Cards for today: {node.due_count}/{node.total_count}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.border} />
          </TouchableOpacity>
        </View>
      </View>
    </Swipeable>
  );
}

function ActionBtn({ icon, label, onPress }: any) {
  const { colors } = useTheme();
  return (
    <RectButton
      onPress={onPress}
      style={styles.action}
    >
      <View style={[styles.actionCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {React.cloneElement(icon, { color: colors.textPrimary, size: 20 })}
      </View>
      <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>{label}</Text>
    </RectButton>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', overflow: 'hidden' },
  actionsRow: { flexDirection: 'row', alignItems: 'center' },
  action: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, height: '100%' },
  actionCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  row: { paddingHorizontal: 4, borderBottomWidth: 1 },
  content: { flexDirection: 'row', alignItems: 'center', minHeight: 70 },
  verticalLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
  iconArea: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  circleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePlaceholder: {
    width: 22,
  },
  folderIconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  officialFolderIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
});

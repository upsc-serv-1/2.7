import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { X, Info, RotateCcw } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { AlgorithmSettings, DEFAULT_SETTINGS } from '../../services/sm2';
import { FolderSettingsSvc, makeFolderKey } from '../../services/FolderSettingsService';

interface Props {
  visible: boolean;
  userId: string | undefined;
  subject?: string | null;
  section?: string | null;
  microtopic?: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

const LABELS: { key: keyof AlgorithmSettings; label: string; hint: string; unit: string; min?: number; max?: number }[] = [
  { key: 'new_cards_per_day',        label: 'New cards / day',           hint: 'How many never-seen cards you will pick up each day', unit: 'cards', min: 0, max: 999 },
  { key: 'max_reviews_per_day',      label: 'Max reviews / day',         hint: 'Cap on mature cards shown each day',                  unit: 'cards', min: 0, max: 9999 },
  { key: 'graduating_interval',      label: 'Graduating interval',       hint: '“Good” from learning → this many days later',         unit: 'days',  min: 1, max: 365 },
  { key: 'easy_interval',            label: 'Easy interval',             hint: '“Easy” from learning → this many days later',         unit: 'days',  min: 1, max: 365 },
  { key: 'starting_ease',            label: 'Starting ease',             hint: 'Initial ease factor (default 2.5)',                   unit: '',      min: 1.3, max: 3.5 },
  { key: 'minimum_ease',             label: 'Minimum ease',              hint: 'Cards ease can never drop below this',                unit: '',      min: 1.1, max: 2.5 },
  { key: 'hard_interval_factor',     label: 'Hard interval ×',           hint: 'On “Hard”: new interval = prev × this',               unit: '×',     min: 1.0, max: 2.0 },
  { key: 'easy_bonus',               label: 'Easy bonus ×',              hint: 'Extra multiplier on “Easy”',                          unit: '×',     min: 1.0, max: 2.5 },
  { key: 'lapse_new_interval_factor',label: 'After-lapse factor',        hint: 'When you fail: keep this fraction of prev interval',  unit: '×',     min: 0.0, max: 1.0 },
  { key: 'leech_threshold',          label: 'Leech threshold',           hint: 'After this many lapses → tagged as leech',            unit: 'lapses', min: 3, max: 20 },
  { key: 'maximum_interval',         label: 'Maximum interval',          hint: 'Cap for any interval',                                unit: 'days',  min: 30, max: 3650 },
  { key: 'mastered_threshold',       label: 'Mastered threshold',        hint: 'Once interval ≥ this ⇒ card is mastered',             unit: 'days',  min: 14, max: 365 },
];

function folderTitle(subject?: string|null, section?: string|null, microtopic?: string|null) {
  if (microtopic) return `${microtopic} (microtopic)`;
  if (section)    return `${section} (section)`;
  if (subject)    return `${subject} (subject)`;
  return 'Global defaults';
}

export function FolderAlgorithmModal({ visible, userId, subject, section, microtopic, onClose, onSaved }: Props) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState<AlgorithmSettings>(DEFAULT_SETTINGS);
  const [override, setOverride] = useState<Partial<AlgorithmSettings>>({});
  const [learningSteps, setLearningSteps] = useState<string>('1,10');
  const [relearningSteps, setRelearningSteps] = useState<string>('10');

  const folderKey = makeFolderKey(subject, section, microtopic);

  useEffect(() => {
    if (!visible || !userId) return;
    (async () => {
      setLoading(true);
      try {
        FolderSettingsSvc.invalidate(userId);
        const eff = await FolderSettingsSvc.resolve(userId, subject, section, microtopic);
        setResolved(eff);
        const row = await FolderSettingsSvc.getRaw(userId, folderKey);
        const ov = (row?.settings || {}) as Partial<AlgorithmSettings>;
        setOverride(ov);
        setLearningSteps((ov.learning_steps ?? eff.learning_steps).join(','));
        setRelearningSteps((ov.relearning_steps ?? eff.relearning_steps).join(','));
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, userId, folderKey]);

  const setField = (key: keyof AlgorithmSettings, raw: string) => {
    setOverride(prev => {
      const next = { ...prev };
      if (raw === '' || raw === undefined) {
        delete (next as any)[key];
      } else {
        const num = Number(raw);
        if (!Number.isFinite(num)) return prev;
        (next as any)[key] = num;
      }
      return next;
    });
  };

  const parseSteps = (raw: string): number[] | undefined => {
    const t = raw.trim();
    if (!t) return undefined;
    const parts = t.split(/[,\s]+/).map(x => Number(x)).filter(n => Number.isFinite(n) && n > 0);
    return parts.length ? parts : undefined;
  };

  const save = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const ls = parseSteps(learningSteps);
      const rs = parseSteps(relearningSteps);
      const payload: Partial<AlgorithmSettings> = { ...override };
      if (ls) payload.learning_steps = ls; else delete payload.learning_steps;
      if (rs) payload.relearning_steps = rs; else delete payload.relearning_steps;
      await FolderSettingsSvc.upsert(userId, folderKey, payload, true);
      onSaved?.();
      onClose();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    if (!userId) return;
    Alert.alert('Reset to inherit?', 'This folder will drop all custom overrides and inherit from its parent.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive', onPress: async () => {
          setLoading(true);
          try {
            await FolderSettingsSvc.reset(userId, folderKey);
            onSaved?.();
            onClose();
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const currentVal = (key: keyof AlgorithmSettings): number => {
    const v = override[key];
    if (v !== undefined) return v as number;
    return resolved[key] as number;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()} testID="folder-algo-modal">
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.titleSm, { color: colors.textTertiary }]}>Learning algorithm</Text>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{folderTitle(subject, section, microtopic)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}><X size={22} color={colors.textPrimary} /></TouchableOpacity>
          </View>

          <View style={[styles.infoBox, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
            <Info size={16} color={colors.primary} />
            <Text style={{ color: colors.textSecondary, fontSize: 12, flex: 1, lineHeight: 18 }}>
              Leave a field empty to inherit from the parent folder. Overrides cascade down to children unless they themselves override.
            </Text>
          </View>

          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingBottom: 12 }}>
              <Text style={[styles.group, { color: colors.textTertiary }]}>Learning steps (minutes, comma-separated)</Text>
              <TextInput
                value={learningSteps}
                onChangeText={setLearningSteps}
                placeholder={DEFAULT_SETTINGS.learning_steps.join(',')}
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.bg }]}
                keyboardType="numbers-and-punctuation"
                testID="input-learning-steps"
              />

              <Text style={[styles.group, { color: colors.textTertiary, marginTop: 14 }]}>Re-learning steps (minutes)</Text>
              <TextInput
                value={relearningSteps}
                onChangeText={setRelearningSteps}
                placeholder={DEFAULT_SETTINGS.relearning_steps.join(',')}
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.bg }]}
                keyboardType="numbers-and-punctuation"
                testID="input-relearning-steps"
              />

              {LABELS.map(row => {
                const overridden = override[row.key] !== undefined;
                return (
                  <View key={row.key} style={{ marginTop: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{row.label}</Text>
                      <Text style={[styles.unit, { color: overridden ? colors.primary : colors.textTertiary, fontWeight: overridden ? '900' : '700' }]}>
                        {overridden ? 'OVERRIDDEN' : 'INHERITED'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                      <TextInput
                        value={String(currentVal(row.key))}
                        onChangeText={(t) => setField(row.key, t)}
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.textTertiary}
                        style={[styles.input, { flex: 1, borderColor: overridden ? colors.primary : colors.border, color: colors.textPrimary, backgroundColor: colors.bg }]}
                        testID={`input-${row.key}`}
                      />
                      <Text style={{ color: colors.textTertiary, minWidth: 40 }}>{row.unit}</Text>
                    </View>
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>{row.hint}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.actions}>
            <TouchableOpacity onPress={reset} style={[styles.secBtn, { borderColor: colors.border }]} testID="reset-overrides">
              <RotateCcw size={16} color={colors.textPrimary} />
              <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} style={[styles.saveBtn, { backgroundColor: colors.primary }]} disabled={loading} testID="save-algo">
              <Text style={{ color: '#04223a', fontWeight: '900', fontSize: 16 }}>Save</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6 },
  titleSm: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 20, fontWeight: '900' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  infoBox: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10, marginVertical: 10, alignItems: 'center' },
  group: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '700' },
  fieldLabel: { fontSize: 14, fontWeight: '800' },
  unit: { fontSize: 10, letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1 },
  saveBtn: { flex: 1, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});

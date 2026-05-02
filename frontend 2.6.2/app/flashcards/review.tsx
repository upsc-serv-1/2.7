import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator,
  Animated, Dimensions, Modal, TextInput, ScrollView, Alert, Image,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, RotateCcw, Check, MoreVertical, Snowflake, Maximize2 } from 'lucide-react-native';
import { GestureHandlerRootView, PinchGestureHandler, State } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { FlashcardSvc, QueueCard } from '../../src/services/FlashcardService';
import { Grade, previewAllGrades, formatDuration, DEFAULT_SETTINGS } from '../../src/services/sm2';
import { FolderSettingsSvc } from '../../src/services/FolderSettingsService';
import { PageWrapper } from '../../src/components/PageWrapper';
import { supabase } from '../../src/lib/supabase';

const { width } = Dimensions.get('window');

export default function ReviewScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { microtopic, subject, section, mode, cardId, branchId, recursive } = useLocalSearchParams<any>();
  const uid = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [preview, setPreview] = useState<Record<Grade, { label: string }>>({
    again: { label: '<1m' }, hard: { label: '10m' }, good: { label: '4d' }, easy: { label: '7d' },
  });

  // session stats
  const [sessionSummary, setSessionSummary] = useState<{ reviewed: number; correct: number; elapsed: number } | null>(null);
  const sessionStart = useRef<number>(Date.now());
  const reviewedCount = useRef(0);
  const correctCount = useRef(0);

  // zoom
  const [editorFontSize, setEditorFontSize] = useState(18);
  const baseFontSize = useRef(18);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const zoomTimer = useRef<any>(null);

  // personal note modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [personalNote, setPersonalNote] = useState('');

  const revealAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { if (uid) { loadQueue(); loadZoomSetting(); } }, [uid]);

  const loadZoomSetting = async () => {
    try {
      const saved = await AsyncStorage.getItem('flashcard_font_size');
      if (saved) { const size = parseInt(saved, 10); setEditorFontSize(size); baseFontSize.current = size; }
    } catch {}
  };

  const loadQueue = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      let cards: QueueCard[] = [];
      if (cardId) {
        // Single-card mode ΓÇö study that specific card regardless of due state
        const { data: row, error } = await supabase
          .from('user_cards')
          .select('*, cards!inner(*)')
          .eq('user_id', uid).eq('card_id', cardId).maybeSingle();
        if (error) throw error;
        if (row) {
          const c = (row as any).cards;
          cards = [{
            id: c.id,
            front_text: c.front_text || c.question_text || '',
            back_text: c.back_text || c.answer_text || '',
            front_image_url: c.front_image_url, back_image_url: c.back_image_url,
            subject: c.subject, section_group: c.section_group, microtopic: c.microtopic,
            card_type: c.card_type || 'qa', source: c.source || {},
            correct_answer: c.correct_answer,
            state: {
              status: row.status, learning_status: row.learning_status,
              next_review: row.next_review, last_reviewed: row.last_reviewed,
              user_note: row.user_note,
              repetitions: row.repetitions ?? 0, interval_days: row.interval_days ?? 0,
              ease_factor: row.ease_factor ?? DEFAULT_SETTINGS.starting_ease,
              lapses: row.lapses ?? 0, learning_step: row.learning_step ?? null,
              is_relearning: row.is_relearning ?? false,
            },
            queue: 'learning',
          }];
        }
      } else if (branchId) {
        cards = await FlashcardSvc.getStudyQueue(uid, {
          branch_id: String(branchId),
          recursive: recursive === '1',
        });
      } else {
        cards = await FlashcardSvc.getStudyQueue(uid, {
          subject: subject ? String(subject) : undefined,
          section: section ? String(section) : undefined,
          microtopic: microtopic ? String(microtopic) : undefined,
        });
      }
      setQueue(cards);
      sessionStart.current = Date.now();
      reviewedCount.current = 0;
      correctCount.current = 0;
      if (cards.length > 0) await updatePreview(cards[0]);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err?.message || 'Could not load queue');
    } finally { setLoading(false); }
  }, [uid, subject, section, microtopic, cardId]);

  const updatePreview = useCallback(async (c: QueueCard) => {
    const settings = await FolderSettingsSvc.resolve(uid!, c.subject, c.section_group, c.microtopic);
    const p = previewAllGrades({
      ease_factor: c.state.ease_factor ?? settings.starting_ease,
      interval_days: c.state.interval_days ?? 0,
      repetitions: c.state.repetitions ?? 0,
      lapses: c.state.lapses ?? 0,
      learning_step: c.state.learning_step ?? ((c.state.repetitions ?? 0) > 0 ? -1 : 0),
      is_relearning: Boolean(c.state.is_relearning),
    }, settings);
    setPreview({
      again: { label: p.again.label },
      hard:  { label: p.hard.label },
      good:  { label: p.good.label },
      easy:  { label: p.easy.label },
    });
  }, [uid]);

  const handleReveal = () => {
    if (isFlipped) return;
    setIsFlipped(true);
    Animated.timing(revealAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const nextCard = async () => {
    if (currentIndex < queue.length - 1) {
      revealAnim.setValue(0); setIsFlipped(false); setSelectedOption(null); setShowCorrect(false);
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      await updatePreview(queue[nextIdx]);
    } else {
      // Session complete
      setSessionSummary({
        reviewed: reviewedCount.current,
        correct: correctCount.current,
        elapsed: Math.round((Date.now() - sessionStart.current) / 1000),
      });
      // Log study session
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase
          .from('study_sessions').select('*')
          .eq('user_id', uid).eq('date', today).maybeSingle();
        if (existing) {
          await supabase.from('study_sessions').update({
            cards_reviewed: (existing.cards_reviewed || 0) + reviewedCount.current,
            cards_correct: (existing.cards_correct || 0) + correctCount.current,
            duration_seconds: (existing.duration_seconds || 0) + Math.round((Date.now() - sessionStart.current) / 1000),
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id);
        } else {
          await supabase.from('study_sessions').insert({
            user_id: uid, date: today,
            cards_reviewed: reviewedCount.current,
            cards_correct: correctCount.current,
            duration_seconds: Math.round((Date.now() - sessionStart.current) / 1000),
          });
        }
      } catch (e) { /* non-fatal */ }
    }
  };

  const rate = async (grade: Grade) => {
    const card = queue[currentIndex];
    if (!card || !uid) return;
    try {
      reviewedCount.current += 1;
      if (grade === 'good' || grade === 'easy') correctCount.current += 1;
      await FlashcardSvc.reviewCard(uid, card.id, grade);
      setIsFlipped(false); setShowCorrect(false); revealAnim.setValue(0);
      await nextCard();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save review.');
      console.error(err);
    }
  };

  const freezeCard = async () => {
    const card = queue[currentIndex]; if (!card || !uid) return;
    try {
      await FlashcardSvc.freezeCard(uid, card.id);
      const nextQueue = queue.filter((_, i) => i !== currentIndex);
      setQueue(nextQueue);
      setShowEditModal(false);
      if (nextQueue.length === 0) {
        setSessionSummary({ reviewed: reviewedCount.current, correct: correctCount.current, elapsed: Math.round((Date.now() - sessionStart.current) / 1000) });
      } else if (currentIndex >= nextQueue.length) {
        setCurrentIndex(0); await updatePreview(nextQueue[0]);
      } else {
        await updatePreview(nextQueue[currentIndex]);
      }
      setIsFlipped(false); revealAnim.setValue(0);
    } catch (e: any) { Alert.alert('Failed', e?.message); }
  };

  const savePersonalNote = async () => {
    const card = queue[currentIndex]; if (!card || !uid) return;
    try {
      await FlashcardSvc.saveNote(uid, card.id, personalNote);
      setShowEditModal(false);
      const nq = [...queue]; nq[currentIndex] = { ...nq[currentIndex], state: { ...nq[currentIndex].state, user_note: personalNote } };
      setQueue(nq);
    } catch (e: any) { Alert.alert('Failed', e?.message); }
  };

  const onPinchGestureEvent = (event: any) => {
    const scale = event.nativeEvent.scale;
    let nextSize = baseFontSize.current * scale;
    nextSize = Math.max(12, Math.min(40, nextSize));
    setEditorFontSize(Math.round(nextSize));
    setShowZoomIndicator(true);
    if (zoomTimer.current) clearTimeout(zoomTimer.current);
    zoomTimer.current = setTimeout(() => setShowZoomIndicator(false), 1500);
  };
  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      baseFontSize.current = editorFontSize;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      AsyncStorage.setItem('flashcard_font_size', editorFontSize.toString()).catch(() => {});
    }
  };

  // ===== render states =====

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (sessionSummary) {
    const acc = sessionSummary.reviewed > 0 ? Math.round((sessionSummary.correct / sessionSummary.reviewed) * 100) : 0;
    const mins = Math.floor(sessionSummary.elapsed / 60), secs = sessionSummary.elapsed % 60;
    return (
      <PageWrapper>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Check size={64} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary, marginTop: 16 }]}>Session complete</Text>
            <View style={{ flexDirection: 'row', gap: 28, marginTop: 28 }}>
              <Summary num={sessionSummary.reviewed} label="Reviewed" color={colors.textPrimary} />
              <Summary num={`${acc}%`} label="Accuracy" color="#22c55e" />
              <Summary num={`${mins}:${secs.toString().padStart(2, '0')}`} label="Time" color="#3b82f6" />
            </View>
            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()} testID="btn-summary-done">
              <Text style={[styles.doneBtnText, { color: '#04223a' }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </PageWrapper>
    );
  }

  if (queue.length === 0) {
    return (
      <View style={styles.center}>
        <Check size={64} color={colors.primary} />
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>All caught up!</Text>
        <Text style={[styles.emptySub, { color: colors.textTertiary }]}>No cards are due right now.</Text>
        <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()} testID="btn-empty-done">
          <Text style={[styles.doneBtnText, { color: '#04223a' }]}>Return</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentCard = queue[currentIndex];
  const opts = (currentCard.source as any)?.options ?? {};
  const hasOptions = currentCard.card_type === 'qa' && Object.keys(opts).length > 0;
  const questionText = hasOptions
    ? stripQuestionOptions(currentCard.front_text || '', Object.entries(opts).map(([k]) => String(k)))
    : (currentCard.front_text || '');

  return (
    <PageWrapper>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} testID="btn-exit"><X size={24} color={colors.textPrimary} /></TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.progressText, { color: colors.textTertiary }]}>{currentIndex + 1} of {queue.length}</Text>
            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
              <View style={[styles.progressBarFill, { width: `${((currentIndex + 1) / queue.length) * 100}%`, backgroundColor: colors.primary }]} />
            </View>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={() => { setPersonalNote(currentCard.state?.user_note || ''); setShowEditModal(true); }} testID="btn-more">
            <MoreVertical size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* CARD AREA */}
        <GestureHandlerRootView style={{ flex: 1 }}>
          <PinchGestureHandler onGestureEvent={onPinchGestureEvent} onHandlerStateChange={onPinchHandlerStateChange}>
            <ScrollView 
              style={{ flex: 1 }} 
              contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
            >
              <Pressable 
                onPress={handleReveal}
                style={[styles.scrollCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                {/* QUESTION SECTION */}
                <View style={styles.sectionHeader}>
                  <Text style={[styles.cardSideLabel, { color: colors.primary, marginBottom: 0 }]}>QUESTION</Text>
                </View>
                
                <Text style={[styles.cardText, { color: colors.textPrimary, fontSize: editorFontSize, lineHeight: editorFontSize * 1.5, marginTop: 16 }]}>
                  {questionText}
                </Text>

                {hasOptions && Object.entries(opts).map(([k, v]) => {
                  const isSelected = selectedOption === k;
                  const isCorrectOption = (currentCard.correct_answer || '').toLowerCase() === String(k).toLowerCase();
                  let optBg = colors.surface;
                  let optBorder = colors.border;
                  if (showCorrect) {
                    if (isCorrectOption) { optBg = '#22c55e20'; optBorder = '#22c55e'; }
                    else if (isSelected) { optBg = '#ef444420'; optBorder = '#ef4444'; }
                  } else if (isSelected) { optBg = colors.primary + '15'; optBorder = colors.primary; }

                  return (
                    <TouchableOpacity
                      key={k}
                      onPress={() => {
                        if (!isFlipped && !showCorrect) {
                          setSelectedOption(k); 
                          setShowCorrect(true);
                          handleReveal();
                          Haptics.notificationAsync(isCorrectOption ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
                        }
                      }}
                      style={{ flexDirection: 'row', marginTop: 10, gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, backgroundColor: optBg, borderColor: optBorder }}
                      testID={`opt-${k}`}
                    >
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: isSelected ? (showCorrect ? (isCorrectOption ? '#22c55e' : '#ef4444') : colors.primary) : colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontWeight: '900', color: isSelected ? '#fff' : colors.textTertiary, fontSize: 12 }}>{String(k).toUpperCase()}</Text>
                      </View>
                      <Text style={{ flex: 1, color: colors.textPrimary, fontSize: editorFontSize - 4, fontWeight: isSelected ? '700' : '400' }}>{v as string}</Text>
                    </TouchableOpacity>
                  );
                })}

                {currentCard.front_image_url && (
                  <Image source={{ uri: currentCard.front_image_url }} resizeMode="contain" style={{ width: '100%', height: 200, marginTop: 16, borderRadius: 12 }} />
                )}

                {/* REVEAL HINT */}
                {!isFlipped && (
                  <View style={[styles.flipHint, { marginTop: 30 }]}>
                    <RotateCcw size={14} color={colors.textTertiary} />
                    <Text style={[styles.flipHintText, { color: colors.textTertiary }]}>
                      {hasOptions && !showCorrect ? 'Select an option or tap to reveal' : 'Tap to reveal answer'}
                    </Text>
                  </View>
                )}

                {/* ANSWER SECTION (Conditional) */}
                {isFlipped && (
                  <Animated.View style={{ opacity: revealAnim, marginTop: 24 }}>
                    <View style={[styles.divider, { backgroundColor: colors.border, marginBottom: 24 }]} />
                    <Text style={[styles.cardSideLabel, { color: '#34c759', textAlign: 'left' }]}>ANSWER & EXPLANATION</Text>
                    
                    <Text style={[styles.answerText, { color: colors.textPrimary, fontSize: editorFontSize - 2, lineHeight: (editorFontSize - 2) * 1.5, marginTop: 12, textAlign: 'left' }]}>
                      {currentCard.back_text}
                    </Text>

                    {currentCard.back_image_url && (
                      <Image source={{ uri: currentCard.back_image_url }} style={{ width: '100%', height: 200, borderRadius: 12, marginTop: 16 }} resizeMode="contain" />
                    )}

                    {currentCard.state?.user_note ? (
                      <View style={[styles.noteBox, { backgroundColor: colors.primary + '10', marginTop: 24 }]}>
                        <Text style={[styles.noteLabel, { color: colors.primary }]}>PERSONAL NOTE</Text>
                        <Text style={[styles.noteText, { color: colors.textSecondary }]}>{currentCard.state.user_note}</Text>
                      </View>
                    ) : null}
                  </Animated.View>
                )}
              </Pressable>
            </ScrollView>
          </PinchGestureHandler>
        </GestureHandlerRootView>

        {showZoomIndicator && (
          <View style={styles.zoomIndicator}>
            <Maximize2 size={16} color="#fff" />
            <Text style={styles.zoomText}>{editorFontSize}px</Text>
          </View>
        )}

        {/* ACTIONS */}
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          {isFlipped ? (
            <View style={styles.qualityRow}>
              {[
                { g: 'again' as Grade, label: 'Again', color: colors.error || '#ef4444' },
                { g: 'hard'  as Grade, label: 'Hard',  color: '#f59e0b' },
                { g: 'good'  as Grade, label: 'Good',  color: colors.primary },
                { g: 'easy'  as Grade, label: 'Easy',  color: '#22c55e' },
              ].map(({ g, label, color }) => (
                <TouchableOpacity key={g} style={[styles.qBtn, { borderColor: color }]} onPress={() => rate(g)} testID={`btn-grade-${g}`}>
                  <Text style={[styles.qBtnLabel, { color }]}>{label}</Text>
                  <Text style={[styles.qBtnSub, { color: colors.textTertiary }]}>{preview[g]?.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TouchableOpacity style={[styles.showBtn, { backgroundColor: colors.primary }]} onPress={handleReveal} testID="btn-show-answer">
              <Text style={[styles.showBtnText, { color: '#04223a' }]}>Show Answer</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* EDIT / NOTE MODAL */}
        <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 20}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Card tools</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}><X size={24} color={colors.textPrimary} /></TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                contentContainerStyle={styles.modalScrollContent}
              >
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Personal Notes / Tricks</Text>
                <TextInput
                  style={[styles.noteInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                  multiline
                  placeholder="Add your own memory aids..."
                  placeholderTextColor={colors.textTertiary}
                  value={personalNote}
                  onChangeText={setPersonalNote}
                  textAlignVertical="top"
                  testID="review-note-input"
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ef444420' }]} onPress={freezeCard} testID="btn-freeze">
                    <Snowflake size={20} color="#ef4444" />
                    <Text style={{ color: '#ef4444', fontWeight: '700' }}>Freeze Card</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={savePersonalNote} testID="btn-save-note">
                    <Text style={{ color: '#04223a', fontWeight: '900' }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </PageWrapper>
  );
}

function stripQuestionOptions(frontText: string, optionKeys: string[]) {
  if (!frontText?.trim()) return '';
  const keys = optionKeys.map(k => k.toLowerCase());
  const lines = frontText.split(/\r?\n/);
  const kept = lines.filter((line) => {
    const trimmed = line.trim();
    const m = trimmed.match(/^\(?([a-z0-9]+)\)?[\.:\-\)]\s+/i) || trimmed.match(/^\(?([a-z0-9]+)\)\s+/i);
    if (!m) return true;
    return !keys.includes(m[1].toLowerCase());
  });
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function Summary({ num, label, color }: any) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color, fontSize: 28, fontWeight: '900' }}>{num}</Text>
      <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '700', marginTop: 4 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, justifyContent: 'space-between' },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  progressText: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  progressBarBg: { width: 120, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%' },
  scrollCard: { padding: 24, borderRadius: 28, borderWidth: 1, minHeight: 400 },
  sectionHeader: { alignItems: 'center', marginBottom: 12 },
  cardSideLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  cardText: { fontWeight: '700', textAlign: 'left' },
  answerText: { fontWeight: '600', textAlign: 'left' },
  divider: { height: 1, width: '100%' },
  zoomIndicator: { position: 'absolute', top: 100, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoomText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  flipHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  flipHintText: { fontSize: 13, fontWeight: '600' },
  noteBox: { marginTop: 30, padding: 16, borderRadius: 16 },
  noteLabel: { fontSize: 10, fontWeight: '900', marginBottom: 8 },
  noteText: { fontSize: 14, fontWeight: '500', lineHeight: 22 },
  actions: { padding: 20, borderTopWidth: 1 },
  showBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  showBtnText: { fontSize: 16, fontWeight: '900' },
  emptyTitle: { fontSize: 26, fontWeight: '900' },
  emptySub: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  doneBtn: { marginTop: 32, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  doneBtnText: { fontWeight: '900', fontSize: 16 },
  qualityRow: { flexDirection: 'row', gap: 8 },
  qBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 2, alignItems: 'center' },
  qBtnLabel: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  qBtnSub: { fontSize: 11, marginTop: 4, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 30, maxHeight: '82%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '900' },
  modalScrollContent: { paddingBottom: 14 },
  inputLabel: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  noteInput: { minHeight: 150, borderRadius: 20, borderWidth: 1, padding: 16, textAlignVertical: 'top', fontSize: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});

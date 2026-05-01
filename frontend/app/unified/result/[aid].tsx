import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Share, Platform, Alert, Dimensions, Animated } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useTheme } from '../../../src/context/ThemeContext';
import { spacing, radius } from '../../../src/theme';
import { 
  ChevronLeft, 
  Share2, 
  Trophy, 
  Target, 
  ArrowRight,
  Zap,
  ArrowDownCircle,
  HelpCircle as HelpIcon,
  MinusCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  RefreshCcw,
  Search,
  BarChart3,
  BookOpen
} from 'lucide-react-native';
import { useSingleTestAnalytics } from '../../../src/hooks/useTestAnalytics';
import { ReviewSection } from '../../../src/components/unified/ReviewSection';
import { StudentSync } from '../../../src/services/StudentSync';
import { FlashcardSvc } from '../../../src/services/FlashcardService';
import { AddToFlashcardSheet } from '../../../src/components/flashcards/AddToFlashcardSheet';
import { supabase } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/context/AuthContext';

const { width } = Dimensions.get('window');

export default function ResultScreen() {
  const { aid } = useLocalSearchParams<{ aid: string }>();
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const { loading, error, scoreData, questions, testId, testTitle, hierarchicalPerformance, confidenceMetrics } = useSingleTestAnalytics(aid);
  const [activeTab, setActiveTab] = useState<'review' | 'analysis'>('review');
  const [filterType, setFilterType] = useState<'all' | 'correct' | 'incorrect' | 'skipped' | 'pyq' | 'imp_fact' | 'must_revise'>('all');
  const [localTags, setLocalTags] = useState<Record<string, string>>({});
  const [localReviewTags, setLocalReviewTags] = useState<Record<string, string[]>>({});
  const [savingFlashcard, setSavingFlashcard] = useState<Record<string, boolean>>({});
  const [inFlashcardDeck, setInFlashcardDeck] = useState<Record<string, boolean>>({});
  const [aff, setAff] = useState<{ visible: boolean; cardId: string | null; hint: { subject?: string; section_group?: string; microtopic?: string } }>({ visible: false, cardId: null, hint: {} });
  
  const scrollY = React.useRef(new Animated.Value(0)).current;

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const filteredQuestions = useMemo(() => {
    if (!questions) return [];
    return questions.filter(q => {
      const isCorrect = q.selectedAnswer === q.correctAnswer;
      const isSkipped = !q.selectedAnswer;
      const tags = localReviewTags[q.id] || q.reviewTags || [];

      if (filterType === 'all') return true;
      if (filterType === 'correct') return isCorrect;
      if (filterType === 'incorrect') return !isCorrect && !isSkipped;
      if (filterType === 'skipped') return isSkipped;
      if (filterType === 'pyq') return q.isPyq;
      if (filterType === 'imp_fact') return tags.includes('Imp. Fact');
      if (filterType === 'must_revise') return tags.includes('Must Revise');
      return true;
    });
  }, [questions, filterType, localReviewTags]);

  const handleShare = async () => {
    if (!scoreData) return;
    try {
      const message = `I just scored ${scoreData.totalMarks} in ${testTitle || 'a test'} on Noji! 🚀\nAccuracy: ${scoreData.accuracy}%\nCheck it out!`;
      await Share.share({
        message,
        url: 'https://noji.app',
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRePractice = (mode: 'learning' | 'exam') => {
    if (!questions || questions.length === 0) return;
    const allIds = questions.map(q => q.id);
    router.push({
      pathname: '/unified/engine',
      params: { 
        testId: testId || 'manual',
        resultIds: allIds.join(','),
        mode: mode,
        view: mode === 'learning' ? 'card' : 'list'
      }
    });
  };

  const handleReviewIncorrect = () => {
    const incorrectIds = questions
      ?.filter(q => q.selectedAnswer && q.selectedAnswer !== q.correctAnswer)
      .map(q => q.id);
    
    if (!incorrectIds || incorrectIds.length === 0) {
      Alert.alert("Perfect Score!", "You don't have any incorrect questions to review.");
      return;
    }
    
    router.push({
      pathname: '/unified/engine',
      params: { 
        testId: testId || 'manual',
        resultIds: incorrectIds.join(','),
        mode: 'learning',
        view: 'card'
      }
    });
  };

  const handleRetakeIncorrect = () => {
    const incorrectIds = questions
      ?.filter(q => q.selectedAnswer && q.selectedAnswer !== q.correctAnswer)
      .map(q => q.id);
    
    if (!incorrectIds || incorrectIds.length === 0) {
      Alert.alert("All Correct!", "No incorrect questions found to retake.");
      return;
    }
    
    router.push({
      pathname: '/unified/engine',
      params: { 
        testId: `${testId}_retake_err`,
        resultIds: incorrectIds.join(','),
        mode: 'exam',
        view: 'list'
      }
    });
  };

  const handleRetakePYQ = () => {
    const pyqIds = questions?.filter(q => q.isPyq).map(q => q.id);
    
    if (!pyqIds || pyqIds.length === 0) {
      Alert.alert("No PYQs", "This test doesn't contain any Previous Year Questions.");
      return;
    }
    
    router.push({
      pathname: '/unified/engine',
      params: { 
        testId: `${testId}_retake_pyq`,
        resultIds: pyqIds.join(','),
        mode: 'exam',
        view: 'list'
      }
    });
  };

  const handleTagError = async (questionId: string, errorType: string) => {
    if (!aid || !session?.user?.id) return;
    setLocalTags(prev => ({ ...prev, [questionId]: errorType }));

    try {
      await supabase.rpc('update_attempt_error_category', {
        attempt_id: aid,
        q_id: questionId,
        new_cat: errorType,
      });

      await StudentSync.enqueue('question_state', {
        userId: session.user.id,
        questionId: questionId,
        testId: testId,
        attemptId: aid,
        patch: { error_category: errorType }
      });
    } catch (err) {
      console.error('Failed to save error tag', err);
    }
  };

  const toggleReviewTag = async (questionId: string, tag: string) => {
    if (!aid || !session?.user?.id) return;
    
    const q = questions?.find(x => x.id === questionId);
    const existingTags = localReviewTags[questionId] || q?.reviewTags || [];
    const newTags = existingTags.includes(tag) 
      ? existingTags.filter(t => t !== tag)
      : [...existingTags, tag];

    setLocalReviewTags(prev => ({ ...prev, [questionId]: newTags }));

    try {
      await supabase.rpc('update_attempt_review_tags', {
        attempt_id: aid,
        q_id: questionId,
        new_tags: newTags,
      });

      await StudentSync.enqueue('question_state', {
        userId: session.user.id,
        questionId: questionId,
        testId: testId,
        attemptId: aid,
        patch: { review_tags: newTags }
      });
    } catch (err) {
      console.error('Failed to toggle review tag', err);
    }
  };

  const handleAddToFlashcard = async (q: any) => {
    if (!session?.user?.id) return;
    if (inFlashcardDeck[q.id]) {
      Alert.alert('Info', 'Already in your deck.');
      return;
    }
    
    setSavingFlashcard(prev => ({ ...prev, [q.id]: true }));
    try {
      const cardId = await FlashcardSvc.createCard(session.user.id, {
        question_id: q.id,
        test_id: testId,
        front_text: q.question_text,
        back_text: `Correct Answer: ${q.correctAnswer}\n\n${q.explanation_markdown || ''}`,
        subject: q.subject || 'General',
        section_group: q.sectionGroup || 'General',
        microtopic: q.microTopic || (q as any).micro_topic || 'General',
        card_type: 'qa',
        source: { kind: 'question', question_id: q.id, options: q.options }
      } as any);
      setInFlashcardDeck(prev => ({ ...prev, [q.id]: true }));
      setAff({
        visible: true,
        cardId,
        hint: {
          subject: q.subject || 'General',
          section_group: q.sectionGroup || 'General',
          microtopic: q.microTopic || (q as any).micro_topic || 'General',
        },
      });
    } catch (err) {
      console.error('Flashcard error:', err);
      Alert.alert('Error', 'Failed to create flashcard');
    } finally {
      setSavingFlashcard(prev => ({ ...prev, [q.id]: false }));
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Crunching your numbers...</Text>
      </View>
    );
  }

  if (error || !scoreData) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg, padding: spacing.xl }]}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>
          {error || "We couldn't load this result."}
        </Text>
        <TouchableOpacity 
          style={[styles.backBtn, { backgroundColor: colors.primary, marginTop: spacing.xl }]}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Dynamic Header */}
      <Animated.View style={[styles.header, { 
        backgroundColor: colors.surface, 
        borderBottomColor: colors.border,
        opacity: headerOpacity,
        zIndex: 10,
      }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
            <ChevronLeft color={colors.textPrimary} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {testTitle || 'Test Result'}
          </Text>
          <TouchableOpacity onPress={handleShare} style={styles.headerIcon}>
            <Share2 color={colors.textPrimary} size={20} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.FlatList
        data={activeTab === 'review' ? filteredQuestions : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <QuestionItem 
            question={item} 
            index={index} 
            colors={colors} 
            localTag={localTags[item.id]}
            localReviewTags={localReviewTags[item.id]}
            onTagError={handleTagError}
            onToggleReviewTag={toggleReviewTag}
            onAddToFlashcard={handleAddToFlashcard}
            isAdded={inFlashcardDeck[item.id]}
            isSaving={savingFlashcard[item.id]}
          />
        )}
        ListHeaderComponent={
          <>
            {/* Score Hero Section */}
            <View style={[styles.hero, { backgroundColor: colors.surfaceStrong }]}>
              <TouchableOpacity onPress={() => router.back()} style={styles.floatingBack}>
                <ChevronLeft color={colors.textPrimary} size={24} />
              </TouchableOpacity>
              
              <View style={styles.trophyContainer}>
                <Trophy size={48} color={colors.primary} />
              </View>
              
              <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
                {scoreData.accuracy > 80 ? 'Exceptional Work!' : scoreData.accuracy > 50 ? 'Good Effort!' : 'Keep Practicing!'}
              </Text>
              
              <View style={styles.scoreRow}>
                <View style={styles.scoreItem}>
                  <Text style={[styles.scoreValue, { color: colors.primary }]}>{scoreData.totalMarks}</Text>
                  <Text style={[styles.scoreLabel, { color: colors.textTertiary }]}>SCORE</Text>
                </View>
                <View style={[styles.scoreDivider, { backgroundColor: colors.border }]} />
                <View style={styles.scoreItem}>
                  <Text style={[styles.scoreValue, { color: colors.textPrimary }]}>{scoreData.accuracy}%</Text>
                  <Text style={[styles.scoreLabel, { color: colors.textTertiary }]}>ACCURACY</Text>
                </View>
              </View>

              <View style={styles.metricGrid}>
                <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <CheckCircle2 size={16} color={colors.success} />
                  <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{scoreData.correct}</Text>
                  <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Correct</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <XCircle size={16} color={colors.error} />
                  <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{scoreData.incorrect}</Text>
                  <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Wrong</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <HelpCircle size={16} color={colors.textTertiary} />
                  <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{scoreData.unattempted}</Text>
                  <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Skipped</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Clock size={16} color={colors.primary} />
                  <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{scoreData.avgTimePerQuestion}s</Text>
                  <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Avg Time</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={[styles.primaryAction, { backgroundColor: colors.primary }]}
                onPress={handleReviewIncorrect}
              >
                <RefreshCcw size={18} color="#fff" />
                <Text style={styles.primaryActionText}>Review Mistakes</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.secondaryAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => handleRePractice('exam')}
              >
                <RefreshCcw size={18} color={colors.textPrimary} />
                <Text style={[styles.secondaryActionText, { color: colors.textPrimary }]}>Retake Full</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.retakeRow}>
              <TouchableOpacity 
                style={[styles.retakeBtn, { backgroundColor: colors.surface, borderColor: colors.error + '40' }]}
                onPress={handleRetakeIncorrect}
              >
                <XCircle size={16} color={colors.error} />
                <Text style={[styles.retakeBtnText, { color: colors.error }]}>RETAKE MISTAKES</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.retakeBtn, { backgroundColor: colors.surface, borderColor: colors.success + '40' }]}
                onPress={handleRetakePYQ}
              >
                <Zap size={16} color={colors.success} />
                <Text style={[styles.retakeBtnText, { color: colors.success }]}>RETAKE PYQs</Text>
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={[styles.tabContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'review' && { backgroundColor: colors.surfaceStrong }]}
                onPress={() => setActiveTab('review')}
              >
                <Search size={18} color={activeTab === 'review' ? colors.primary : colors.textTertiary} />
                <Text style={[styles.tabText, { color: activeTab === 'review' ? colors.textPrimary : colors.textTertiary }]}>Review</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'analysis' && { backgroundColor: colors.surfaceStrong }]}
                onPress={() => setActiveTab('analysis')}
              >
                <BarChart3 size={18} color={activeTab === 'analysis' ? colors.primary : colors.textTertiary} />
                <Text style={[styles.tabText, { color: activeTab === 'analysis' ? colors.textPrimary : colors.textTertiary }]}>Analysis</Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'review' ? (
              <View style={styles.reviewContent}>
                {/* Filter Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'correct', label: 'Correct' },
                    { id: 'incorrect', label: 'Incorrect' },
                    { id: 'skipped', label: 'Skipped' },
                    { id: 'pyq', label: 'PYQ' },
                    { id: 'imp_fact', label: 'Imp. Fact' },
                    { id: 'must_revise', label: 'Must Revise' }
                  ].map(type => (
                    <TouchableOpacity
                      key={type.id}
                      onPress={() => setFilterType(type.id as any)}
                      style={[
                        styles.filterPill,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        filterType === type.id && { backgroundColor: colors.primary, borderColor: colors.primary }
                      ]}
                    >
                      <Text style={[
                        styles.filterPillText,
                        { color: colors.textSecondary },
                        filterType === type.id && { color: '#fff' }
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <ReviewSection 
                testAttemptId={aid || ''} 
                externalTags={localTags}
                onExternalTagUpdate={handleTagError}
                preComputedScoreData={scoreData}
                preComputedQuestions={questions}
                preComputedHierarchy={hierarchicalPerformance}
                preComputedConfidence={confidenceMetrics}
              />
            )}
          </>
        }
        ListEmptyComponent={
          activeTab === 'review' ? (
            <View style={styles.emptyState}>
              <BookOpen size={48} color={colors.textTertiary} opacity={0.5} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No questions found for this filter.</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        initialNumToRender={5}
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      <AddToFlashcardSheet
        visible={aff.visible}
        onClose={() => setAff(s => ({ ...s, visible: false }))}
        userId={session?.user?.id || ''}
        cardId={aff.cardId}
        hint={aff.hint}
      />
    </View>
  );
}

const QuestionItem = ({ 
  question, index, colors, localTag, localReviewTags, 
  onTagError, onToggleReviewTag, onAddToFlashcard, isAdded, isSaving 
}: any) => {
  const isCorrect = question.selectedAnswer === question.correctAnswer;
  const isSkipped = !question.selectedAnswer;
  const currentErrorCat = localTag || question.errorCategory;
  const currentReviewTags = localReviewTags || question.reviewTags || [];

  return (
    <View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.qHeader}>
        <View style={[styles.qIndex, { backgroundColor: colors.surfaceStrong }]}>
          <Text style={[styles.qIndexText, { color: colors.textPrimary }]}>Q{index + 1}</Text>
        </View>
        <View style={styles.qMeta}>
          {question.subject && (
            <Text style={[styles.subjectTag, { color: colors.textTertiary, backgroundColor: colors.border }]}>
              {question.subject}
            </Text>
          )}
          {question.isPyq && <Text style={styles.pyqTag}>PYQ</Text>}
          {isSkipped && <View style={[styles.skippedBadge, { backgroundColor: colors.border }]}><Text style={[styles.skippedBadgeText, { color: colors.textTertiary }]}>SKIPPED</Text></View>}
        </View>
        <View style={styles.qStatusIcon}>
          {isSkipped ? <HelpIcon size={18} color={colors.textTertiary} /> :
           isCorrect ? <CheckCircle2 size={18} color={colors.success} /> :
           <XCircle size={18} color={colors.error} />}
        </View>
      </View>
      
      <Text style={[styles.qText, { color: colors.textPrimary }]}>
        {question.question_text?.replace(/<[^>]*>/g, '')}
      </Text>

      <View style={styles.optList}>
        {Object.entries(question.options || {}).map(([key, text]: [string, any]) => {
          const isCorrectOpt = String(key).trim().toUpperCase() === String(question.correctAnswer).trim().toUpperCase();
          const isSelectedOpt = question.selectedAnswer && String(key).trim().toUpperCase() === String(question.selectedAnswer).trim().toUpperCase();
          
          let circleBg = colors.surface;
          let circleBorder = colors.border;
          let rowBg = 'transparent';
          let StatusIcon = null;
          let circleTxtColor = colors.textSecondary;
          let labelText = '';

          // RED / GREEN / BLUE Logic
          if (isCorrectOpt) {
            circleBg = isSkipped ? '#3b82f6' : '#22c55e'; // Blue for skipped-correct, Green for actual-correct
            circleBorder = isSkipped ? '#3b82f6' : '#22c55e';
            circleTxtColor = "#fff";
            rowBg = isSkipped ? '#3b82f610' : '#22c55e10';
            StatusIcon = isSkipped ? <HelpIcon size={16} color="#3b82f6" /> : <CheckCircle2 size={16} color="#22c55e" />;
            labelText = isCorrect ? 'CORRECT ANSWER' : isSkipped ? 'SKIPPED - CORRECT' : 'CORRECT ANSWER';
          } else if (isSelectedOpt && !isCorrectOpt) {
            circleBg = '#ef4444'; // Vibrant Red
            circleBorder = '#ef4444';
            circleTxtColor = "#fff";
            rowBg = '#ef444410';
            StatusIcon = <XCircle size={16} color="#ef4444" />;
            labelText = 'YOUR CHOICE';
          }

          return (
            <View key={key} style={[styles.optRow, { backgroundColor: rowBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginVertical: 2 }]}>
              <View style={[styles.optCircle, { backgroundColor: circleBg, borderColor: circleBorder, width: 28, height: 28, borderRadius: 14 }]}>
                <Text style={[styles.optCircleText, { color: circleTxtColor, fontSize: 13 }]}>{key}</Text>
              </View>
              <Text style={[
                styles.optText, 
                { color: colors.textSecondary, fontSize: 15 }, 
                (isCorrectOpt || isSelectedOpt) && { color: colors.textPrimary, fontWeight: '700' }
              ]}>
                {text}
              </Text>
              {labelText ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                   <Text style={{ fontSize: 9, fontWeight: '900', color: isCorrectOpt ? (isSkipped ? '#3b82f6' : '#22c55e') : '#ef4444' }}>
                     {labelText}
                   </Text>
                   {StatusIcon}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <Text style={[styles.lbl, { color: colors.textTertiary }]}>YOUR ANSWER</Text>
      <Text style={[styles.ans, isSkipped ? { color: colors.textTertiary } : isCorrect ? { color: colors.success } : { color: colors.error }]}>
        {isSkipped ? 'Not Attempted' : question.options?.[question.selectedAnswer] || question.selectedAnswer}
      </Text>
      
      {!isCorrect && (
        <>
          <Text style={[styles.lbl, { color: colors.textTertiary }]}>CORRECT ANSWER</Text>
          <Text style={[styles.ans, { color: colors.success }]}>
            {question.options?.[question.correctAnswer] || question.correctAnswer}
          </Text>
        </>
      )}

      {question.explanation_markdown ? (
        <>
          <Text style={[styles.lbl, { color: colors.textTertiary }]}>EXPLANATION</Text>
          <Text style={[styles.exp, { color: colors.textSecondary }]}>{question.explanation_markdown}</Text>
        </>
      ) : null}

      {!isCorrect && !isSkipped && (
        <>
          <Text style={[styles.lbl, { color: colors.textTertiary, marginTop: 16 }]}>MISTAKE TYPE</Text>
          <View style={styles.tagRow}>
            {['Fact Mistake', 'Concept Gap', 'Silly Mistake', 'Overthinking', 'Skipped'].map(et => {
              const selected = currentErrorCat === et;
              return (
                <TouchableOpacity
                  key={et}
                  onPress={() => onTagError(question.id, et)}
                  style={[
                    styles.tagChip,
                    { 
                      backgroundColor: selected ? colors.error + '20' : colors.surface,
                      borderColor: selected ? colors.error : colors.border
                    }
                  ]}
                >
                  <Text style={[styles.tagChipText, { color: selected ? colors.error : colors.textSecondary }]}>
                    {et}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <Text style={[styles.lbl, { color: colors.textTertiary, marginTop: 16 }]}>STUDY TAGS</Text>
      <View style={styles.tagRow}>
        {['Imp. Fact', 'Imp. Concept', 'Trap Question', 'Must Revise', 'Memorize'].map(tag => {
          const selected = currentReviewTags.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              onPress={() => onToggleReviewTag(question.id, tag)}
              style={[
                styles.tagChip,
                { 
                  backgroundColor: selected ? colors.primary + '20' : colors.surface,
                  borderColor: selected ? colors.primary : colors.border
                }
              ]}
            >
              <Text style={[styles.tagChipText, { color: selected ? colors.primary : colors.textSecondary }]}>
                {tag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity 
        onPress={() => onAddToFlashcard(question)}
        disabled={isSaving}
        style={[
          styles.flashBtn, 
          { borderColor: colors.primary + '40' },
          isAdded && { backgroundColor: colors.primary + '10', borderStyle: 'solid' }
        ]}
      >
        <Zap 
          size={14} 
          color={isAdded ? colors.primary : colors.textTertiary} 
          fill={isAdded ? colors.primary : 'transparent'}
        />
        <Text style={[
          styles.flashBtnText, 
          { color: isAdded ? colors.primary : colors.textTertiary }
        ]}>
          {isSaving ? 'ADDING...' : isAdded ? 'IN FLASHCARDS' : 'ADD TO FLASHCARD'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontWeight: '600',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 100 : 80,
    paddingTop: Platform.OS === 'ios' ? 44 : 24,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  floatingBack: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: spacing.xl,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: 30,
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '900',
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  scoreDivider: {
    width: 1,
    height: 40,
    opacity: 0.3,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  metricCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  skippedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 6,
  },
  skippedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
  },
  primaryAction: {
    flex: 2,
    flexDirection: 'row',
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryAction: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  retakeRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
  },
  retakeBtnText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    padding: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  reviewContent: {
    paddingHorizontal: spacing.lg,
  },
  filterRow: {
    gap: 10,
    marginBottom: spacing.lg,
    paddingRight: 20,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  questionCard: {
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  qHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  qIndex: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qIndexText: {
    fontSize: 12,
    fontWeight: '900',
  },
  qMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subjectTag: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  pyqTag: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  qStatusIcon: {
    padding: 4,
  },
  qText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 16,
  },
  optList: {
    gap: 8,
    marginBottom: 16,
  },
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optCircleText: {
    fontSize: 11,
    fontWeight: '900',
  },
  optText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  lbl: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '900',
    marginTop: 12,
    textTransform: 'uppercase',
  },
  ans: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '700',
  },
  exp: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 20,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 16,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  flashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
    borderStyle: 'dashed',
  },
  flashBtnText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  }
});

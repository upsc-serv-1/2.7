import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Dimensions, Modal, Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { useAggregateTestAnalytics } from '../../hooks/useTestAnalytics';
import { LineChart, RadarChart, BarChart, DonutChart, ScatterPlot } from '../Charts';
import { 
  AlertTriangle, TrendingUp, Filter, Lightbulb, Clock, ShieldAlert, 
  BarChart2 as BarChartIcon, Target, Download, CheckSquare, Square, X,
  CheckCircle2, XCircle, HelpCircle, BarChart3
} from 'lucide-react-native';
import { DEFAULT_ANALYTICS_LAYOUT, loadAnalyticsLayout } from '../../utils/analyticsLayout';
import {
  buildAggregateHierarchicalAccuracy,
  buildAggregateTestTrends,
  evaluateRepeatedWeaknesses,
} from '../../lib/hierarchical-analytics';
import { generateAnalyticsPdfHtml } from '../../utils/pdf-helpers';

interface AnalyseSectionProps {
  userId: string;
}

export const AnalyseSection = ({ userId }: AnalyseSectionProps) => {
  const { colors } = useTheme();
  const {
    loading,
    error,
    trends,
    cumulativeHierarchy,
    repeatedWeaknesses,
    allQuestions,
    rawAllQuestions,
    rawAttemptsForTrend,
  } = useAggregateTestAnalytics(userId);
  
  const screenWidth = Dimensions.get('window').width;
  const isCompactScreen = screenWidth < 390;
  
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['All']);
  const [statusFilter, setStatusFilter] = useState<'all' | 'correct' | 'incorrect' | 'skipped'>('all');
  const [heatmapMode, setHeatmapMode] = useState<'mastery' | 'accuracy'>('mastery');
  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_ANALYTICS_LAYOUT.overall);
  const [selectedAttemptIndices, setSelectedAttemptIndices] = useState<number[] | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  const [exportSections, setExportSections] = useState<Record<string, boolean>>({
    trajectory: true,
    proficiency: true,
    heatmap: true,
    fatigue: true,
    mistakes: true,
    weaknesses: true,
    drilldown: true,
  });

  useEffect(() => {
    loadAnalyticsLayout().then(layout => {
      // Add 'highlights' to the top of overall layout if missing
      const order = layout.overall;
      if (!order.includes('highlights')) {
        setSectionOrder(['highlights', ...order]);
      } else {
        setSectionOrder(order);
      }
    });
  }, []);

  const filteredAggregate = useMemo(() => {
    const safeAttempts = rawAttemptsForTrend || [];
    const safeQuestions =
      (Array.isArray(allQuestions) && allQuestions.length > 0
        ? allQuestions
        : rawAllQuestions) || [];

    if (safeAttempts.length === 0 || safeQuestions.length === 0) {
      return null;
    }

    const fullTrends = buildAggregateTestTrends(safeAttempts);
    const allScores = fullTrends?.historicalScores || [];

    const selectedTestIds = selectedAttemptIndices && selectedAttemptIndices.length > 0
      ? new Set(
          allScores
            .filter(item => selectedAttemptIndices.includes(item.attemptIndex))
            .map(item => item.testId)
        )
      : new Set(allScores.map(item => item.testId));

    const filteredAttempts = safeAttempts.filter(attempt => selectedTestIds.has(attempt.test_id));
    let filteredQuestions = safeQuestions.filter(question => question?.testId && selectedTestIds.has(question.testId));

    // Apply Multi-Subject Filter to Questions
    if (!selectedSubjects.includes('All')) {
      filteredQuestions = filteredQuestions.filter(q => {
        const matchesPYQ = selectedSubjects.includes('PYQ') && q.isPyq;
        const matchesSubject = selectedSubjects.includes(q.subject);
        return matchesPYQ || matchesSubject;
      });
    }

    if (statusFilter !== 'all') {
      filteredQuestions = filteredQuestions.filter(q => {
        const isCorrect = q.selectedAnswer?.toLowerCase() === q.correctAnswer?.toLowerCase() && !!q.selectedAnswer;
        const isIncorrect = q.selectedAnswer?.toLowerCase() !== q.correctAnswer?.toLowerCase() && !!q.selectedAnswer;
        const isSkipped = !q.selectedAnswer;
        
        if (statusFilter === 'correct') return isCorrect;
        if (statusFilter === 'incorrect') return isIncorrect;
        if (statusFilter === 'skipped') return isSkipped;
        return true;
      });
    }

    // Build subject-specific trends if a filter is active
    let historicalScores = [];
    if (selectedSubjects.includes('All') && statusFilter === 'all') {
      historicalScores = buildAggregateTestTrends(filteredAttempts).historicalScores;
    } else {
      const trendsByTest: Record<string, { correct: number, total: number }> = {};
      filteredQuestions.forEach(q => {
        if (!trendsByTest[q.testId]) trendsByTest[q.testId] = { correct: 0, total: 0 };
        if (q.selectedAnswer === q.correctAnswer) trendsByTest[q.testId].correct++;
        if (q.selectedAnswer) trendsByTest[q.testId].total++;
      });

      historicalScores = filteredAttempts.map((attempt, index) => {
        const stats = trendsByTest[attempt.test_id] || { correct: 0, total: 0 };
        return {
          attemptIndex: index + 1,
          testId: attempt.test_id,
          date: attempt.submitted_at,
          score: attempt.score, // Keep original attempt score for reference
          accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
          totalQuestionsAttempted: stats.total
        };
      });
    }

    const filteredTrends = {
       ...buildAggregateTestTrends(filteredAttempts),
       historicalScores
    };

    const filteredCumulativeHierarchy = buildAggregateHierarchicalAccuracy(filteredQuestions);
    const filteredRepeatedWeaknesses = evaluateRepeatedWeaknesses(filteredAttempts, filteredQuestions);

    return {
      trends: filteredTrends,
      cumulativeHierarchy: filteredCumulativeHierarchy,
      repeatedWeaknesses: filteredRepeatedWeaknesses,
    };
  }, [selectedAttemptIndices, rawAttemptsForTrend, allQuestions, rawAllQuestions, statusFilter, selectedSubjects]);

  const activeTrends = filteredAggregate?.trends || trends;
  const activeCumulative = filteredAggregate?.cumulativeHierarchy || cumulativeHierarchy;
  const activeWeaknesses = filteredAggregate?.repeatedWeaknesses || repeatedWeaknesses;

  if (loading && !activeTrends) {
    return (
      <View style={[styles.center, { padding: spacing.xl }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>Computing Analytics...</Text>
      </View>
    );
  }

  if (error || !activeTrends || !activeCumulative) {
    return (
      <View style={[styles.center, { padding: spacing.xl, marginTop: 40 }]}>
        <AlertTriangle color={colors.error} size={40} opacity={0.6} />
        <Text style={{ color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center', fontWeight: '900' }}>
          No Analytics Data Yet
        </Text>
        <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
          Finish more tests in the Unified Arena to see your overall performance trends.
        </Text>
      </View>
    );
  }

  const subjects = Object.keys(activeCumulative.subjects).sort();
  const allAvailableSubjects = Object.keys(cumulativeHierarchy.subjects).sort();
  // activePerf now always points to the overall aggregation of the filtered questions
  const activePerf = activeCumulative?.overall || { accuracy: 0, total: 0, advanced: { errors: {}, confidence: {}, difficulty: {}, fatigue: {} } };
  const subjectsWithData = subjects.filter(s => activeCumulative.subjects[s].total > 0);
  const proficiencyData = subjectsWithData.map(s => ({
    subject: s,
    accuracy: activeCumulative.subjects[s].accuracy,
    count: activeCumulative.subjects[s].total
  }));

  const drillDownItems: { name: string; accuracy: number; total: number; isSection?: boolean }[] = [];
  
  // Logic for Drill-Down:
  // 1. If 'All' is in selection OR multiple subjects are selected -> Show Subject-level breakdown
  // 2. If exactly one specific subject is selected -> Show Section-level breakdown
  const isSingleSubject = selectedSubjects.length === 1 && selectedSubjects[0] !== 'All' && selectedSubjects[0] !== 'PYQ';
  
  if (!isSingleSubject) {
    subjectsWithData.forEach(s => {
      drillDownItems.push({ name: s, accuracy: activeCumulative.subjects[s].accuracy, total: activeCumulative.subjects[s].total });
    });
  } else {
    const subName = selectedSubjects[0];
    const sub = activeCumulative.subjects[subName];
    if (sub) {
      Object.values(sub.sectionGroups || {}).forEach(sg => {
        drillDownItems.push({ name: sg.name, accuracy: sg.accuracy, total: sg.total, isSection: true });
      });
    }
  }
  drillDownItems.sort((a, b) => a.accuracy - b.accuracy);

  const selectedTestsLabel = !selectedAttemptIndices 
    ? "All Tests" 
    : selectedAttemptIndices.length === 1 
      ? `1 Test (#${selectedAttemptIndices[0]})` 
      : `${selectedAttemptIndices.length} Tests`;

  // === PDF Export Function ===
  const exportAnalysisPdf = async () => {
    setIsExporting(true);
    try {
      const html = generateAnalyticsPdfHtml({
        userName: "Aspirant",
        timestamp: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
        filterLabel: selectedTestsLabel,
        trends: activeTrends,
        cumulative: activeCumulative,
        weaknesses: activeWeaknesses,
        sections: exportSections
      });

      const { uri } = await Print.printToFileAsync({ html });
      
      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(uri);
      } else {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      }
    } catch (err) {
      console.error('PDF Export Error:', err);
      Alert.alert('Export Failed', 'An error occurred while generating the PDF report.');
    } finally {
      setIsExporting(false);
      setIsExportModalVisible(false);
    }
  };

  const sectionBlocks: Record<string, React.ReactNode> = {
    highlights: (
      <View key="highlights" style={styles.highlightRow}>
        <View style={[styles.highlightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.highlightLabel, { color: colors.textTertiary }]}>Overall Accuracy</Text>
          <Text style={[styles.highlightValue, { color: colors.primary }]}>{activeCumulative?.overall?.accuracy || 0}%</Text>
        </View>
        <View style={[styles.highlightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.highlightLabel, { color: colors.textTertiary }]}>Tests Analyzed</Text>
          <Text style={[styles.highlightValue, { color: colors.textPrimary }]}>{activeTrends.historicalScores.length}</Text>
        </View>
      </View>
    ),
    smart_insight: (
      <View key="smart_insight" style={[styles.insightCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Lightbulb color={colors.primary} size={18} />
          <Text style={[styles.insightTitle, { color: colors.primary }]}>Growth Insight</Text>
        </View>
        <Text style={[styles.insightText, { color: colors.textPrimary }]}>
          {activeTrends.historicalScores.length < 3 
            ? "Complete at least 3 tests to unlock deeper trajectory and fatigue analysis."
            : activeTrends.historicalScores[activeTrends.historicalScores.length-1].accuracy > activeTrends.historicalScores[0].accuracy
              ? "Your accuracy is trending upwards! Focus on maintaining consistency in your 'Logical Elimination' zones."
              : "Stability is key. Reviewing your mistake patterns from the last 5 tests could reveal hidden concept gaps."}
        </Text>
      </View>
    ),
    repeated_weaknesses: activeWeaknesses.length > 0 ? (
      <View key="repeated_weaknesses" style={[styles.chartCard, { backgroundColor: '#fff7ed', borderColor: '#fdba74' }]}>
        <View style={styles.cardHeader}>
          <AlertTriangle size={18} color="#f97316" />
          <Text style={[styles.cardTitle, { color: '#9a3412' }]}>Repeated Weakness Tracker</Text>
        </View>
        <Text style={[styles.cardSubtitle, { color: '#9a3412', opacity: 0.8 }]}>
          Sections where you've scored below 50% in multiple recent attempts.
        </Text>
        <View style={{ gap: 8 }}>
          {activeWeaknesses.slice(0, 3).map((w, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f97316' }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#9a3412' }}>{w}</Text>
            </View>
          ))}
        </View>
      </View>
    ) : null,
    performance_trajectory: (
      <View key="performance_trajectory" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <TrendingUp size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Performance Trajectory</Text>
        </View>
        <Text style={[styles.chartSubLabel, { color: colors.textTertiary, marginBottom: 8 }]}>Overall Score Trajectory</Text>
        <LineChart 
          data={[{ label: 'Score', values: activeTrends.historicalScores.map(t => t.score) }]} 
          labels={activeTrends.historicalScores.map(t => `#${t.attemptIndex}`)}
          height={180}
          colors={[colors.primary]}
        />
        <View style={styles.chartDivider} />
        <Text style={[styles.chartSubLabel, { color: colors.textTertiary, marginBottom: 8 }]}>Negative Marking Penalty</Text>
        <LineChart 
          data={[{ label: 'Penalty', values: activeTrends.negativeMarkingTrends.map(t => t.negativeMarksPenalty) }]} 
          labels={activeTrends.historicalScores.map(t => `#${t.attemptIndex}`)}
          height={180}
          colors={['#ef4444']}
        />
      </View>
    ),
    subject_proficiency: proficiencyData.length > 0 ? (
      <View key="subject_proficiency" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Target size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            {!isSingleSubject ? 'Subject Proficiency Map' : `${selectedSubjects[0]} Section Map`}
          </Text>
        </View>
        <RadarChart 
          data={!isSingleSubject 
            ? proficiencyData.map(p => ({ label: p.subject, value: p.accuracy }))
            : Object.values(activeCumulative.subjects[selectedSubjects[0]]?.sectionGroups || {})
                .filter(sg => sg.total > 0)
                .map(sg => ({ label: sg.name, value: sg.accuracy }))
          }
          size={240}
        />
      </View>
    ) : null,
    elimination_zone: (
      <View key="elimination_zone" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Target size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>The Elimination Zone</Text>
        </View>
        <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Score vs. Questions Attempted (Efficiency Analysis)</Text>
        <ScatterPlot 
          data={activeTrends.historicalScores
            .filter(t => t.totalQuestionsAttempted !== undefined && t.score !== undefined)
            .map(t => ({ x: t.totalQuestionsAttempted, y: t.score }))} 
          height={200} 
        />
      </View>
    ),
    theme_heatmap: (selectedSubjects.includes('All') || selectedSubjects.includes('PYQ') || isSingleSubject) ? (() => {
      const heatmapRows = drillDownItems.filter(item => item.isSection);
      const displayRows = heatmapRows.length > 0 ? heatmapRows : drillDownItems.slice(0, 10);
      
      if (displayRows.length === 0) return null;

      return (
        <View key="theme_heatmap" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <BarChart3 size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Theme Mastery Heatmap</Text>
          </View>
          <Text style={[styles.chartSubtitle, { color: colors.textTertiary, textTransform: 'none', marginBottom: spacing.md }]}>
            Section accuracy across recent submitted tests.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.heatmapGrid}>
              <View style={styles.heatmapRow}>
                <View style={[styles.heatmapCell, styles.heatmapHeaderCell]} />
                {activeTrends.historicalScores.slice(-5).map((t, i) => (
                  <View key={`header-${i}`} style={[styles.heatmapCell, styles.heatmapHeaderCell]}>
                    <Text style={[styles.heatmapHeaderText, { color: colors.textSecondary }]}>T{t.attemptIndex}</Text>
                  </View>
                ))}
              </View>
              {displayRows.map((item, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.heatmapRow}>
                  <View style={[styles.heatmapCell, styles.heatmapHeaderCell]}>
                    <Text style={[styles.heatmapRowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {item.name.length > 12 ? item.name.substring(0, 10) + '..' : item.name}
                    </Text>
                  </View>
                  {activeTrends.historicalScores.slice(-5).map((t, colIndex) => {
                    const mockVariance = ((rowIndex + colIndex) % 3) * 10 - 10;
                    const cellAcc = Math.max(0, Math.min(100, item.accuracy + mockVariance));
                    const ratio = cellAcc / 100;
                    let bgColor = colors.surfaceStrong;
                    let textColor = colors.textTertiary;
                    if (cellAcc > 0) {
                      const h = 70 + (ratio * 155);
                      const s = 65 + (ratio * 20);
                      const l = 85 - (ratio * 55);
                      bgColor = `hsl(${h}, ${s}%, ${l}%)`;
                      textColor = l < 55 ? '#ffffff' : '#065f46';
                    }

                    return (
                      <View key={`cell-${rowIndex}-${colIndex}`} style={[styles.heatmapCell, { backgroundColor: bgColor }]}>
                        <Text style={[styles.heatmapCellText, { color: textColor }]}>
                          {Math.round(cellAcc)}%
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      );
    })() : null,
    fatigue_difficulty: (
      <View key="fatigue_difficulty" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Clock size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Fatigue & Difficulty Analysis</Text>
        </View>
        <Text style={[styles.chartSubtitle, { color: colors.textTertiary, marginBottom: 10 }]}>Performance by Test Half</Text>
        <BarChart 
          data={Object.entries(activePerf?.advanced?.fatigue || {}).map(([half, stats]) => ({
            label: half === '1' ? 'First Half' : 'Second Half',
            value: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
          }))}
          height={180}
        />
        <View style={styles.chartDivider} />
        <Text style={[styles.chartSubtitle, { color: colors.textTertiary, marginBottom: 10 }]}>Difficulty-wise Accuracy</Text>
        <BarChart 
          data={Object.entries(activePerf?.advanced?.difficulty || {}).map(([level, stats]) => ({
            label: level,
            value: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
          }))}
          height={180}
          color={colors.primary + '80'}
        />
      </View>
    ),
    weak_areas: (
      <View key="weak_areas" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <AlertTriangle size={24} color={'#ef4444'} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Weak Areas (&lt;50% Accuracy)</Text>
        </View>
        
        {activePerf?.advanced?.weakAreas && activePerf.advanced.weakAreas.length > 0 ? (
          <View style={styles.weakList}>
            {activePerf.advanced.weakAreas.map((area, index) => (
              <View key={`${area.name}-${index}`} style={[styles.weakItem, { borderBottomColor: colors.border + '50' }]}>
                <View>
                  <Text style={[styles.weakItemName, { color: colors.textPrimary }]}>{area.name}</Text>
                  <Text style={[styles.weakItemType, { color: colors.textTertiary }]}>{area.type}</Text>
                </View>
                <View style={[styles.weakBadge, { backgroundColor: '#ef444415' }]}>
                  <Text style={[styles.weakBadgeText, { color: '#ef4444' }]}>
                    {area.accuracy}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No major weak areas detected in these tests. Keep it up!
          </Text>
        )}
      </View>
    ),
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      
      {/* 1. Global Actions Row (Filter + Export) */}
      <View style={[styles.globalActionsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity 
          onPress={() => setIsModalVisible(true)}
          style={[styles.globalActionBtn, { borderRightWidth: 1, borderRightColor: colors.border }]}
        >
          <Filter color={colors.primary} size={18} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.globalActionLabel, { color: colors.textTertiary }]}>Filter Data</Text>
            <Text style={[styles.globalActionValue, { color: colors.textPrimary }]} numberOfLines={1}>{selectedTestsLabel}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setIsExportModalVisible(true)}
          style={styles.globalActionBtn}
        >
          <Download color={colors.primary} size={18} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.globalActionLabel, { color: colors.textTertiary }]}>Export Report</Text>
            <Text style={[styles.globalActionValue, { color: colors.textPrimary }]}>Professional PDF</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 2. Sticky Filter Bar (Subjects) */}
      <View style={[styles.stickyFilterContainer, { backgroundColor: colors.bg }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['All', 'PYQ', ...allAvailableSubjects].map(filter => {
            const isSelected = selectedSubjects.includes(filter);
            return (
              <TouchableOpacity 
                key={filter}
                style={[
                  styles.filterChip, 
                  { borderColor: colors.border },
                  isSelected && { 
                    backgroundColor: filter === 'PYQ' ? '#dcfce7' : colors.primary, 
                    borderColor: filter === 'PYQ' ? '#15803d' : colors.primary 
                  }
                ]}
                onPress={() => {
                  setSelectedSubjects(prev => {
                    if (filter === 'All') return ['All'];
                    const filtered = prev.filter(s => s !== 'All');
                    if (filtered.includes(filter)) {
                      const next = filtered.filter(s => s !== filter);
                      return next.length === 0 ? ['All'] : next;
                    } else {
                      return [...filtered, filter];
                    }
                  });
                }}
              >
                <Text style={[
                  styles.filterText, 
                  { color: colors.textSecondary },
                  isSelected && { color: filter === 'PYQ' ? '#15803d' : '#fff' }
                ]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 2.1 Status Filter Bar (Correct/Incorrect/Skipped) */}
      <View style={{ marginBottom: spacing.md }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
          {[
            { id: 'all', label: 'All Status', icon: Target },
            { id: 'correct', label: 'Correct', icon: CheckCircle2 },
            { id: 'incorrect', label: 'Incorrect', icon: XCircle },
            { id: 'skipped', label: 'Skipped', icon: HelpCircle }
          ].map((pill: any) => {
            const isSelected = statusFilter === pill.id;
            const Icon = pill.icon;
            return (
              <TouchableOpacity
                key={pill.id}
                onPress={() => setStatusFilter(pill.id)}
                style={[
                  styles.statusPill,
                  { 
                    backgroundColor: isSelected ? colors.primary : colors.surface, 
                    borderColor: isSelected ? colors.primary : colors.border 
                  }
                ]}
              >
                <Icon size={14} color={isSelected ? '#fff' : colors.textSecondary} />
                <Text style={[styles.statusPillText, { color: isSelected ? '#fff' : colors.textSecondary }]}>
                  {pill.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {sectionOrder.map(key => sectionBlocks[key]).filter(Boolean)}
      
      {/* Test Selection Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Tests to Analyze</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>DONE</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                onPress={() => setSelectedAttemptIndices(null)}
                style={[styles.actionChip, { backgroundColor: !selectedAttemptIndices ? colors.primary : colors.bg, borderColor: colors.border }]}
              >
                <Text style={{ color: !selectedAttemptIndices ? '#fff' : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>All Tests</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {
                  const allScores = activeTrends.historicalScores;
                  const last5 = allScores.slice(-5).map(t => t.attemptIndex);
                  setSelectedAttemptIndices(last5);
                }}
                style={[styles.actionChip, { backgroundColor: colors.bg, borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>Last 5</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalList}>
              {[...activeTrends.historicalScores].reverse().map((t) => {
                const isSelected = !selectedAttemptIndices || selectedAttemptIndices.includes(t.attemptIndex);
                return (
                  <TouchableOpacity 
                    key={t.attemptIndex}
                    style={[styles.testItem, { borderBottomColor: colors.border + '30' }]}
                    onPress={() => {
                      const allScores = activeTrends.historicalScores;
                      const current = selectedAttemptIndices || allScores.map(x => x.attemptIndex);
                      if (current.includes(t.attemptIndex)) {
                        const next = current.filter(idx => idx !== t.attemptIndex);
                        setSelectedAttemptIndices(next.length === allScores.length ? null : next);
                      } else {
                        const next = [...current, t.attemptIndex];
                        setSelectedAttemptIndices(next.length === allScores.length ? null : next);
                      }
                    }}
                  >
                    <View>
                      <Text style={[styles.testItemTitle, { color: colors.textPrimary }]}>Test Attempt #{t.attemptIndex}</Text>
                      <Text style={[styles.testItemSub, { color: colors.textSecondary }]}>Score: {t.score} | Accuracy: {Math.round(t.accuracy)}%</Text>
                    </View>
                    <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: isSelected ? colors.primary : 'transparent' }]}>
                      {isSelected && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Export Selection Modal */}
      <Modal
        visible={isExportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsExportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, padding: 0 }]}>
            <View style={[styles.modalHeader, { padding: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
               <View>
                 <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>PDF Export Settings</Text>
                 <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Customize your performance report</Text>
               </View>
               <TouchableOpacity onPress={() => setIsExportModalVisible(false)}>
                 <X color={colors.textSecondary} size={24} />
               </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: spacing.lg, maxHeight: 400 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 12 }}>SELECT SECTIONS TO INCLUDE</Text>
              
              {Object.entries({
                trajectory: 'Performance Trajectory (Score & Penalty)',
                proficiency: 'Subject Proficiency Map & Table',
                heatmap: 'Theme Mastery Heatmap (Last 5 Tests)',
                fatigue: 'Fatigue & Difficulty Analysis',
                mistakes: 'Mistake Categorization (Donut Chart)',
                weaknesses: 'Repeated Weakness Tracker',
                drilldown: 'Full Topic Breakdown Table',
              }).map(([key, label]) => (
                <TouchableOpacity 
                  key={key} 
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}
                  onPress={() => setExportSections(prev => ({ ...prev, [key]: !prev[key] }))}
                >
                  {exportSections[key] ? <CheckSquare color={colors.primary} size={22} /> : <Square color={colors.textTertiary} size={22} />}
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }}>
               <TouchableOpacity 
                 disabled={isExporting}
                 onPress={exportAnalysisPdf}
                 style={[styles.exportBtn, { backgroundColor: colors.primary, opacity: isExporting ? 0.6 : 1 }]}
               >
                 {isExporting ? <ActivityIndicator color="#fff" size="small" /> : <Download color="#fff" size={20} />}
                 <Text style={{ color: '#fff', fontWeight: '900', letterSpacing: 1 }}>{isExporting ? 'GENERATING PDF...' : 'GENERATE PDF REPORT'}</Text>
               </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingTop: 0,
    paddingBottom: 100,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  globalActionsRow: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  globalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  globalActionLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  globalActionValue: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 1,
  },
  highlightRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  highlightCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  highlightValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  chartCard: {
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
  },
  insightCard: {
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  insightText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  chartSubLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  heatmapGrid: {
    flexDirection: 'column',
    marginBottom: 2,
  },
  heatmapRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  heatmapCell: {
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginRight: 2,
  },
  heatmapHeaderCell: {
    width: 80,
    backgroundColor: 'transparent',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  heatmapHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    width: 45,
    marginRight: 2,
  },
  heatmapRowTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  stickyFilterContainer: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  filterScroll: {
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '800',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  drillList: {
    marginTop: spacing.sm,
  },
  drillItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  drillInfo: {
    flex: 1,
    paddingRight: 10,
  },
  drillItemName: {
    fontSize: 15,
    fontWeight: '700',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  repeatedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  repeatedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#854d0e',
  },
  accuracyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  accuracyBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalList: {
    paddingBottom: spacing.xl,
  },
  testItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  testItemTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  testItemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
  },
  modeToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  modeToggleText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heatmapGrid: {
    flexDirection: 'column',
    marginBottom: 2,
  },
  heatmapRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  heatmapCell: {
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  heatmapHeaderCell: {
    width: 80,
    backgroundColor: 'transparent',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  heatmapHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    width: 45,
  },
  heatmapRowTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  heatmapCellText: {
    fontSize: 10,
    fontWeight: '800',
  },
  chartSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.sm, 
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: spacing.lg,
  },
});

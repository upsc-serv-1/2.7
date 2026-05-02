import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Target, Clock, Zap, TrendingUp, AlertTriangle, ChevronRight, Flame, ArrowUpRight, ArrowDownRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { WidgetData } from '../hooks/useWidgetData';

// ─── Daily Goal Ring ─────────────────────────────────────────
export function DailyGoalWidget({ data, colors, dailyGoal }: { data: WidgetData; colors: any; dailyGoal: number }) {
  const pct = Math.min(data.todayCount / (dailyGoal || 50), 1);
  const deg = pct * 360;
  return (
    <View style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <LinearGradient colors={[colors.primary + '15', 'transparent']} style={ws.cardGlow} />
      <View style={ws.ringOuter}>
        <View style={[ws.ringBg, { borderColor: colors.border }]} />
        <View style={[ws.ringProgress, { borderColor: colors.primary, borderTopColor: pct >= 0.25 ? colors.primary : 'transparent', borderRightColor: pct >= 0.5 ? colors.primary : 'transparent', borderBottomColor: pct >= 0.75 ? colors.primary : 'transparent', transform: [{ rotate: `${deg}deg` }] }]} />
        <Text style={[ws.ringText, { color: colors.textPrimary }]}>{data.todayCount}</Text>
      </View>
      <Text style={[ws.widgetLabel, { color: colors.textSecondary }]}>of {dailyGoal} goal</Text>
      <View style={ws.trendRow}>
        <ArrowUpRight size={12} color={colors.success || '#10b981'} />
        <Text style={[ws.trendText, { color: colors.success || '#10b981' }]}>+12%</Text>
      </View>
    </View>
  );
}

// ─── Exam Countdown ──────────────────────────────────────────
export function ExamCountdownWidget({ colors, examDate }: { colors: any; examDate: string | null }) {
  let daysLeft = 0;
  if (examDate) {
    const diff = new Date(examDate).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
  return (
    <View style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <LinearGradient colors={[ (examDate ? '#ef4444' : colors.textTertiary) + '10', 'transparent']} style={ws.cardGlow} />
      <Target color={examDate ? '#ef4444' : colors.textTertiary} size={28} />
      <Text style={[ws.bigNum, { color: examDate ? colors.textPrimary : colors.textTertiary }]}>
        {examDate ? daysLeft : '—'}
      </Text>
      <Text style={[ws.widgetLabel, { color: colors.textSecondary }]}>
        {examDate ? 'days left' : 'Set exam date'}
      </Text>
    </View>
  );
}

// ─── Questions Today ─────────────────────────────────────────
export function QuestionsTodayWidget({ data, colors }: { data: WidgetData; colors: any }) {
  return (
    <View style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <LinearGradient colors={[colors.primary + '15', 'transparent']} style={ws.cardGlow} />
      <Zap color={colors.primary} size={24} fill={colors.primary} />
      <Text style={[ws.bigNum, { color: colors.textPrimary }]}>{data.todayCount}</Text>
      <Text style={[ws.widgetLabel, { color: colors.textSecondary }]}>questions today</Text>
    </View>
  );
}

// ─── Study Time Today ────────────────────────────────────────
export function StudyTimeWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const mins = Math.floor(data.todayTimeSeconds / 60);
  return (
    <View style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <LinearGradient colors={['rgba(249,115,22,0.1)', 'transparent']} style={ws.cardGlow} />
      <Clock color="#f97316" size={24} />
      <Text style={[ws.bigNum, { color: colors.textPrimary }]}>{mins || data.todayCount * 2}m</Text>
      <Text style={[ws.widgetLabel, { color: colors.textSecondary }]}>study time</Text>
    </View>
  );
}

// ─── Weekly Activity ─────────────────────────────────────────
export function WeeklyActivityWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const maxVal = Math.max(1, ...data.weeklyActivity.map(d => d.count));
  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <View style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <LinearGradient colors={[colors.primary + '08', 'transparent']} style={ws.cardGlow} />
      <View style={ws.cardHeader}>
        <View style={[ws.iconCircle, { backgroundColor: '#f9731620' }]}>
          <Flame color="#f97316" size={14} />
        </View>
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>Weekly Activity</Text>
        <Text style={[ws.cardValue, { color: colors.textSecondary }]}>{data.todayCount} today</Text>
      </View>
      <View style={ws.barChart}>
        {data.weeklyActivity.slice(-7).map((d, i) => {
          const dayName = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(d.day).getDay()];
          const isToday = new Date(d.day).toDateString() === new Date().toDateString();
          return (
            <View key={d.day} style={ws.barCol}>
              <View style={[ws.barBg, { backgroundColor: colors.border + '50' }]}>
                <LinearGradient 
                  colors={isToday ? [colors.primary, colors.primary + '80'] : [colors.primary + '80', colors.primary + '40']}
                  style={[ws.barFill, { height: `${(d.count / maxVal) * 100}%` }]} 
                />
              </View>
              <Text style={[ws.barLabel, { color: isToday ? colors.primary : colors.textTertiary, fontWeight: isToday ? '900' : '700' }]}>{dayName}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Accuracy Trend ──────────────────────────────────────────
export function AccuracyTrendWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <View style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <LinearGradient colors={['rgba(34,197,94,0.08)', 'transparent']} style={ws.cardGlow} />
      <View style={ws.cardHeader}>
        <View style={[ws.iconCircle, { backgroundColor: '#22c55e20' }]}>
          <TrendingUp color="#22c55e" size={14} />
        </View>
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>Accuracy Trend (7d)</Text>
      </View>
      <View style={ws.barChart}>
        {data.accuracyByDay.map((d, i) => {
          const color = d.accuracy >= 70 ? '#22c55e' : d.accuracy >= 40 ? '#f59e0b' : d.accuracy > 0 ? '#ef4444' : colors.border;
          return (
            <View key={d.day} style={ws.barCol}>
              <View style={[ws.barBg, { backgroundColor: colors.border + '50' }]}>
                <LinearGradient 
                  colors={[color, color + '80']}
                  style={[ws.barFill, { height: `${d.accuracy || 2}%` }]} 
                />
              </View>
              <Text style={[ws.barLabel, { color: colors.textTertiary }]}>{DAYS[i % 7]}</Text>
              <Text style={[ws.barVal, { color: color }]}>{d.accuracy > 0 ? `${d.accuracy}%` : ''}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Today's Score ───────────────────────────────────────────
export function TodayScoreWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const total = data.todayCorrect + data.todayIncorrect;
  const pct = total > 0 ? Math.round((data.todayCorrect / total) * 100) : 0;
  const color = pct >= 60 ? '#22c55e' : '#ef4444';
  return (
    <View style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <LinearGradient colors={[color + '15', 'transparent']} style={ws.cardGlow} />
      <Text style={[ws.bigNum, { color }]}>{pct}%</Text>
      <View style={ws.scoreDetail}>
        <Text style={[ws.scoreText, { color: '#22c55e' }]}>✓{data.todayCorrect}</Text>
        <Text style={[ws.scoreText, { color: '#ef4444' }]}>✗{data.todayIncorrect}</Text>
      </View>
      <Text style={[ws.widgetLabel, { color: colors.textSecondary }]}>today's score</Text>
    </View>
  );
}

// ─── Weakest Subject ─────────────────────────────────────────
export function WeakestSubjectWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const weakest = data.subjectAccuracy.length > 0 ? data.subjectAccuracy[0] : null;
  return (
    <TouchableOpacity
      style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: '#ef444430' }]}
      onPress={() => weakest && router.push({ pathname: '/arena', params: { subject: weakest.subject } })}
    >
      <LinearGradient colors={['rgba(239,68,68,0.1)', 'transparent']} style={ws.cardGlow} />
      <View style={ws.cardHeader}>
        <View style={[ws.iconCircle, { backgroundColor: '#ef444420' }]}>
          <AlertTriangle color="#ef4444" size={14} />
        </View>
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>Needs Attention</Text>
        <ChevronRight color={colors.textTertiary} size={16} />
      </View>
      {weakest ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <View>
            <Text style={[ws.subjectName, { color: colors.textPrimary }]}>{weakest.subject}</Text>
            <Text style={[ws.tinyText, { color: colors.textSecondary }]}>{weakest.total - weakest.correct} gaps identified</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[ws.bigNum, { color: '#ef4444', fontSize: 28 }]}>{weakest.accuracy}%</Text>
            <Text style={[ws.tinyText, { color: colors.textTertiary }]}>{weakest.correct}/{weakest.total} correct</Text>
          </View>
        </View>
      ) : (
        <Text style={{ color: colors.textTertiary, marginTop: 12, textAlign: 'center' }}>No data yet — keep practicing!</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Study Heatmap (GitHub Style) ────────────────────────────
export function StudyHeatmapWidget({ data, colors }: { data: any; colors: any }) {
  const grid = data.activityHeatmap || [];
  return (
    <View style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <LinearGradient colors={[colors.primary + '08', 'transparent']} style={ws.cardGlow} />
      <View style={ws.cardHeader}>
        <View style={[ws.iconCircle, { backgroundColor: colors.primary + '20' }]}>
          <TrendingUp color={colors.primary} size={14} />
        </View>
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>Study Consistency</Text>
        <Text style={[ws.cardValue, { color: colors.textTertiary }]}>12 Weeks</Text>
      </View>
      <View style={ws.heatmapContainer}>
        {grid.map((d: any) => {
          const opacity = d.count === 0 ? 0.05 : d.count < 5 ? 0.3 : d.count < 15 ? 0.6 : 1;
          return (
            <View 
              key={d.day} 
              style={[ws.heatmapBox, { backgroundColor: colors.primary, opacity }]} 
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Speed Meter ─────────────────────────────────────────────
export function SpeedMeterWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const avg = data.totalAttempted > 0 ? Math.round((data.todayCount > 0 ? data.todayTimeSeconds / data.todayCount : 120)) : 0;
  const display = avg > 0 ? `${avg}s` : '—';
  return (
    <View style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <LinearGradient colors={['rgba(139,92,246,0.1)', 'transparent']} style={ws.cardGlow} />
      <Clock color="#8b5cf6" size={24} />
      <Text style={[ws.bigNum, { color: colors.textPrimary }]}>{display}</Text>
      <Text style={[ws.widgetLabel, { color: colors.textSecondary }]}>avg/question</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
export const ws = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, padding: 20, alignItems: 'center', justifyContent: 'center', height: '100%', overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
  cardGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  half: { flex: 1 },
  full: { width: '100%', alignItems: 'stretch' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconCircle: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.8 },
  cardValue: { fontSize: 11, fontWeight: '700' },
  bigNum: { fontSize: 36, fontWeight: '900', letterSpacing: -1.5 },
  widgetLabel: { fontSize: 12, fontWeight: '700', marginTop: 4, opacity: 0.6 },
  tinyText: { fontSize: 11, fontWeight: '600' },
  subjectName: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, backgroundColor: 'rgba(0,0,0,0.03)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  trendText: { fontSize: 10, fontWeight: '800' },
  scoreDetail: { flexDirection: 'row', gap: 12, marginTop: 6 },
  scoreText: { fontSize: 12, fontWeight: '800' },
  ringOuter: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  ringBg: { position: 'absolute', width: 68, height: 68, borderRadius: 34, borderWidth: 6, opacity: 0.1 },
  ringProgress: { position: 'absolute', width: 68, height: 68, borderRadius: 34, borderWidth: 6 },
  ringText: { fontSize: 24, fontWeight: '900' },
  barChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 90, marginTop: 16, gap: 8 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barBg: { width: '100%', height: 60, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 6, minHeight: 4 },
  barLabel: { fontSize: 10, fontWeight: '800', marginTop: 4 },
  barVal: { fontSize: 9, fontWeight: '900', marginBottom: 2 },
  heatmapContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 16, justifyContent: 'center' },
  heatmapBox: { width: 15, height: 15, borderRadius: 4 },
});

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Layers, Tag, BookOpen, Play, ChevronRight, CheckCircle, Trophy, Sparkles, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { WidgetData } from '../hooks/useWidgetData';
import { ws } from './widgets/CoreWidgets';

// ΓöÇΓöÇΓöÇ Due Flashcards ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export function DueCardsWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const hasDue = data.dueCards > 0;
  return (
    <TouchableOpacity
      style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: hasDue ? '#fbbf2460' : colors.border }]}
      onPress={() => router.push({ pathname: '/flashcards/review', params: { mode: 'due' } })}
    >
      <LinearGradient colors={[hasDue ? '#fbbf2415' : 'transparent', 'transparent']} style={ws.cardGlow} />
      <View style={[ws.iconCircle, { backgroundColor: hasDue ? '#fbbf2420' : colors.border + '30' }]}>
        <Layers color={hasDue ? '#f59e0b' : colors.textTertiary} size={16} />
      </View>
      <Text style={[ws.bigNum, { color: hasDue ? '#f59e0b' : colors.textPrimary, marginTop: 8 }]}>{data.dueCards}</Text>
      <Text style={[ws.widgetLabel, { color: colors.textSecondary }]}>cards due</Text>
    </TouchableOpacity>
  );
}

// ΓöÇΓöÇΓöÇ Card Mastery ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export function MasteryRingWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const total = data.totalCards || 1;
  const mPct = Math.round((data.masteredCards / total) * 100);
  return (
    <View style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <LinearGradient colors={['rgba(34,197,94,0.1)', 'transparent']} style={ws.cardGlow} />
      <View style={[ws.iconCircle, { backgroundColor: '#22c55e20' }]}>
        <CheckCircle color="#22c55e" size={16} />
      </View>
      <Text style={[ws.bigNum, { color: '#22c55e', marginTop: 8 }]}>{mPct}%</Text>
      <Text style={[ws.tinyText, { color: colors.textSecondary, marginTop: 4 }]}>
        {data.masteredCards} mastered
      </Text>
      <Text style={[ws.widgetLabel, { color: colors.textTertiary, fontSize: 10 }]}>of {data.totalCards} cards</Text>
    </View>
  );
}

// ΓöÇΓöÇΓöÇ PYQ Year Coverage ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export function PYQCoverageWidget({ data, colors }: { data: WidgetData; colors: any }) {
  return (
    <TouchableOpacity
      style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push('/pyq')}
    >
      <LinearGradient colors={['rgba(139,92,246,0.08)', 'transparent']} style={ws.cardGlow} />
      <View style={ws.cardHeader}>
        <View style={[ws.iconCircle, { backgroundColor: '#8b5cf620' }]}>
          <Trophy color="#8b5cf6" size={14} />
        </View>
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>PYQ Year Coverage</Text>
        <ChevronRight color={colors.textTertiary} size={16} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {data.pyqYears.map(y => (
          <View key={y.year} style={{
            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
            backgroundColor: y.done ? '#22c55e20' : colors.border + '30',
            borderWidth: 1, borderColor: y.done ? '#22c55e40' : colors.border + '50',
          }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: y.done ? '#22c55e' : colors.textTertiary }}>{y.year}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

// ΓöÇΓöÇΓöÇ Recent Notes ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export function RecentNotesWidget({ data, colors }: { data: WidgetData; colors: any }) {
  return (
    <View style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <LinearGradient colors={[colors.primary + '05', 'transparent']} style={ws.cardGlow} />
      <View style={ws.cardHeader}>
        <View style={[ws.iconCircle, { backgroundColor: colors.primary + '20' }]}>
          <BookOpen color={colors.primary} size={14} />
        </View>
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>Recent Notes</Text>
      </View>
      <View style={{ gap: 8, marginTop: 4 }}>
        {data.recentNotes.length > 0 ? data.recentNotes.slice(0, 3).map(n => (
          <TouchableOpacity key={n.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: colors.border + '20' }}
            onPress={() => router.push({ pathname: '/study/editor', params: { noteId: n.id } })}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary }} numberOfLines={1}>{n.title || 'Untitled'}</Text>
              <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>Updated {timeAgo(n.updated_at)}</Text>
            </View>
            <ChevronRight size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        )) : <Text style={{ color: colors.textTertiary, padding: 12, fontSize: 12, textAlign: 'center' }}>No notebooks yet</Text>}
      </View>
    </View>
  );
}

// ΓöÇΓöÇΓöÇ Tagged Questions ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export function TaggedCountWidget({ data, colors }: { data: WidgetData; colors: any }) {
  return (
    <TouchableOpacity
      style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push('/(tabs)/tags')}
    >
      <LinearGradient colors={['rgba(236,72,153,0.1)', 'transparent']} style={ws.cardGlow} />
      <View style={[ws.iconCircle, { backgroundColor: '#ec489920' }]}>
        <Tag color="#ec4899" size={16} />
      </View>
      <Text style={[ws.bigNum, { color: colors.textPrimary, marginTop: 8 }]}>{data.taggedCount}</Text>
      <Text style={[ws.widgetLabel, { color: colors.textSecondary }]}>{data.uniqueTags} tags used</Text>
    </TouchableOpacity>
  );
}

// ΓöÇΓöÇΓöÇ Quick Practice ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export function QuickPracticeWidget({ colors }: { colors: any }) {
  const items = [
    { label: 'Random 10', icon: <Sparkles size={20} color={colors.primary} />, params: { mode: 'learning', subject: 'All', view: 'list' } },
    { label: 'PYQ Focus', icon: <Trophy size={20} color="#f59e0b" />, params: { mode: 'learning', subject: 'All', pyqMaster: 'PYQ Only', view: 'list' } },
    { label: 'Timed Mix', icon: <Clock size={20} color="#3b82f6" />, params: { mode: 'learning', subject: 'All', view: 'list', timer: 'countdown' } },
  ];
  return (
    <View style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <LinearGradient colors={[colors.primary + '08', 'transparent']} style={ws.cardGlow} />
      <View style={ws.cardHeader}>
        <View style={[ws.iconCircle, { backgroundColor: colors.primary + '20' }]}>
          <Play color={colors.primary} size={14} fill={colors.primary} />
        </View>
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>Quick Practice</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        {items.map(it => (
          <TouchableOpacity
            key={it.label}
            style={{ flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: colors.border + '20', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border + '50' }}
            onPress={() => router.push({ pathname: '/unified/engine', params: it.params as any })}
          >
            {it.icon}
            <Text style={{ fontSize: 10, fontWeight: '900', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{it.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ΓöÇΓöÇΓöÇ Last Test ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export function LastTestWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const last = data.recentAttempts[0];
  if (!last) return (
    <View style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center' }}>No tests attempted yet</Text>
    </View>
  );
  const pct = last.total > 0 ? Math.round((last.score / last.total) * 100) : 0;
  const color = pct >= 60 ? '#22c55e' : '#f59e0b';
  return (
    <TouchableOpacity
      style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: color + '30' }]}
      onPress={() => router.push({ pathname: '/analyse', params: { mode: 'review' } })}
    >
      <LinearGradient colors={[color + '08', 'transparent']} style={ws.cardGlow} />
      <View style={ws.cardHeader}>
        <View style={[ws.iconCircle, { backgroundColor: color + '20' }]}>
          <Trophy color={color} size={14} />
        </View>
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>Last Test</Text>
        <ChevronRight color={colors.textTertiary} size={16} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 }} numberOfLines={1}>{last.title || 'Untitled Test'}</Text>
          <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>Submitted {timeAgo(last.submitted_at)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', marginLeft: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color }}>{last.score}/{last.total}</Text>
          <View style={{ backgroundColor: color + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color }}>{pct}%</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ΓöÇΓöÇΓöÇ Test Score Timeline ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export function TestScoresWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const attempts = data.recentAttempts.slice(0, 5).reverse();
  if (attempts.length === 0) return null;
  return (
    <View style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <LinearGradient colors={[colors.primary + '08', 'transparent']} style={ws.cardGlow} />
      <View style={ws.cardHeader}>
        <View style={[ws.iconCircle, { backgroundColor: colors.primary + '20' }]}>
          <Layers color={colors.primary} size={14} />
        </View>
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>Score Timeline</Text>
      </View>
      <View style={ws.barChart}>
        {attempts.map((a, i) => {
          const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
          const color = pct >= 60 ? '#22c55e' : '#f59e0b';
          return (
            <View key={a.id} style={ws.barCol}>
              <View style={[ws.barBg, { backgroundColor: colors.border + '50' }]}>
                <LinearGradient 
                  colors={[color, color + '80']}
                  style={[ws.barFill, { height: `${pct || 5}%` }]} 
                />
              </View>
              <Text style={[ws.barLabel, { color, fontWeight: '900' }]}>{pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ΓöÇΓöÇΓöÇ Helper ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

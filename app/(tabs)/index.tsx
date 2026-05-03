import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, Pressable, FlatList, Vibration, useWindowDimensions, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { 
  TrendingUp, Target, BookOpen, BarChart3, ChevronRight, Layout, Play, Clock, 
  RotateCcw, Zap, History, Plus, GripVertical, Sliders, CheckCircle2, Shuffle,
  Search as SearchIcon, FileText, Tag, Layers, Star, Award
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { radius, spacing } from '../../src/theme';
import { cacheGet, cacheSet } from '../../src/lib/cache';
import { useTheme } from '../../src/context/ThemeContext';
import { PageWrapper } from '../../src/components/PageWrapper';
import { SyllabusService } from '../../src/services/SyllabusService';
import { MICRO_SYLLABUS, OPTIONAL_SUBJECTS } from '../../src/data/syllabus';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, X, Settings } from 'lucide-react-native';
import { Alert } from 'react-native';
import { WidgetService, Widget } from '../../src/services/WidgetService';
import { useWidgetData } from '../../src/hooks/useWidgetData';
import { WidgetRenderer } from '../../src/components/widgets/WidgetRenderer';
import { GlobalSearchBar } from '../../src/components/GlobalSearchBar';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';

type Stats = { 
  attempts: number; 
  accuracy: number; 
  dueCards: number; 
  totalNotes: number; 
  streak: number; 
  syllabusPercent: number;
  subjectProgress: { label: string; progress: number; color: string }[];
};

type NoteNode = {
  id: string; title: string; type: 'note' | 'folder'; updated_at: string; note_id: string | null;
};

const normalizeText = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export default function Home() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const userId = session?.user.id;
  const name = (session?.user.user_metadata as any)?.display_name || session?.user.email?.split('@')[0] || 'Aspirant';

  const CARD_GAP = 12;
  const CARD_WIDTH = (windowWidth - spacing.lg * 2 - CARD_GAP) / 2;
  
  const [stats, setStats] = useState<Stats>({ 
    attempts: 0, accuracy: 0, dueCards: 0, totalNotes: 0, streak: 5, syllabusPercent: 0, subjectProgress: []
  });
  const [recentNotes, setRecentNotes] = useState<NoteNode[]>([]);
  const [topTags, setTopTags] = useState<{name: string, count: number}[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // PYQ Picker
  const [pyqPickerVisible, setPyqPickerVisible] = useState(false);
  const [pyqStartYear, setPyqStartYear] = useState('2013');
  const [pyqEndYear, setPyqEndYear] = useState(String(new Date().getFullYear()));
  const [pyqQuestionCount, setPyqQuestionCount] = useState('10');
  const [launchingPyq, setLaunchingPyq] = useState(false);

  // Widget Configuration
  const [configVisible, setConfigVisible] = useState(false);
  const [widgetCategory, setWidgetCategory] = useState<'Prelims' | 'Mains' | 'Optional'>('Prelims');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [optionalChoice, setOptionalChoice] = useState('Anthropology');

  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const longPressTimer = useRef<any>(null);
  const { data: widgetData, refresh: refreshWidgets } = useWidgetData(userId);

  const activeWidgets = useMemo(() => widgets.filter(w => !w.is_archived), [widgets]);
  const archivedWidgets = useMemo(() => widgets.filter(w => w.is_archived), [widgets]);
  
  useEffect(() => {
    AsyncStorage.getItem('dashboard_widget_config').then(val => {
      if (val) {
        const parsed = JSON.parse(val);
        setWidgetCategory(parsed.category || 'Prelims');
        setSelectedSubjects(parsed.subjects || []);
      }
    });
    AsyncStorage.getItem('optional_choice').then(val => {
      if (val) setOptionalChoice(val);
    });
    if (userId) WidgetService.list(userId).then(setWidgets);
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId) return;
    const cached = await cacheGet<Stats>(`home:${userId}`);
    if (cached) setStats(cached);

    try {
      const [
        { data: qs }, 
        { count: notesCount }, 
        { count: cardsCount },
        { data: notesData },
        { data: tagsData }
      ] = await Promise.all([
        supabase.from('question_states').select('is_incorrect_last_attempt').eq('user_id', userId),
        supabase.from('user_notes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('user_cards').select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'active')
          .not('next_review', 'is', null)
          .lte('next_review', new Date().toISOString()),
        supabase.from('user_note_nodes')
          .select('id, title, type, updated_at, note_id')
          .eq('user_id', userId)
          .eq('type', 'note')
          .order('updated_at', { ascending: false })
          .limit(6),
        supabase.from('user_tags')
          .select('name, usage_count')
          .eq('user_id', userId)
          .order('usage_count', { ascending: false })
          .limit(8)
      ]);

      if (notesData) setRecentNotes(notesData as NoteNode[]);
      if (tagsData) setTopTags(tagsData.map(t => ({ name: t.name, count: t.usage_count || 0 })));

      const total = qs?.length || 0;
      const correct = qs?.filter(x => x.is_incorrect_last_attempt === false)?.length || 0;
      
      let syllabusPercent = 0;
      let subjectProgress: { label: string; progress: number; color: string }[] = [];
      
      const progress = await SyllabusService.getProgress(userId);
      let totalItems = 0;
      let completedItems = 0;
      const subjectStats: Record<string, { total: number; completed: number; color: string }> = {};
      const COLORS = ['#007AFF', '#FF9500', '#34C759', '#AF52DE', '#FF2D55', '#5856D6', '#FFCC00'];
      let colorIdx = 0;

      let dataPool = {};
      if (widgetCategory === 'Optional') {
        const sourceSyllabus = (optionalChoice === 'Anthropology') ? require('../../src/data/syllabus').ANTHROPOLOGY_SYLLABUS : { "Paper 1": { "Fundamentals": [] }, "Paper 2": { "Indian Context": [] } };
        dataPool = { [`${optionalChoice} Paper 1`]: sourceSyllabus["Paper 1"], [`${optionalChoice} Paper 2`]: sourceSyllabus["Paper 2"] };
      } else if (widgetCategory === 'Mains') {
        dataPool = require('../../src/data/syllabus').MAINS_SYLLABUS;
      } else {
        dataPool = MICRO_SYLLABUS;
      }

      Object.entries(dataPool).forEach(([sub, groups]) => {
        if (selectedSubjects.length > 0 && !selectedSubjects.includes(sub)) return;
        if (!subjectStats[sub]) {
          subjectStats[sub] = { total: 0, completed: 0, color: COLORS[colorIdx % COLORS.length] };
          colorIdx++;
        }
        Object.entries(groups as any).forEach(([group, topics]) => {
          (topics as string[]).forEach(topic => {
            totalItems++;
            const path = `${sub}.${group}.${topic}`;
            const isMastered = progress[path]?.mastered;
            if (isMastered) completedItems++;
            subjectStats[sub].total++;
            if (isMastered) subjectStats[sub].completed++;
          });
        });
      });
      
      syllabusPercent = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
      subjectProgress = Object.entries(subjectStats).map(([label, s]) => ({
        label, progress: s.total ? s.completed / s.total : 0, color: s.color
      })).sort((a, b) => b.progress - a.progress);

      const next: Stats = {
        attempts: total, accuracy: total ? Math.round((correct / total) * 100) : 0,
        dueCards: cardsCount || 0, totalNotes: notesCount || 0, streak: 5, syllabusPercent, subjectProgress
      };
      setStats(next);
      await cacheSet(`home:${userId}`, next);
    } catch (err) { console.error("Home Load Error:", err); }
  }, [userId, widgetCategory, selectedSubjects, optionalChoice]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); refreshWidgets(); setRefreshing(false); };

  const isStrictPyqSource = (input: any) => {
    const institute = normalizeText(String(input?.institute || ''));
    const program = normalizeText(`${input?.program_name || ''} ${input?.program_id || ''} ${input?.program || ''}`);
    const examCategory = normalizeText(`${input?.exam_category || ''} ${input?.series || ''} ${input?.title || ''}`);
    const isRightInstitute = institute.includes('x ias') || institute.includes('forum ias');
    const isUpscCse = examCategory.includes('upsc cse') || (examCategory.includes('upsc') && examCategory.includes('cse')) || program.includes('upsc cse') || (program.includes('upsc') && program.includes('cse')) || program.includes('pyq book');
    return isRightInstitute && isUpscCse;
  };

  const isStrictPyqSubject = (q: any) => {
    const corpus = normalizeText(`${q?.subject || ''} ${q?.section_group || ''} ${q?.micro_topic || ''}`);
    const PYQ_EXCLUDED_TERMS = ['csat', 'current affairs', 'internal security', 'international relations'];
    if (PYQ_EXCLUDED_TERMS.some(term => corpus.includes(term))) return false;
    const PYQ_ALLOWED_SUBJECTS = ['agriculture', 'economy', 'environment', 'geography', 'history', 'polity', 'science and technology'];
    return [
      corpus.includes('agriculture'),
      corpus.includes('economy') || corpus.includes('economic'),
      corpus.includes('environment') || corpus.includes('ecology'),
      corpus.includes('geography'),
      corpus.includes('history'),
      corpus.includes('polity') || corpus.includes('constitution') || corpus.includes('governance'),
      corpus.includes('science and technology') || corpus.includes('science technology') || corpus.includes('science and tech') || corpus.includes('s and t'),
    ].some(Boolean);
  };

  const startRandomPyqTest = useCallback(async (startYear: number, endYear: number, count: number) => {
    try {
      const { data: testRows, error: testErr } = await supabase.from('tests').select('id, title, launch_year, exam_year, institute, program_id, program_name, series').limit(5000);
      if (testErr) throw testErr;
      const eligibleTests = (testRows || []).filter((t: any) => {
        const y = Number(t.launch_year || t.exam_year || 0);
        return y >= startYear && y <= endYear && isStrictPyqSource(t);
      });
      if (eligibleTests.length === 0) { Alert.alert('No tests found', 'No matching X-IAS / PYQ Book / UPSC CSE tests were found.'); return false; }
      const testIdSet = new Set(eligibleTests.map((t: any) => String(t.id)));
      const { data: qRows, error: qErr } = await supabase.from('questions').select('id, test_id, is_pyq, subject, section_group, micro_topic, source').in('test_id', Array.from(testIdSet)).eq('is_pyq', true).limit(12000);
      if (qErr) throw qErr;
      const filtered = (qRows || []).filter((q: any) => isStrictPyqSubject(q));
      if (filtered.length < count) { Alert.alert('Not enough questions', `Found only ${filtered.length} strict PYQ questions.`); return false; }
      const selected = filtered.map((q: any) => q.id).sort(() => Math.random() - 0.5).slice(0, count);
      router.push({ pathname: '/unified/engine', params: { mode: 'exam', view: 'list', timer: 'countdown', resultIds: selected.join(','), title: `Random PYQ ${startYear}-${endYear}` } } as any);
      return true;
    } catch (e: any) { Alert.alert('Launch failed', e?.message || 'Error'); return false; }
  }, []);

  const submitRandomPyqPicker = async () => {
    const startYear = Number(pyqStartYear);
    const endYear = Number(pyqEndYear);
    const count = Number(pyqQuestionCount);
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return;
    setLaunchingPyq(true);
    const success = await startRandomPyqTest(Math.min(startYear, endYear), Math.max(startYear, endYear), Math.floor(count));
    setLaunchingPyq(false);
    if (success) setPyqPickerVisible(false);
  };

  const handleLongPressIn = () => { longPressTimer.current = setTimeout(() => { Vibration.vibrate(50); setIsEditMode(true); }, 3000); };
  const handleLongPressOut = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  const renderNoteCard = ({ item }: { item: NoteNode }) => (
    <TouchableOpacity 
      style={[styles.noteCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
      onPress={() => router.push({ pathname: '/notes/editor', params: { id: item.note_id } })}
    >
      <LinearGradient colors={[colors.primary + '10', 'transparent']} style={styles.cardGlow} />
      <View style={styles.glassFill}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20', width: 32, height: 32 }]}>
          <FileText size={16} color={colors.primary} />
        </View>
        <Text style={[styles.noteTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
          <Clock size={10} color={colors.textTertiary} />
          <Text style={[styles.noteDate, { color: colors.textTertiary }]}>{new Date(item.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const saveConfig = async (category: any, subjects: string[]) => {
    const newConfig = { category, subjects };
    await AsyncStorage.setItem('dashboard_widget_config', JSON.stringify(newConfig));
    load();
  };

  return (
    <PageWrapper>
      <DraggableFlatList
        data={activeWidgets}
        keyExtractor={(item) => item.id}
        onDragEnd={({ data }) => { setWidgets(prev => [...data, ...prev.filter(w => w.is_archived)]); WidgetService.reorder(userId!, data.map(d => d.id)); }}
        activationDistance={20}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={() => (
          <>
            {/* 1. Header Section */}
            <View style={styles.heroSection}>
              <View style={styles.headerRow}>
                <View>
                  <Text style={[styles.greeting, { color: colors.textTertiary }]}>WELCOME BACK</Text>
                  <Text style={[styles.userName, { color: colors.textPrimary }]}>{name}.</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/profile')} style={styles.profileBtn}>
                  <LinearGradient colors={[colors.primary, colors.primary + 'CC']} style={styles.avatarWrap}>
                    <Text style={styles.avatarTxt}>{(name[0] || 'A').toUpperCase()}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <GlobalSearchBar 
                  placeholder="Search topics, notes, or PYQs..." 
                  onSearch={(q, f) => router.push({ pathname: "/unified/arena", params: { tab: 'search', query: q, filters: JSON.stringify(f) } } as any)}
                />
              </View>
            </View>

            {/* 2. Productivity Pulse */}
            <View style={styles.pulseContainer}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>PRODUCTIVITY PULSE</Text>
                <Zap size={14} color={colors.primary} />
              </View>
              
              <View style={styles.pulseGrid}>
                <TouchableOpacity style={[styles.pulseCard, { width: CARD_WIDTH, borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => router.push('/flashcards/review')}>
                  <LinearGradient colors={['rgba(255,149,0,0.15)', 'transparent']} style={styles.cardGlow} />
                  <View style={[styles.iconCircle, { backgroundColor: '#FF950020' }]}>
                    <RotateCcw size={20} color="#FF9500" />
                  </View>
                  <View style={styles.pulseInfo}>
                    <Text style={[styles.pulseVal, { color: colors.textPrimary }]}>{stats.dueCards}</Text>
                    <Text style={[styles.pulseLab, { color: colors.textSecondary }]}>Due Cards</Text>
                  </View>
                  <ChevronRight size={14} color={colors.textTertiary} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.pulseCard, { width: CARD_WIDTH, borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => router.push('/tracker')}>
                  <LinearGradient colors={['rgba(52,199,89,0.15)', 'transparent']} style={styles.cardGlow} />
                  <View style={[styles.iconCircle, { backgroundColor: '#34C75920' }]}>
                    <Target size={20} color="#34C759" />
                  </View>
                  <View style={styles.pulseInfo}>
                    <Text style={[styles.pulseVal, { color: colors.textPrimary }]}>{stats.syllabusPercent}%</Text>
                    <Text style={[styles.pulseLab, { color: colors.textSecondary }]}>Syllabus</Text>
                  </View>
                  <ChevronRight size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. Resume Study Section */}
            <View style={styles.resumeContainer}>
              <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginLeft: 20 }]}>RESUME STUDY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resumeScroll}>
                <ResumeAction icon={<Layout size={20} color="#007AFF" />} title="Tracker" sub="Daily Syllabus" onPress={() => router.push('/tracker')} colors={colors} />
                <ResumeAction icon={<Layers size={20} color="#AF52DE" />} title="Flashcards" sub="Smart Review" onPress={() => router.push('/flashcards')} colors={colors} />
                <ResumeAction icon={<BarChart3 size={20} color="#34C759" />} title="Analyse" sub="Performance" onPress={() => router.push('/analyse')} colors={colors} />
                <ResumeAction icon={<History size={20} color="#FF9500" />} title="Archive" sub="Review PYQs" onPress={() => router.push('/pyq')} colors={colors} />
              </ScrollView>
            </View>

            {/* 4. Syllabus Tracker Widget */}
            <TouchableOpacity 
              style={[styles.trackerWidget, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onLongPress={() => setConfigVisible(true)}
              onPress={() => router.push('/tracker')}
            >
              <LinearGradient colors={[colors.primary + '05', 'transparent']} style={styles.cardGlow} />
              <View style={styles.trackerTop}>
                <View style={[styles.trackerIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Award size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={[styles.trackerTitle, { color: colors.textPrimary }]}>Syllabus Mastery</Text>
                  <View style={[styles.catBadge, { backgroundColor: colors.primary + '15' }]}>
                    <Text style={[styles.catText, { color: colors.primary }]}>{widgetCategory.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.masteryText, { color: colors.primary }]}>{stats.syllabusPercent}%</Text>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, textTransform: 'uppercase' }}>Completed</Text>
                </View>
              </View>
              <View style={styles.subjectList}>
                {stats.subjectProgress.slice(0, 3).map(sp => (
                  <View key={sp.label} style={styles.subItemRow}>
                    <View style={styles.subTextRow}>
                      <Text style={[styles.subName, { color: colors.textSecondary }]} numberOfLines={1}>{sp.label}</Text>
                      <Text style={[styles.subPer, { color: colors.textTertiary }]}>{Math.round(sp.progress * 100)}%</Text>
                    </View>
                    <View style={[styles.barBase, { backgroundColor: colors.border + '50' }]}>
                      <LinearGradient 
                        colors={[sp.color, sp.color + '90']} 
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[styles.barInner, { width: `${Math.max(sp.progress * 100, 5)}%` }]} 
                      />
                    </View>
                  </View>
                ))}
              </View>
            </TouchableOpacity>

            {/* 5. Recent Notes Carousel */}
            <View style={styles.notesSection}>
              <View style={styles.sectionHeaderWide}>
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>RECENT NOTES</Text>
                <TouchableOpacity onPress={() => router.push('/notes')}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>View All</Text></TouchableOpacity>
              </View>
              <FlatList
                horizontal
                data={recentNotes}
                renderItem={renderNoteCard}
                keyExtractor={item => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.notesScroll}
              />
            </View>

            {/* 6. Quick Tags Chips */}
            <View style={styles.tagsSection}>
              <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginLeft: 20 }]}>TOP TAGS</Text>
              <View style={styles.tagCloud}>
                {topTags.map((tag, idx) => {
                  const tagColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                  const tagColor = tagColors[idx % tagColors.length];
                  return (
                    <TouchableOpacity key={tag.name} style={[styles.tagChip, { backgroundColor: colors.surface, borderColor: tagColor + '30' }]} onPress={() => router.push({ pathname: '/unified/arena', params: { tab: 'search', query: tag.name } } as any)}>
                      <Tag size={12} color={tagColor} />
                      <Text style={[styles.tagName, { color: colors.textPrimary }]}>{tag.name}</Text>
                      <View style={{ backgroundColor: tagColor + '15', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 }}>
                        <Text style={[styles.tagCount, { color: tagColor }]}>{tag.count}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={[styles.tagChip, { backgroundColor: colors.primary + '05', borderColor: colors.primary + '40', borderStyle: 'dashed' }]} onPress={() => router.push('/tags')}>
                  <Plus size={14} color={colors.primary} />
                  <Text style={[styles.tagName, { color: colors.primary }]}>View All Tags</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 7. Random PYQ Test Widget */}
            <TouchableOpacity style={styles.pyqBanner} onPress={() => setPyqPickerVisible(true)}>
              <LinearGradient colors={['#0f172a', '#1e293b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pyqBannerInner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pyqBannerTitle}>Random PYQ Test</Text>
                  <Text style={styles.pyqBannerSub}>UPSC CSE 2013-2024</Text>
                  <View style={styles.pyqMeta}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={12} color="#fff" />
                    </View>
                    <Text style={styles.pyqMetaText}>Timed Exam Mode</Text>
                  </View>
                </View>
                <View style={styles.pyqActionBtn}>
                  <Play size={24} color="#04223a" fill="#04223a" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginLeft: 20, marginTop: 32 }]}>MY CUSTOM WIDGETS</Text>
          </>
        )}
        renderItem={({ item, drag, isActive }) => (
          <ScaleDecorator>
            <TouchableOpacity onLongPress={drag} style={{ paddingHorizontal: 20, marginBottom: 12 }}>
              <WidgetRenderer widgetKey={item.widget_key} data={widgetData} onArchive={() => WidgetService.archive(userId!, item.id).then(load)} />
            </TouchableOpacity>
          </ScaleDecorator>
        )}
        ListFooterComponent={() => (
          <TouchableOpacity onPress={() => setShowManage(true)} style={styles.footerBtn}>
            <Sliders size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 8 }}>Manage Dashboard Widgets</Text>
          </TouchableOpacity>
        )}
      />

      {/* Modals */}
      <Modal visible={pyqPickerVisible} transparent animationType="fade" onRequestClose={() => setPyqPickerVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPyqPickerVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Random PYQ Test</Text>
              <View style={styles.pyqForm}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>YEAR RANGE</Text>
                  <View style={styles.yearRow}>
                    <TextInput value={pyqStartYear} onChangeText={setPyqStartYear} keyboardType="number-pad" style={[styles.yearInput, { color: colors.textPrimary, borderColor: colors.border }]} />
                    <Text style={{ color: colors.textTertiary }}>to</Text>
                    <TextInput value={pyqEndYear} onChangeText={setPyqEndYear} keyboardType="number-pad" style={[styles.yearInput, { color: colors.textPrimary, borderColor: colors.border }]} />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>QUESTION COUNT</Text>
                  <TextInput value={pyqQuestionCount} onChangeText={setPyqQuestionCount} keyboardType="number-pad" style={[styles.countInput, { color: colors.textPrimary, borderColor: colors.border }]} />
                </View>
                <TouchableOpacity style={[styles.launchBtn, { backgroundColor: colors.primary }]} onPress={submitRandomPyqPicker}>
                  <Text style={styles.launchBtnTxt}>Generate Test</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <WidgetConfigModal visible={configVisible} onClose={() => setConfigVisible(false)} onSave={saveConfig} category={widgetCategory} setCategory={setWidgetCategory} selectedSubjects={selectedSubjects} setSelectedSubjects={setSelectedSubjects} optionalChoice={optionalChoice} colors={colors} />

      <Modal visible={showManage} transparent animationType="fade" onRequestClose={() => setShowManage(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: colors.textPrimary, marginBottom: 16 }}>Archived Widgets</Text>
            <ScrollView nestedScrollEnabled>
              {archivedWidgets.length === 0 ? (
                <Text style={{ color: colors.textTertiary, textAlign: 'center', padding: 24 }}>No archived widgets.</Text>
              ) : (
                archivedWidgets.map(w => (
                  <TouchableOpacity
                    key={w.id}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    onPress={async () => {
                      await WidgetService.restore(userId!, w.id);
                      load();
                    }}
                  >
                    <Text style={{ color: colors.textPrimary }}>{w.widget_key}</Text>
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>RESTORE</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowManage(false)} style={{ padding: 16, alignItems: 'center' }}>
              <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </PageWrapper>
  );
}

function ResumeAction({ icon, title, sub, onPress, colors }: any) {
  return (
    <TouchableOpacity style={[styles.resumeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress}>
      <View style={styles.resumeIconWrap}>{icon}</View>
      <View>
        <Text style={[styles.resumeTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.resumeSub, { color: colors.textTertiary }]}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );
}

function WidgetConfigModal({ visible, onClose, onSave, category, setCategory, selectedSubjects, setSelectedSubjects, optionalChoice, colors }: any) {
  const categories = ['Prelims', 'Mains', 'Optional'];
  const subjects = useMemo(() => {
    if (category === 'Optional') return [`${optionalChoice} Paper 1`, `${optionalChoice} Paper 2`];
    if (category === 'Mains') return Object.keys(require('../../src/data/syllabus').MAINS_SYLLABUS);
    return Object.keys(MICRO_SYLLABUS);
  }, [category, optionalChoice]);

  const toggleSubject = (s: string) => {
    if (selectedSubjects.includes(s)) setSelectedSubjects(selectedSubjects.filter((x: string) => x !== s));
    else setSelectedSubjects([...selectedSubjects, s]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Widget Settings</Text>
            <TouchableOpacity onPress={onClose}><X color={colors.textPrimary} size={24} /></TouchableOpacity>
          </View>

          <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>SYLLABUS CATEGORY</Text>
          <View style={styles.catRow}>
            {categories.map(c => (
              <TouchableOpacity key={c} style={[styles.catBtn, { backgroundColor: category === c ? colors.primary : colors.surfaceStrong }]} onPress={() => setCategory(c)}>
                <Text style={[styles.catText, { color: category === c ? '#fff' : colors.textPrimary }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.modalLabel, { color: colors.textSecondary, marginTop: 24 }]}>VISIBLE SUBJECTS</Text>
          <ScrollView contentContainerStyle={styles.subGrid}>
            <TouchableOpacity style={[styles.subItem, selectedSubjects.length === 0 && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]} onPress={() => setSelectedSubjects([])}>
              <Text style={[styles.subText, { color: colors.textPrimary }, selectedSubjects.length === 0 && { color: colors.primary, fontWeight: '800' }]}>All Subjects</Text>
            </TouchableOpacity>
            {subjects.map((s: any) => (
              <TouchableOpacity key={s} style={[styles.subItem, selectedSubjects.includes(s) && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]} onPress={() => toggleSubject(s)}>
                <Text style={[styles.subText, { color: colors.textPrimary }, selectedSubjects.includes(s) && { color: colors.primary, fontWeight: '800' }]}>{s}</Text>
                {selectedSubjects.includes(s) && <Check size={14} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={() => { onSave(category, selectedSubjects); onClose(); }}>
            <Text style={styles.applyText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Hero & Header
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSection: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  userName: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  profileBtn: { elevation: 4 },
  avatarWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 20, fontWeight: '900' },
  searchContainer: { marginTop: 4 },

  // Sections
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 },
  sectionHeaderWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },

  // Pulse Cards
  pulseContainer: { marginBottom: 32 },
  pulseGrid: { flexDirection: 'row', paddingHorizontal: 20, gap: 16 },
  pulseCard: { height: 110, borderRadius: 28, borderWidth: 1, padding: 20, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 },
  cardGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  pulseInfo: { flex: 1, marginLeft: 16 },
  pulseVal: { fontSize: 24, fontWeight: '900', letterSpacing: -1 },
  pulseLab: { fontSize: 12, fontWeight: '800', marginTop: 2, opacity: 0.7 },

  // Resume Action
  resumeContainer: { marginBottom: 32 },
  resumeScroll: { paddingHorizontal: 20, gap: 16 },
  resumeBtn: { width: 160, padding: 20, borderRadius: 24, borderWidth: 1, gap: 16, elevation: 1 },
  resumeIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' },
  resumeTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  resumeSub: { fontSize: 11, fontWeight: '700', opacity: 0.6 },

  // Syllabus Tracker Widget
  trackerWidget: { marginHorizontal: 20, borderRadius: 32, borderWidth: 1, padding: 24, marginBottom: 32, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 15 },
  trackerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  trackerIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  trackerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  catBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginTop: 6 },
  catText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  masteryText: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  subjectList: { gap: 16 },
  subItemRow: { gap: 8 },
  subTextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subName: { fontSize: 16, fontWeight: '800', flex: 1 },
  subPer: { fontSize: 12, fontWeight: '700', opacity: 0.6 },
  barBase: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barInner: { height: '100%', borderRadius: 4 },

  // Recent Notes
  notesSection: { marginBottom: 32 },
  notesScroll: { paddingHorizontal: 20, gap: 16 },
  noteCard: { width: 180, height: 130, borderRadius: 24, borderWidth: 1, overflow: 'hidden', elevation: 2 },
  glassFill: { flex: 1, padding: 20 },
  noteTitle: { fontSize: 16, fontWeight: '900', marginTop: 12, height: 44, lineHeight: 22 },
  noteDate: { fontSize: 11, fontWeight: '700', marginTop: 'auto', opacity: 0.5 },

  // Tags
  tagsSection: { marginBottom: 32 },
  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, marginTop: 16 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 1, elevation: 1 },
  tagName: { fontSize: 14, fontWeight: '800' },
  tagCount: { fontSize: 10, fontWeight: '900', opacity: 0.4 },

  // PYQ Banner
  pyqBanner: { marginHorizontal: 20, height: 120, borderRadius: 32, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20 },
  pyqBannerInner: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 24 },
  pyqBannerTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  pyqBannerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '800', marginTop: 4 },
  pyqMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  pyqMetaText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700' },
  pyqActionBtn: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#34d399', alignItems: 'center', justifyContent: 'center', elevation: 4 },

  // Footer
  footerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, marginBottom: 40 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 24, fontWeight: '900', marginBottom: 20 },
  pyqForm: { gap: 20 },
  inputGroup: { gap: 10 },
  inputLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  yearInput: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 16, fontWeight: '700' },
  countInput: { height: 50, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 16, fontWeight: '700' },
  launchBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  launchBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  
  catRow: { flexDirection: 'row', gap: 10 },
  catBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catText: { fontSize: 14, fontWeight: '700' },
  subGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, maxHeight: 300, marginBottom: 20 },
  subItem: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  subText: { fontSize: 13, fontWeight: '600' },
  applyBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
});

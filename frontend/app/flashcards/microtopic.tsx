import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView,
  ActivityIndicator, TextInput, Modal, ScrollView, Alert, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft, Play, Plus, ArrowUpDown, SlidersHorizontal, MoreHorizontal, BookOpen, X, Check, Info, Clock,
} from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { PageWrapper } from '../../src/components/PageWrapper';
import { FlashcardSvc } from '../../src/services/FlashcardService';
import { CardOverflowMenu, CardMenuAction } from '../../src/components/flashcards/CardOverflowMenu';
import { SortSheet, SortKey } from '../../src/components/flashcards/SortSheet';
import { FilterSheet, FilterValue, EMPTY_FILTER } from '../../src/components/flashcards/FilterSheet';
import { FolderAlgorithmModal } from '../../src/components/flashcards/FolderAlgorithmModal';
import { AddToFlashcardSheet } from '../../src/components/flashcards/AddToFlashcardSheet';

interface CardItem {
  id: string;
  front_text: string;
  back_text: string;
  status: 'active' | 'frozen' | 'deleted';
  learning_status: 'not_studied' | 'learning' | 'review' | 'mastered' | 'leech';
  next_review?: string | null;
  last_reviewed?: string | null;
  updated_at: string;
  interval_days?: number;
}

interface Stats {
  for_today: number; not_studied: number; learning: number; mastered: number; total: number;
}

const SORT_LABELS: Record<SortKey, string> = {
  next: 'Next review', newest: 'Newest', oldest: 'Oldest', az: 'A-Z', za: 'Z-A',
};

export default function MicrotopicScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { subject, section, microtopic, branchId, branchName, recursive } = useLocalSearchParams<{
    subject?: string; section?: string; microtopic?: string;
    branchId?: string; branchName?: string; recursive?: string;
  }>();
  const uid = session?.user?.id;
  const isBranchMode = !!branchId;
  const isRecursive = recursive === '1';

  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CardItem[]>([]);
  const [stats, setStats] = useState<Stats>({ for_today: 0, not_studied: 0, learning: 0, mastered: 0, total: 0 });

  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [filter, setFilter] = useState<FilterValue>(EMPTY_FILTER);

  const [sortSheet, setSortSheet] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const [algoModal, setAlgoModal] = useState(false);

  const [menuCard, setMenuCard] = useState<CardItem | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuBusy, setMenuBusy] = useState(false);

  const [editVisible, setEditVisible] = useState(false);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');

  const [moveVisible, setMoveVisible] = useState(false);
  // Legacy free-text move fields (kept for backward compat — replaced by deck-tree picker via AddToFlashcardSheet).
  const [moveSubject, setMoveSubject] = useState('');
  const [moveSection, setMoveSection] = useState('');
  const [moveMicrotopic, setMoveMicrotopic] = useState('');

  const loadAll = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      let cardIds: string[] = [];
      let baseCards: any[] = [];

      if (isBranchMode) {
        // AnkiPro branch mode: get cards from this branch (+ descendants if recursive)
        const { BranchSvc } = await import('../../src/services/BranchService');
        cardIds = await BranchSvc.listCardIdsInBranch(String(branchId), { recursive: isRecursive, userId: uid });
        if (cardIds.length > 0) {
          // Fetch the underlying cards in chunks of 500 for large decks
          const chunks: any[] = [];
          for (let i = 0; i < cardIds.length; i += 500) {
            const { data, error } = await supabase.from('cards').select('*').in('id', cardIds.slice(i, i + 500));
            if (error) throw error;
            chunks.push(...(data || []));
          }
          baseCards = chunks;
        }
      } else {
        // Legacy subject/section/microtopic mode
        let baseQuery = supabase.from('cards').select('*')
          .eq('subject', subject)
          .eq('microtopic', microtopic);
        if (section && section !== 'General') {
          baseQuery = baseQuery.eq('section_group', section);
        } else {
          baseQuery = baseQuery.or('section_group.is.null,section_group.eq.General');
        }
        const { data, error } = await baseQuery;
        if (error) throw error;
        baseCards = data || [];
        cardIds = baseCards.map(c => c.id);
      }

      const { data: progress, error: pErr } = await supabase
        .from('user_cards').select('*').eq('user_id', uid).in('card_id', cardIds);
      if (pErr) throw pErr;

      const progressMap = new Map<string, any>();
      progress?.forEach((p: any) => progressMap.set(p.card_id, p));

      const merged: CardItem[] = baseCards.map((bc: any) => {
        const p = progressMap.get(bc.id);
        return {
          id: bc.id,
          front_text: bc.front_text || bc.question_text || '',
          back_text: bc.back_text || bc.answer_text || '',
          status: p?.status || 'active',
          learning_status: p?.learning_status || 'not_studied',
          next_review: p?.next_review,
          last_reviewed: p?.last_reviewed,
          updated_at: p?.updated_at || bc.created_at,
          interval_days: p?.interval_days,
        };
      }).filter(c => c.status !== 'deleted');
      setCards(merged);

      // Folder-aware stats (respects daily caps)
      const s = await FlashcardSvc.getFolderStats(uid, isBranchMode
        ? { branch_id: String(branchId), recursive: isRecursive }
        : { subject: String(subject), section: String(section), microtopic: String(microtopic) }
      );
      setStats(s);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err?.message || 'Could not load cards');
    } finally {
      setLoading(false);
    }
  }, [uid, subject, section, microtopic, branchId, isBranchMode, isRecursive]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filteredSortedCards = useMemo(() => {
    let list = [...cards];

    // Default (no filter selected): show everything NON-frozen
    if (filter.learning_status.length === 0 && filter.card_status.length === 0) {
      list = list.filter(c => c.status !== 'frozen');
    } else {
      if (filter.learning_status.length > 0) {
        list = list.filter(c => {
          const ls = c.learning_status;
          if (filter.learning_status.includes('not_studied') && (ls === 'not_studied')) return true;
          if (filter.learning_status.includes('learning') && (ls === 'learning' || ls === 'leech' || ls === 'review')) return true;
          if (filter.learning_status.includes('mastered') && ls === 'mastered') return true;
          return false;
        });
      }
      if (filter.card_status.length > 0) {
        list = list.filter(c => filter.card_status.includes(c.status as any));
      }
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'next') {
        const ad = a.next_review ? new Date(a.next_review).getTime() : Number.POSITIVE_INFINITY;
        const bd = b.next_review ? new Date(b.next_review).getTime() : Number.POSITIVE_INFINITY;
        return ad - bd;
      }
      if (sortBy === 'newest') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      if (sortBy === 'oldest') return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      if (sortBy === 'az') return (a.front_text || '').localeCompare(b.front_text || '');
      if (sortBy === 'za') return (b.front_text || '').localeCompare(a.front_text || '');
      return 0;
    });

    return list;
  }, [cards, sortBy, filter]);

  const dueLabel = (c: CardItem) => {
    if (!c.next_review) return 'New';
    const now = Date.now();
    const t = new Date(c.next_review).getTime();
    const diff = t - now;
    if (diff <= 0) return 'Today';
    const day = 24 * 60 * 60 * 1000;
    if (diff < day) {
      const hrs = Math.round(diff / (60 * 60 * 1000));
      return hrs < 1 ? 'Soon' : `${hrs}h`;
    }
    const days = Math.round(diff / day);
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `${days}d`;
    if (days < 30) return `${days}d`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months}mo`;
    return `${Math.round(days/365)}y`;
  };

  const openMenu = (card: CardItem) => { setMenuCard(card); setMenuVisible(true); };
  const closeMenu = () => { setMenuVisible(false); setMenuCard(null); };

  const handleMenuAction = async (action: CardMenuAction) => {
    if (!menuCard || !uid) return;
    try {
      setMenuBusy(true);
      switch (action) {
        case 'edit':
          closeMenu();
          setEditFront(menuCard.front_text || '');
          setEditBack(menuCard.back_text || '');
          setEditVisible(true);
          return;
        case 'freeze':
          await FlashcardSvc.toggleFreeze(uid, menuCard.id, menuCard.status);
          await loadAll();
          closeMenu(); return;
        case 'move':
          closeMenu();
          setMoveVisible(true);
          return;
        case 'reverse':
          closeMenu();
          Alert.alert('Reverse card?', 'Front and back will be swapped.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reverse', onPress: async () => { try { await FlashcardSvc.reverseCardForUser(uid, menuCard.id); await loadAll(); } catch (e: any) { Alert.alert('Failed', e?.message); } } },
          ]);
          return;
        case 'duplicate':
          await FlashcardSvc.duplicateCardForUser(uid, menuCard.id);
          await loadAll(); closeMenu(); return;
        case 'history':
          closeMenu();
          router.push({ pathname: '/flashcards/history', params: { cardId: menuCard.id, title: menuCard.front_text?.slice(0, 40) || 'Card history' } });
          return;
        case 'delete': {
          const deletedId = menuCard.id; closeMenu();
          Alert.alert('Delete card?', 'You can undo immediately.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                  await FlashcardSvc.softDeleteCardForUser(uid, deletedId);
                  await loadAll();
                  Alert.alert('Deleted', 'Card removed.', [
                    { text: 'Undo', onPress: async () => { try { await FlashcardSvc.restoreDeletedCardForUser(uid, deletedId); await loadAll(); } catch (e: any) { Alert.alert('Undo failed', e?.message); } } },
                    { text: 'OK' },
                  ]);
                } catch (e: any) { Alert.alert('Action failed', e?.message); }
              },
            },
          ]); return;
        }
      }
    } catch (e: any) {
      Alert.alert('Action failed', e?.message || 'Please try again');
    } finally { setMenuBusy(false); }
  };

  const startStudy = () => {
    const params: any = isBranchMode
      ? { branchId: String(branchId), recursive: isRecursive ? '1' : '0', branchName: String(branchName || ''), mode: 'study' }
      : { subject, section, microtopic, mode: 'study' };
    router.push({ pathname: '/flashcards/review', params });
  };

  const renderCardItem = ({ item }: { item: CardItem }) => {
    const isFrozen = item.status === 'frozen';
    const statusColor =
      item.learning_status === 'mastered' ? '#3b82f6' :
      item.learning_status === 'learning' || item.learning_status === 'review' ? '#22c55e' :
      item.learning_status === 'leech' ? '#ef4444' : colors.textTertiary;

    return (
      <TouchableOpacity
        style={[styles.cardItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push({ pathname: '/flashcards/review', params: { subject, section, microtopic, cardId: item.id, mode: 'single' } })}
        testID={`card-row-${item.id}`}
      >
        <View style={styles.cardTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color={statusColor} />
            <Text style={[styles.cardDueLabel, { color: statusColor }]}>{dueLabel(item)}</Text>
            {isFrozen && <Text style={[styles.tag, { color: '#ef4444', borderColor: '#ef4444' }]}>FROZEN</Text>}
          </View>
          <TouchableOpacity onPress={() => openMenu(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} testID={`card-menu-${item.id}`}>
            <MoreHorizontal size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.cardFront, { color: colors.textPrimary }]} numberOfLines={2}>{item.front_text || '(empty)'}</Text>
      </TouchableOpacity>
    );
  };

  const anyFilterOn = filter.learning_status.length + filter.card_status.length > 0;

  return (
    <PageWrapper>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="btn-back"><ArrowLeft size={24} color={colors.textPrimary} /></TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {isBranchMode ? (branchName || 'Deck') : microtopic}
            </Text>
            <Text style={[styles.headerSub, { color: colors.textTertiary }]}>
              {isBranchMode ? (isRecursive ? 'Includes all sub-decks' : 'Direct cards only') : `${subject} • ${section}`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push({
              pathname: '/flashcards/new',
              params: {
                subject: String(subject || 'General'),
                section: String(section || 'General'),
                microtopic: String(microtopic || 'General'),
                branchId: branchId ? String(branchId) : '',
                branchName: branchName ? String(branchName) : '',
              },
            })}
            style={styles.iconBtn}
            testID="btn-add"
          >
            <Plus size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredSortedCards}
          keyExtractor={(i) => i.id}
          renderItem={renderCardItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          ListHeaderComponent={
            <View>
              {/* Algorithm row */}
              <View style={styles.algoRow}>
                <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Learning algorithm: </Text>
                <TouchableOpacity onPress={() => setAlgoModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} testID="open-algo">
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }}>Custom</Text>
                  <Info size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Hero */}
              <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="hero">
                <Text style={[styles.heroNum, { color: colors.textPrimary }]}>{stats.for_today}</Text>
                <Text style={[styles.heroSub, { color: colors.textTertiary }]}>cards for today</Text>

                <View style={styles.heroGrid}>
                  <MiniStat num={stats.not_studied} label="Not studied" color={colors.textTertiary} />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <MiniStat num={stats.learning} label="Learning" color="#22c55e" />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <MiniStat num={stats.mastered} label="Mastered" color="#3b82f6" />
                </View>

                <TouchableOpacity
                  style={[styles.studyBtn, { backgroundColor: stats.for_today > 0 ? colors.primary : colors.surfaceStrong }]}
                  onPress={startStudy}
                  disabled={stats.for_today === 0}
                  testID="btn-study"
                >
                  <Play size={18} color={stats.for_today > 0 ? '#04223a' : colors.textTertiary} fill={stats.for_today > 0 ? '#04223a' : 'transparent'} />
                  <Text style={[styles.studyBtnText, { color: stats.for_today > 0 ? '#04223a' : colors.textTertiary }]}>
                    {stats.for_today > 0 ? 'Study cards' : 'All caught up'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Cards-in-deck header */}
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Cards in deck ({stats.total})</Text>
              </View>

              {/* Progress bar */}
              <View style={[styles.progressOuter, { backgroundColor: colors.border }]}>
                {stats.total > 0 && (
                  <>
                    <View style={[styles.progressSeg, { flex: stats.learning, backgroundColor: '#22c55e' }]} />
                    <View style={[styles.progressSeg, { flex: stats.mastered, backgroundColor: '#3b82f6' }]} />
                    <View style={[styles.progressSeg, { flex: stats.not_studied, backgroundColor: '#64748b' }]} />
                  </>
                )}
              </View>
              <View style={styles.legendRow}>
                <Legend color="#64748b" num={stats.not_studied} label="Not studied" />
                <Legend color="#22c55e" num={stats.learning} label="Learning" />
                <Legend color="#3b82f6" num={stats.mastered} label="Mastered" />
              </View>

              {/* Sort + Filter toolbar */}
              <View style={styles.toolbar}>
                <TouchableOpacity onPress={() => setSortSheet(true)} style={[styles.toolBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="btn-sort">
                  <ArrowUpDown size={16} color={colors.textPrimary} />
                  <Text style={[styles.toolText, { color: colors.textPrimary }]}>{SORT_LABELS[sortBy]}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setFilterSheet(true)}
                  style={[styles.toolBtn, { backgroundColor: anyFilterOn ? colors.primary + '20' : colors.surface, borderColor: anyFilterOn ? colors.primary : colors.border }]}
                  testID="btn-filter"
                >
                  <Text style={[styles.toolText, { color: anyFilterOn ? colors.primary : colors.textPrimary }]}>Filters</Text>
                  <SlidersHorizontal size={16} color={anyFilterOn ? colors.primary : colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View style={{ alignItems: 'center', marginTop: 40 }}><ActivityIndicator color={colors.primary} /></View>
            ) : (
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <BookOpen size={48} color={colors.border} />
                <Text style={{ color: colors.textTertiary, marginTop: 12 }}>No cards match your filter</Text>
              </View>
            )
          }
          ListFooterComponent={
            <TouchableOpacity
              style={[styles.addCardsBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push({
                pathname: '/flashcards/new',
                params: {
                  subject: String(subject || 'General'),
                  section: String(section || 'General'),
                  microtopic: String(microtopic || 'General'),
                  branchId: branchId ? String(branchId) : '',
                  branchName: branchName ? String(branchName) : '',
                },
              })}
              testID="btn-add-cards"
            >
              <Plus size={18} color={colors.textPrimary} />
              <Text style={[styles.addCardsText, { color: colors.textPrimary }]}>Add cards</Text>
            </TouchableOpacity>
          }
        />

        {/* Sheets */}
        <SortSheet visible={sortSheet} value={sortBy} onClose={() => setSortSheet(false)} onSelect={setSortBy} />
        <FilterSheet visible={filterSheet} value={filter} onClose={() => setFilterSheet(false)} onApply={setFilter} />
        <FolderAlgorithmModal
          visible={algoModal}
          userId={uid}
          subject={String(subject || '')}
          section={String(section || '')}
          microtopic={String(microtopic || '')}
          onClose={() => setAlgoModal(false)}
          onSaved={loadAll}
        />

        {/* Row overflow menu + modals (edit / move) */}
        <CardOverflowMenu visible={menuVisible} frozen={menuCard?.status === 'frozen'} busy={menuBusy} onClose={closeMenu} onAction={handleMenuAction} />

        <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={16}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.surface, height: '70%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Card</Text>
                <TouchableOpacity onPress={() => setEditVisible(false)}><X size={22} color={colors.textPrimary} /></TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
                <Text style={{ color: colors.textSecondary, marginBottom: 6 }}>Front</Text>
                <TextInput value={editFront} onChangeText={setEditFront} multiline style={[styles.noteInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg, height: 120 }]} />
                <Text style={{ color: colors.textSecondary, marginBottom: 6, marginTop: 14 }}>Back</Text>
                <TextInput value={editBack} onChangeText={setEditBack} multiline style={[styles.noteInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg, height: 120 }]} />
              </ScrollView>

              <TouchableOpacity
                style={[styles.studyBtn, { backgroundColor: colors.primary, marginTop: 16, alignSelf: 'stretch' }]}
                onPress={async () => {
                  if (!menuCard || !uid) return;
                  if (!editFront.trim() || !editBack.trim()) return Alert.alert('Validation', 'Front and back are required');
                  try { await FlashcardSvc.updateCardForUser(uid, menuCard.id, { front_text: editFront.trim(), back_text: editBack.trim() }); setEditVisible(false); await loadAll(); }
                  catch (e: any) { Alert.alert('Save failed', e?.message || 'Please try again'); }
                }}
              >
                <Text style={[styles.studyBtnText, { color: '#04223a' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <AddToFlashcardSheet
          visible={moveVisible}
          onClose={() => setMoveVisible(false)}
          userId={uid || ''}
          cardId={menuCard?.id || null}
          hint={{
            subject: String(subject || 'General'),
            section_group: String(section || 'General'),
            microtopic: String(microtopic || 'General'),
          }}
          fromBranchId={branchId ? String(branchId) : undefined}
          title={isBranchMode ? 'Move card to deck' : 'Move card'}
          onPlaced={async () => { await loadAll(); }}
        />
      </SafeAreaView>
    </PageWrapper>
  );
}

function MiniStat({ num, label, color }: { num: number; label: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color, fontSize: 22, fontWeight: '900' }}>{num}</Text>
      <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', marginTop: 2 }}>{label}</Text>
    </View>
  );
}
function Legend({ color, num, label }: any) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '700' }}>{num} {label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, marginLeft: 6 },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  headerSub: { fontSize: 12, marginTop: 2 },
  algoRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 14, paddingBottom: 8 },
  hero: { borderWidth: 1, borderRadius: 20, padding: 20, alignItems: 'center' },
  heroNum: { fontSize: 56, fontWeight: '900', lineHeight: 60 },
  heroSub: { fontSize: 14, marginTop: -2, marginBottom: 18 },
  heroGrid: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginBottom: 18 },
  divider: { width: 1, height: 32 },
  studyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', height: 54, borderRadius: 14, gap: 8 },
  studyBtnText: { fontSize: 17, fontWeight: '900' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  progressOuter: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  progressSeg: { height: 8 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 10 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 14 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  toolText: { fontSize: 13, fontWeight: '800' },
  cardItem: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardDueLabel: { fontSize: 12, fontWeight: '800' },
  cardFront: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  tag: { fontSize: 9, fontWeight: '900', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  addCardsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderWidth: 1, borderStyle: 'dashed', borderRadius: 999, marginTop: 14, marginBottom: 20 },
  addCardsText: { fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  noteInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
});

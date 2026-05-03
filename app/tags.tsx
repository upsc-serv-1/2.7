import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Animated,
  Modal,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../src/context/ThemeContext';
import { spacing } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import { useTaggedVault } from '../src/hooks/useTaggedQuestions';
import { RepoQuestionCard } from '../src/components/RepoQuestionCard';
import { PageWrapper } from '../src/components/PageWrapper';
import { useFocusEffect, router } from 'expo-router';
import {
  Search,
  Filter,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Database,
  ArrowLeft,
  Layers,
  FolderOpen,
  Scale,
  Scroll,
  TrendingUp,
  Globe,
  Leaf,
  Atom,
  Hash,
  Palette,
  Shield,
  Map as MapIcon,
  Heart,
  Users,
  Settings,
  Sparkles,
  Download,
  MoreVertical,
  Plus,
  Pencil,
  Trash2,
  Check,
  ChevronLeft,
} from 'lucide-react-native';
import { normalizeTag } from '../src/utils/tagUtils';
import { buildNotesPdfHtml } from '../src/utils/notesPdfEngine';

type ExportScope = 'all' | 'single' | 'multi';
type ContentMode = 'questions' | 'questions_answers';
type PaginationMode = 'none' | 'tag';

type ExportConfig = {
  scope: ExportScope;
  content: ContentMode;
  singleTag: string;
  multiTags: string[];
  showMetadata: boolean;
  boldQuestion: boolean;
  pagination: PaginationMode;
};

export default function TaggedRepoScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const {
    loading,
    vaultData,
    allQuestions,
    uniqueTags,
    filters,
    refresh,
    addTagToReview,
    renameTagGlobally,
    removeTagFromReview,
  } = useTaggedVault(session?.user?.id);

  // Local UI State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedMicroTopics, setExpandedMicroTopics] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Fade animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ZEN MODE STATE
  const [isZenMode, setIsZenMode] = useState(false);

  // Tag management state
  const [menuVisible, setMenuVisible] = useState(false);
  const [manageVisible, setManageVisible] = useState(false);
  const [manageMode, setManageMode] = useState<'edit' | 'review'>('edit');
  const [newTagText, setNewTagText] = useState('');
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [savingTag, setSavingTag] = useState(false);

  // Export state
  const [exportVisible, setExportVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    scope: 'all',
    content: 'questions_answers',
    singleTag: '',
    multiTags: [],
    showMetadata: true,
    boldQuestion: true,
    pagination: 'tag',
  });
  const [pdfFontSize, setPdfFontSize] = useState(14);
  const [pdfSubheadingColor, setPdfSubheadingColor] = useState('#f3f4f6');
  const [showAdvancedPDF, setShowAdvancedPDF] = useState(false);
  const [pdfPaperStyle, setPdfPaperStyle] = useState<'plain' | 'lined' | 'grid' | 'dots'>('plain');
  const [pdfTheme, setPdfTheme] = useState<'modern' | 'sepia' | 'historical'>('modern');
  const [pdfWatermark, setPdfWatermark] = useState('');
  const [pdfFooterText, setPdfFooterText] = useState('UPSC Repository');
  const [pdfShowTOC, setPdfShowTOC] = useState(true);
  const [pdfSpacing, setPdfSpacing] = useState<'compact' | 'comfortable'>('comfortable');
  const [pdfFontFamily, setPdfFontFamily] = useState<'sans' | 'handwriting'>('sans');

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, fadeAnim]);

  const toggleZenMode = () => {
    setIsZenMode((v) => !v);
  };

  const zenBg = isZenMode ? '#F4ECD8' : colors.bg;
  const zenTextColor = isZenMode ? '#433422' : colors.textPrimary;

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    if (!exportConfig.singleTag && uniqueTags.length > 0) {
      setExportConfig((prev) => ({ ...prev, singleTag: uniqueTags[0] }));
    }
  }, [exportConfig.singleTag, uniqueTags]);

  const toggleSection = (secName: string) => {
    setExpandedSections((prev) => ({ ...prev, [secName]: !prev[secName] }));
  };

  const toggleMicroTopic = (microName: string) => {
    setExpandedMicroTopics((prev) => ({ ...prev, [microName]: !prev[microName] }));
  };

  const getSubjectIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('polity')) return Scale;
    if (n.includes('history')) return Scroll;
    if (n.includes('economy')) return TrendingUp;
    if (n.includes('geography')) return Globe;
    if (n.includes('environment')) return Leaf;
    if (n.includes('science') || n.includes('tech')) return Atom;
    if (n.includes('csat')) return Hash;
    if (n.includes('art') || n.includes('culture')) return Palette;
    if (n.includes('security')) return Shield;
    if (n.includes('international') || n.includes('ir')) return MapIcon;
    if (n.includes('ethics')) return Heart;
    if (n.includes('social')) return Users;
    if (n.includes('governance')) return Settings;
    return BookOpen;
  };

  const stats = useMemo(() => {
    return [
      { label: 'Total Vault', value: vaultData.totalCount, icon: Database },
      { label: 'Subjects', value: vaultData.subjects.filter((x) => x.totalCount > 0).length, icon: BookOpen },
    ];
  }, [vaultData]);

  const exportQuestions = useMemo(() => {
    if (exportConfig.scope === 'all') return allQuestions;

    if (exportConfig.scope === 'single') {
      const target = normalizeTag(exportConfig.singleTag);
      return allQuestions.filter((q) => q.normalizedReviewTags.includes(target));
    }

    const selected = new Set(exportConfig.multiTags.map((tag) => normalizeTag(tag)));
    return allQuestions.filter((q) => q.normalizedReviewTags.some((t) => selected.has(t)));
  }, [allQuestions, exportConfig]);

  const toggleMultiTag = (tag: string) => {
    setExportConfig((prev) => {
      const exists = prev.multiTags.some((t) => normalizeTag(t) === normalizeTag(tag));
      const next = exists
        ? prev.multiTags.filter((t) => normalizeTag(t) !== normalizeTag(tag))
        : [...prev.multiTags, tag];
      return { ...prev, multiTags: next };
    });
  };

  const buildExportEntries = () => {
    const groupedByTag = uniqueTags
      .map((tag) => ({
        tag,
        questions: exportQuestions.filter((q) => q.normalizedReviewTags.includes(normalizeTag(tag))),
      }))
      .filter((x) => x.questions.length > 0);

    const entries: Array<{ id: string; type: 'microTopicHeading' | 'highlight'; text: string; color?: string; sourceLabel?: string }> = [];
    const selectedHeadingIds: string[] = [];

    groupedByTag.forEach((group) => {
      const headingId = `tag-${normalizeTag(group.tag)}`;
      selectedHeadingIds.push(headingId);
      entries.push({ id: headingId, type: 'microTopicHeading', text: group.tag });

      group.questions.forEach((q, idx) => {
        const optionsText = q.options && typeof q.options === 'object'
          ? Object.entries(q.options).map(([k, v]) => `- ${String(k)}. ${String(v)}`).join('\n')
          : '';

        const qLine = exportConfig.boldQuestion
          ? `**Q${idx + 1}.** ${q.questionText || 'Question text unavailable'}`
          : `Q${idx + 1}. ${q.questionText || 'Question text unavailable'}`;

        const answerText = exportConfig.content === 'questions_answers'
          ? `

**Answer:** ${q.correctAnswer || 'ΓÇö'}
${q.explanation || 'No explanation available'}`
          : '';

        entries.push({
          id: `${headingId}-${q.id}-${idx}`,
          type: 'highlight',
          text: `${qLine}${optionsText ? `

${optionsText}` : ''}${answerText}`,
          sourceLabel: exportConfig.showMetadata
            ? `${q.subject} ΓÇó ${q.sectionGroup} ΓÇó ${q.microTopic}${q.testTitle ? ` ΓÇó ${q.testTitle}` : ''}`
            : undefined,
        });
      });
    });

    return { groupedByTag, entries, selectedHeadingIds };
  };

  const runExport = async (cols: 1 | 2) => {
    if (exportQuestions.length === 0) {
      Alert.alert('Nothing to export', 'No tagged questions match the selected scope.');
      return;
    }

    if (exportConfig.scope === 'multi' && exportConfig.multiTags.length === 0) {
      Alert.alert('Select tags', 'Pick at least one tag for multi-tag export.');
      return;
    }

    try {
      setExporting(true);
      const { groupedByTag, entries, selectedHeadingIds } = buildExportEntries();
      const html = buildNotesPdfHtml({
        title: 'Tagged Questions Export',
        subject: 'Tag Vault',
        content: `Scope: ${exportConfig.scope.toUpperCase()} ΓÇó Content: ${exportConfig.content === 'questions' ? 'Questions only' : 'Questions + Answers'} ΓÇó Total Questions: ${exportQuestions.length}`,
        entries,
        checklist: [],
        selectedHeadingIds: new Set(selectedHeadingIds),
        columns: cols,
        config: {
          fontSize: pdfFontSize,
          subheadingColor: pdfSubheadingColor,
          paperStyle: pdfPaperStyle,
          theme: pdfTheme,
          watermark: pdfWatermark,
          footerText: pdfFooterText,
          showTOC: pdfShowTOC,
          includeChecklist: false,
          spacing: pdfSpacing,
          fontFamily: pdfFontFamily,
          pageBreakBetweenHeadings: exportConfig.pagination === 'tag',
        },
      });

      if (Platform.OS === 'ios') {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { UTIType: 'com.adobe.pdf', mimeType: 'application/pdf' });
      } else {
        await Print.printAsync({ html });
      }

      if (groupedByTag.length === 0) {
        Alert.alert('No matching tags', 'No tag groups matched your export filters.');
      }
    } catch (err: any) {
      Alert.alert('Export failed', err?.message || 'Could not generate PDF right now.');
    } finally {
      setExporting(false);
    }
  };

  const addTag = async () => {
    const value = newTagText.trim();
    if (!value) return;
    setSavingTag(true);
    try {
      await addTagToReview(value);
      setNewTagText('');
      Alert.alert('Tag added', `"${value}" is now available in Review tags.`);
    } catch (err: any) {
      Alert.alert('Could not add tag', err?.message || 'Please try again.');
    } finally {
      setSavingTag(false);
    }
  };

  const renameTag = async () => {
    if (!renamingTag || !renameValue.trim()) return;
    setSavingTag(true);
    try {
      await renameTagGlobally(renamingTag, renameValue.trim());
      setRenamingTag(null);
      setRenameValue('');
      await refresh();
      Alert.alert('Updated', 'Tag renamed everywhere, including review-tagged questions.');
    } catch (err: any) {
      Alert.alert('Rename failed', err?.message || 'Please try again.');
    } finally {
      setSavingTag(false);
    }
  };

  const removeTagEverywhere = async (tag: string) => {
    Alert.alert(
      'Remove tag from Review?',
      `This will remove "${tag}" from all tagged questions and review state.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setSavingTag(true);
              await removeTagFromReview(tag);
              await refresh();
            } catch (err: any) {
              Alert.alert('Failed', err?.message || 'Please try again.');
            } finally {
              setSavingTag(false);
            }
          },
        },
      ]
    );
  };

  const renderTagFilters = (isInsideFolder = false) => (
    <View style={[styles.filterDrawer, isInsideFolder && { paddingBottom: 10, paddingTop: 10 }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagScroll}>
        {['All', ...uniqueTags].map((tag) => (
          <TouchableOpacity
            key={tag}
            onPress={() => filters.setSelectedTag(tag)}
            style={[
              styles.tagChip,
              { borderColor: isZenMode ? 'rgba(67, 52, 34, 0.2)' : 'rgba(255, 255, 255, 0.4)' },
              filters.selectedTag === tag && {
                backgroundColor: isZenMode ? '#433422' : colors.textPrimary,
                borderColor: isZenMode ? '#433422' : colors.textPrimary,
              },
            ]}
          >
            <Text
              style={[
                styles.tagChipText,
                { color: isZenMode ? '#433422' : colors.textSecondary },
                filters.selectedTag === tag && { color: isZenMode ? '#F4ECD8' : colors.surface, fontWeight: '800' },
              ]}
            >
              {tag}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (activeSubject) {
    const subjectData = vaultData.subjects.find((s) => s.name === activeSubject);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: zenBg }}>
        <View style={[styles.detailHeader, { borderBottomColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.border }]}>
          <TouchableOpacity onPress={() => setActiveSubject(null)} style={styles.backButton}>
            <ArrowLeft size={20} color={zenTextColor} />
          </TouchableOpacity>
          <Text style={[styles.detailTitle, { color: zenTextColor, flex: 1 }]}>{activeSubject}</Text>
          <TouchableOpacity onPress={toggleZenMode} style={{ padding: 4 }}>
            <Sparkles size={22} color={isZenMode ? '#433422' : colors.primary} />
          </TouchableOpacity>
        </View>
        {!isZenMode && renderTagFilters(true)}
        <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
          {subjectData &&
            Object.values(subjectData.sectionGroups).map((section) => (
              <View key={section.name} style={styles.sectionContainer}>
                <TouchableOpacity
                  onPress={() => toggleSection(section.name)}
                  style={[
                    styles.sectionHeader,
                    {
                      backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.05)' : colors.surface,
                      borderColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.primary + '40',
                      borderWidth: 1.5,
                    },
                  ]}
                >
                  <Layers size={18} color={isZenMode ? '#433422' : colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionName, { color: zenTextColor }]}>{section.name}</Text>
                    <Text style={[styles.sectionStats, { color: isZenMode ? '#43342280' : colors.textTertiary }]}>{section.totalCount} items</Text>
                  </View>
                  {expandedSections[section.name] ? (
                    <ChevronDown size={18} color={isZenMode ? '#433422' : colors.textTertiary} />
                  ) : (
                    <ChevronRight size={18} color={isZenMode ? '#433422' : colors.textTertiary} />
                  )}
                </TouchableOpacity>
                {expandedSections[section.name] && (
                  <View style={styles.microTopicContainer}>
                    {Object.values(section.microTopics).map((topic) => (
                      <View key={topic.name} style={styles.topicBlock}>
                        <TouchableOpacity onPress={() => toggleMicroTopic(`${section.name}-${topic.name}`)} style={[styles.topicAccordion, { borderBottomColor: colors.border }]}>
                          <FolderOpen size={14} color={colors.textSecondary} />
                          <Text style={[styles.topicName, { color: colors.textSecondary }]}>{topic.name}</Text>
                          <View style={[styles.countBadge, { backgroundColor: colors.surfaceStrong + '20' }]}>
                            <Text style={[styles.countText, { color: colors.textSecondary }]}>{topic.questions.length}</Text>
                          </View>
                        </TouchableOpacity>
                        {expandedMicroTopics[`${section.name}-${topic.name}`] && (
                          <View style={styles.questionsList}>
                            {topic.questions.map((q) => (
                              <RepoQuestionCard key={q.id} question={q} onUpdate={refresh} isZenMode={isZenMode} />
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: zenBg }}>
      <PageWrapper>
        {isZenMode && (
          <TouchableOpacity style={styles.floatingZenExit} onPress={() => setIsZenMode(false)} activeOpacity={0.7}>
            <Sparkles size={24} color="#433422" />
          </TouchableOpacity>
        )}

        <View
          style={[
            styles.commandBar,
            {
              backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.05)' : colors.surface,
              borderBottomWidth: isZenMode ? 0 : 1,
              borderBottomColor: colors.border,
            },
          ]}
        >
          {!isZenMode && (
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={{ padding: 8, marginLeft: -8, marginRight: 4 }}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <ChevronLeft size={28} color={colors.primary} />
            </TouchableOpacity>
          )}
          <View style={[styles.searchContainer, isZenMode && { backgroundColor: 'rgba(67, 52, 34, 0.05)' }]}>
            <Search size={18} color={isZenMode ? '#433422' : colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: zenTextColor }]}
              placeholder="Search vault..."
              placeholderTextColor={isZenMode ? '#43342260' : colors.textTertiary}
              value={filters.searchQuery}
              onChangeText={filters.setSearchQuery}
            />
          </View>
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            style={[styles.filterButton, { backgroundColor: showFilters ? colors.primary : (isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.surfaceStrong + '20') }]}
          >
            <Filter size={18} color={showFilters ? '#fff' : (isZenMode ? '#433422' : colors.textSecondary)} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setExportVisible(true)}
            style={[styles.iconBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
            testID="tag-export-button"
          >
            <Download size={16} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMenuVisible(true)} style={[styles.iconBtn, { borderColor: colors.border }]}> 
            <MoreVertical size={17} color={isZenMode ? '#433422' : colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {showFilters && renderTagFilters()}

        {loading && vaultData.totalCount === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 16, fontWeight: '600' }}>Opening Vault...</Text>
          </View>
        ) : (
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.mainScroll}>
              <View style={styles.statsRow}>
                {stats.map((stat, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.statCard,
                      {
                        backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.05)' : colors.surface,
                        borderColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : 'transparent',
                        borderWidth: isZenMode ? 1 : 0,
                      },
                    ]}
                  >
                    <stat.icon size={20} color={isZenMode ? '#433422' : colors.primary} />
                    <View>
                      <Text style={[styles.statValue, { color: zenTextColor }]}>{stat.value}</Text>
                      <Text style={[styles.statLabel, { color: isZenMode ? '#43342280' : colors.textTertiary }]}>{stat.label}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.gridHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Knowledge Vault</Text>
                <View style={styles.viewToggle}>
                  <TouchableOpacity onPress={() => setViewMode('grid')} style={styles.iconBtnSimple}>
                    <LayoutGrid size={18} color={viewMode === 'grid' ? colors.primary : colors.textTertiary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setViewMode('list')} style={styles.iconBtnSimple}>
                    <List size={18} color={viewMode === 'list' ? colors.primary : colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={viewMode === 'grid' ? styles.grid : styles.list}>
                {vaultData.subjects.filter((x) => x.totalCount > 0).length === 0 ? (
                  <View style={styles.emptyState}>
                    <Database size={48} color={colors.textTertiary} opacity={0.3} />
                    <Text style={{ color: colors.textSecondary, marginTop: 12 }}>No matching questions found.</Text>
                  </View>
                ) : (
                  vaultData.subjects
                    .filter((x) => x.totalCount > 0)
                    .map((subject) => (
                      <TouchableOpacity
                        key={subject.name}
                        onPress={() => setActiveSubject(subject.name)}
                        style={[viewMode === 'grid' ? styles.subjectCard : styles.subjectListRow, { backgroundColor: colors.surface }]}
                      >
                        <View style={[styles.subjectIcon, { backgroundColor: colors.primary + '10' }]}>
                          {React.createElement(getSubjectIcon(subject.name), { size: 20, color: colors.primary })}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.subjectName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {subject.name}
                          </Text>
                          <Text style={[styles.subjectCount, { color: colors.textTertiary }]}>{subject.totalCount} items</Text>
                        </View>
                        <ChevronRight size={16} color={colors.textTertiary} />
                      </TouchableOpacity>
                    ))
                )}
              </View>
            </ScrollView>
          </Animated.View>
        )}

        {/* Menu */}
        <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setMenuVisible(false)}>
            <View style={[styles.actionMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  setExportVisible(true);
                }}
              >
                <Settings size={16} color={colors.textPrimary} />
                <Text style={[styles.menuText, { color: colors.textPrimary }]}>Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  setManageMode('edit');
                  setManageVisible(true);
                }}
              >
                <Pencil size={16} color={colors.textPrimary} />
                <Text style={[styles.menuText, { color: colors.textPrimary }]}>Edit tags</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  setManageMode('review');
                  setManageVisible(true);
                }}
              >
                <Check size={16} color={colors.textPrimary} />
                <Text style={[styles.menuText, { color: colors.textPrimary }]}>Manage review tags</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* Manage tags modal */}
        <Modal transparent visible={manageVisible} animationType="fade" onRequestClose={() => setManageVisible(false)}>
          <View style={styles.modalBackdropStrong}>
            <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.border }]}> 
              <View style={[styles.sheetHead, { borderBottomColor: colors.border }]}> 
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}> 
                  {manageMode === 'edit' ? 'Edit Tags' : 'Manage Review Tags'}
                </Text>
                <TouchableOpacity onPress={() => setManageVisible(false)}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Done</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.addTagRow}>
                <TextInput
                  value={newTagText}
                  onChangeText={setNewTagText}
                  placeholder={manageMode === 'review' ? 'Add review tagΓÇª' : 'Add new tagΓÇª'}
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.addTagInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
                />
                <TouchableOpacity onPress={addTag} disabled={savingTag} style={[styles.addTagBtn, { backgroundColor: colors.primary }]}> 
                  <Plus size={14} color="#04223a" />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
                {uniqueTags.length === 0 ? (
                  <Text style={{ color: colors.textTertiary }}>No tags yet.</Text>
                ) : (
                  uniqueTags.map((tag) => (
                    <View key={tag} style={[styles.tagRow, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                      <Text style={[styles.tagRowText, { color: colors.textPrimary }]}>{tag}</Text>
                      <View style={styles.tagRowActions}>
                        <TouchableOpacity
                          onPress={() => {
                            setRenamingTag(tag);
                            setRenameValue(tag);
                          }}
                          style={styles.tagActionBtn}
                        >
                          <Pencil size={14} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeTagEverywhere(tag)} style={styles.tagActionBtn}>
                          <Trash2 size={14} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Rename modal */}
        <Modal transparent visible={!!renamingTag} animationType="fade" onRequestClose={() => setRenamingTag(null)}>
          <View style={styles.modalBackdropStrong}>
            <View style={[styles.renameCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.renameTitle, { color: colors.textPrimary }]}>Rename tag</Text>
              <TextInput
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder="Tag name"
                placeholderTextColor={colors.textTertiary}
                style={[styles.addTagInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
              />
              <View style={styles.renameActions}>
                <TouchableOpacity onPress={() => setRenamingTag(null)}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={renameTag} disabled={savingTag}>
                  <Text style={{ color: colors.primary, fontWeight: '900' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Export modal */}
        <Modal transparent visible={exportVisible} animationType="fade" onRequestClose={() => setExportVisible(false)}>
          <View style={styles.modalBackdropStrong}>
            <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.border }]}> 
              <View style={[styles.sheetHead, { borderBottomColor: colors.border }]}> 
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Download Tagged Questions</Text>
                <TouchableOpacity onPress={() => setExportVisible(false)}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Close</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
                <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>Export scope</Text>
                <View style={styles.rowWrap}>
                  {([
                    ['all', 'All tags'],
                    ['single', 'Single tag'],
                    ['multi', 'Multiple tags'],
                  ] as Array<[ExportScope, string]>).map(([key, label]) => (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setExportConfig((prev) => ({ ...prev, scope: key }))}
                      style={[
                        styles.choiceChip,
                        {
                          borderColor: colors.border,
                          backgroundColor: exportConfig.scope === key ? colors.primary + '22' : colors.surface,
                        },
                      ]}
                    >
                      <Text style={{ color: exportConfig.scope === key ? colors.primary : colors.textSecondary, fontWeight: '700' }}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {exportConfig.scope === 'single' && (
                  <View style={styles.rowWrap}>
                    {uniqueTags.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => setExportConfig((prev) => ({ ...prev, singleTag: tag }))}
                        style={[
                          styles.choiceChip,
                          {
                            borderColor: colors.border,
                            backgroundColor: normalizeTag(exportConfig.singleTag) === normalizeTag(tag) ? colors.primary + '22' : colors.surface,
                          },
                        ]}
                      >
                        <Text style={{ color: normalizeTag(exportConfig.singleTag) === normalizeTag(tag) ? colors.primary : colors.textSecondary }}>{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {exportConfig.scope === 'multi' && (
                  <View style={styles.rowWrap}>
                    {uniqueTags.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => toggleMultiTag(tag)}
                        style={[
                          styles.choiceChip,
                          {
                            borderColor: colors.border,
                            backgroundColor: exportConfig.multiTags.some((x) => normalizeTag(x) === normalizeTag(tag)) ? colors.primary + '22' : colors.surface,
                          },
                        ]}
                      >
                        <Text style={{ color: exportConfig.multiTags.some((x) => normalizeTag(x) === normalizeTag(tag)) ? colors.primary : colors.textSecondary }}>{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>Content options</Text>
                <View style={styles.rowWrap}>
                  <TouchableOpacity
                    onPress={() => setExportConfig((prev) => ({ ...prev, content: 'questions' }))}
                    style={[styles.choiceChip, { borderColor: colors.border, backgroundColor: exportConfig.content === 'questions' ? colors.primary + '22' : colors.surface }]}
                  >
                    <Text style={{ color: exportConfig.content === 'questions' ? colors.primary : colors.textSecondary }}>Questions only</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setExportConfig((prev) => ({ ...prev, content: 'questions_answers' }))}
                    style={[styles.choiceChip, { borderColor: colors.border, backgroundColor: exportConfig.content === 'questions_answers' ? colors.primary + '22' : colors.surface }]}
                  >
                    <Text style={{ color: exportConfig.content === 'questions_answers' ? colors.primary : colors.textSecondary }}>Questions + Answers</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>1. Font Size & Margins</Text>
                <Text style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 8 }}>Fixed: 0.5cm Side ΓÇó 1cm Top/Bottom</Text>
                <View style={styles.rowWrap}>
                  {[12, 14, 16, 18, 20].map((sz) => (
                    <TouchableOpacity
                      key={sz}
                      onPress={() => setPdfFontSize(sz)}
                      style={[styles.choiceChip, { borderColor: colors.border, backgroundColor: pdfFontSize === sz ? colors.primary : colors.surfaceStrong }]}
                    >
                      <Text style={{ color: pdfFontSize === sz ? '#fff' : colors.textPrimary, fontWeight: '700' }}>{sz}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>2. Subheading Highlight Color</Text>
                <View style={styles.rowWrap}>
                  {['#f3f4f6', '#FF6A8820', '#6A5BFF20', '#4FC3F720', '#81C78420', '#FFB74D20'].map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setPdfSubheadingColor(c)}
                      style={[styles.colorOption, { backgroundColor: c === '#f3f4f6' ? '#e5e7eb' : c, borderColor: pdfSubheadingColor === c ? colors.primary : 'transparent' }]}
                    />
                  ))}
                </View>

                <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>Formatting options</Text>
                <View style={styles.rowWrap}>
                  <TouchableOpacity
                    onPress={() => setExportConfig((prev) => ({ ...prev, showMetadata: !prev.showMetadata }))}
                    style={[styles.choiceChip, { borderColor: colors.border, backgroundColor: exportConfig.showMetadata ? colors.primary + '22' : colors.surface }]}
                  >
                    <Text style={{ color: exportConfig.showMetadata ? colors.primary : colors.textSecondary }}>Show metadata</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setExportConfig((prev) => ({ ...prev, boldQuestion: !prev.boldQuestion }))}
                    style={[styles.choiceChip, { borderColor: colors.border, backgroundColor: exportConfig.boldQuestion ? colors.primary + '22' : colors.surface }]}
                  >
                    <Text style={{ color: exportConfig.boldQuestion ? colors.primary : colors.textSecondary }}>Bold questions</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>Pagination controls</Text>
                <View style={styles.rowWrap}>
                  <TouchableOpacity
                    onPress={() => setExportConfig((prev) => ({ ...prev, pagination: 'none' }))}
                    style={[styles.choiceChip, { borderColor: colors.border, backgroundColor: exportConfig.pagination === 'none' ? colors.primary + '22' : colors.surface }]}
                  >
                    <Text style={{ color: exportConfig.pagination === 'none' ? colors.primary : colors.textSecondary }}>Continuous</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setExportConfig((prev) => ({ ...prev, pagination: 'tag' }))}
                    style={[styles.choiceChip, { borderColor: colors.border, backgroundColor: exportConfig.pagination === 'tag' ? colors.primary + '22' : colors.surface }]}
                  >
                    <Text style={{ color: exportConfig.pagination === 'tag' ? colors.primary : colors.textSecondary }}>Break by tag</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.advancedToggle, { borderTopColor: colors.border }]}
                  onPress={() => setShowAdvancedPDF(!showAdvancedPDF)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Settings size={16} color={colors.textTertiary} />
                    <Text style={[styles.advancedToggleText, { color: colors.textSecondary }]}>Advanced Configurations</Text>
                  </View>
                  {showAdvancedPDF ? <ChevronDown size={18} color={colors.textTertiary} /> : <ChevronRight size={18} color={colors.textTertiary} />}
                </TouchableOpacity>

                {showAdvancedPDF && (
                  <View style={styles.advancedArea}>
                    <View style={styles.configGroup}>
                      <Text style={[styles.configLabel, { color: colors.textTertiary }]}>Paper Style & Theme</Text>
                      <View style={styles.rowWrap}>
                        {(['plain', 'lined', 'grid', 'dots'] as Array<'plain' | 'lined' | 'grid' | 'dots'>).map((styleKey) => (
                          <TouchableOpacity key={styleKey} onPress={() => setPdfPaperStyle(styleKey)} style={[styles.configChip, pdfPaperStyle === styleKey && { backgroundColor: colors.primary }]}> 
                            <Text style={[styles.configChipText, { color: pdfPaperStyle === styleKey ? '#fff' : colors.textPrimary }]}>{styleKey.toUpperCase()}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View style={[styles.rowWrap, { marginTop: 8 }]}> 
                        {(['modern', 'sepia', 'historical'] as Array<'modern' | 'sepia' | 'historical'>).map((themeKey) => (
                          <TouchableOpacity key={themeKey} onPress={() => setPdfTheme(themeKey)} style={[styles.configChip, pdfTheme === themeKey && { backgroundColor: colors.primary }]}> 
                            <Text style={[styles.configChipText, { color: pdfTheme === themeKey ? '#fff' : colors.textPrimary }]}>{themeKey.toUpperCase()}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={styles.configGroup}>
                      <Text style={[styles.configLabel, { color: colors.textTertiary }]}>Branding & Footer</Text>
                      <TextInput
                        style={[styles.configInput, { backgroundColor: colors.surfaceStrong, color: colors.textPrimary }]}
                        placeholder="Watermark"
                        value={pdfWatermark}
                        onChangeText={setPdfWatermark}
                        placeholderTextColor={colors.textTertiary}
                      />
                      <TextInput
                        style={[styles.configInput, { backgroundColor: colors.surfaceStrong, color: colors.textPrimary, marginTop: 8 }]}
                        placeholder="Footer text"
                        value={pdfFooterText}
                        onChangeText={setPdfFooterText}
                        placeholderTextColor={colors.textTertiary}
                      />
                    </View>

                    <View style={styles.configGroup}>
                      <Text style={[styles.configLabel, { color: colors.textTertiary }]}>Structure & Font</Text>
                      <View style={styles.rowWrap}>
                        <TouchableOpacity style={[styles.toggleBtn, pdfShowTOC && { backgroundColor: colors.primary }]} onPress={() => setPdfShowTOC(!pdfShowTOC)}>
                          <Text style={[styles.toggleBtnText, { color: pdfShowTOC ? '#fff' : colors.textPrimary }]}>TOC</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.toggleBtn, pdfSpacing === 'compact' && { backgroundColor: colors.primary }]} onPress={() => setPdfSpacing(pdfSpacing === 'compact' ? 'comfortable' : 'compact')}>
                          <Text style={[styles.toggleBtnText, { color: pdfSpacing === 'compact' ? '#fff' : colors.textPrimary }]}>Compact</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.toggleBtn, pdfFontFamily === 'handwriting' && { backgroundColor: colors.primary }]} onPress={() => setPdfFontFamily(pdfFontFamily === 'handwriting' ? 'sans' : 'handwriting')}>
                          <Text style={[styles.toggleBtnText, { color: pdfFontFamily === 'handwriting' ? '#fff' : colors.textPrimary }]}>Handwriting</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}

                <View style={[styles.exportFooter, { borderTopColor: colors.border }]}> 
                  <Text style={{ color: colors.textTertiary }}>
                    {exportQuestions.length} question{exportQuestions.length === 1 ? '' : 's'} ready
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => runExport(1)} disabled={exporting} style={[styles.exportBtn, { backgroundColor: colors.primary }]}> 
                      {exporting ? <ActivityIndicator color="#04223a" /> : <Text style={{ color: '#04223a', fontWeight: '900' }}>Export 1-Col</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => runExport(2)} disabled={exporting} style={[styles.exportBtn, { backgroundColor: colors.primary }]}> 
                      {exporting ? <ActivityIndicator color="#04223a" /> : <Text style={{ color: '#04223a', fontWeight: '900' }}>Export 2-Col</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </PageWrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  commandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    margin: spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
    gap: 8,
  },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600', paddingVertical: 8 },
  filterButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconBtnSimple: { padding: 8 },
  filterDrawer: { paddingBottom: spacing.md },
  tagScroll: { paddingHorizontal: spacing.lg, gap: 8 },
  tagChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  tagChipText: { fontSize: 12, fontWeight: '700' },
  mainScroll: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: spacing.xl },
  statCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', gap: 12 },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  gridHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  sectionTitle: { fontSize: 20, fontWeight: '900' },
  viewToggle: { flexDirection: 'row', gap: 4 },
  grid: { gap: spacing.md },
  list: { gap: 10 },
  subjectCard: { padding: 18, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.4)', flexDirection: 'row', alignItems: 'center', gap: 12 },
  subjectListRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)', gap: 16 },
  subjectIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  subjectName: { fontSize: 15, fontWeight: '800' },
  subjectCount: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, gap: 16 },
  backButton: { padding: 4 },
  detailTitle: { fontSize: 18, fontWeight: '900' },
  detailScroll: { padding: spacing.lg, paddingBottom: 100 },
  sectionContainer: { marginBottom: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', gap: 16, backgroundColor: 'rgba(0, 0, 0, 0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 3 },
  sectionName: { fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
  sectionStats: { fontSize: 10, fontWeight: '600', marginTop: 2, opacity: 0.6 },
  microTopicContainer: { paddingLeft: 12, paddingRight: 4, paddingTop: spacing.sm, gap: 8 },
  topicBlock: { marginBottom: 4 },
  topicAccordion: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, gap: 12, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  topicName: { fontSize: 12, fontWeight: '800', flex: 1, textTransform: 'uppercase', letterSpacing: 0.8 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.1)' },
  countText: { fontSize: 10, fontWeight: '900' },
  questionsList: { paddingTop: spacing.md, paddingLeft: 8, gap: spacing.xs },
  emptyState: { width: '100%', padding: 60, alignItems: 'center' },
  floatingZenExit: { position: 'absolute', top: 60, right: 20, zIndex: 9999, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(67, 52, 34, 0.1)', alignItems: 'center', justifyContent: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  modalBackdropStrong: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  actionMenu: { position: 'absolute', top: 120, right: 24, borderWidth: 1, borderRadius: 14, paddingVertical: 8, minWidth: 180 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  menuText: { fontSize: 14, fontWeight: '700' },

  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, maxHeight: '90%' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  sheetTitle: { fontSize: 17, fontWeight: '900' },
  addTagRow: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  addTagInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: '600' },
  addTagBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tagRow: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tagRowText: { fontSize: 14, fontWeight: '700' },
  tagRowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagActionBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  renameCard: { marginHorizontal: 20, borderRadius: 14, borderWidth: 1, padding: 16, marginTop: '45%' },
  renameTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  renameActions: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  groupTitle: { fontSize: 15, fontWeight: '800' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  colorOption: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  advancedToggle: { borderTopWidth: 1, marginTop: 10, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  advancedToggleText: { fontSize: 13, fontWeight: '700' },
  advancedArea: { paddingTop: 8, gap: 12 },
  configGroup: { gap: 8 },
  configLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  configChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'rgba(148,163,184,0.2)' },
  configChipText: { fontSize: 11, fontWeight: '700' },
  configInput: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontWeight: '600' },
  toggleBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(148,163,184,0.2)' },
  toggleBtnText: { fontSize: 11, fontWeight: '700' },
  exportFooter: { marginTop: 8, borderTopWidth: 1, paddingTop: 14, paddingBottom: 26, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  exportBtn: { paddingHorizontal: 14, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});

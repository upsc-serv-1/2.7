import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  Save,
  Info,
  ImagePlus,
  CheckCircle2,
  MapPin,
} from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { spacing, radius } from '../../src/theme';
import { PageWrapper } from '../../src/components/PageWrapper';
import { pickAndUploadFlashcardImage } from '../../src/services/ImageUpload';
import { FlashcardSvc } from '../../src/services/FlashcardService';
import { BranchPlacement } from '../../src/services/BranchPlacement';
import { AddToFlashcardSheet } from '../../src/components/flashcards/AddToFlashcardSheet';

type DeckSelection = {
  id: string;
  name: string;
  path: string;
};

export default function NewCard() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const uid = session?.user?.id;

  const params = useLocalSearchParams<{
    subject?: string;
    section?: string;
    microtopic?: string;
    branchId?: string;
    branchName?: string;
  }>();

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [saving, setSaving] = useState(false);

  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(null);
  const [backImageUrl, setBackImageUrl] = useState<string | null>(null);

  const [destination, setDestination] = useState<DeckSelection | null>(null);
  const [destinationPicker, setDestinationPicker] = useState(false);

  const hint = useMemo(() => ({
    subject: String(params.subject || 'General'),
    section_group: String(params.section || 'General'),
    microtopic: String(params.microtopic || 'General'),
  }), [params.subject, params.section, params.microtopic]);

  const destinationLabel = destination?.path || null;

  const save = async () => {
    if (!uid) return;
    if (!front.trim() || !back.trim()) {
      return Alert.alert('Missing Fields', 'Front and Back are required.');
    }
    if (!destination) {
      return Alert.alert('Select destination', 'Please choose a deck/folder before saving this card.');
    }

    setSaving(true);
    try {
      const cardId = await FlashcardSvc.createCard(uid, {
        front_text: front.trim(),
        back_text: back.trim(),
        front_image_url: frontImageUrl ?? null,
        back_image_url: backImageUrl ?? null,
        subject: hint.subject,
        section_group: hint.section_group,
        microtopic: hint.microtopic,
        card_type: 'manual',
        source: { kind: 'manual' } as any,
      });

      await BranchPlacement.placeAt(uid, cardId, destination.id);

      Alert.alert('Success', `Card added to ${destination.path}`);
      router.back();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageWrapper>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
      >
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="btn-back-new-card">
            <ChevronLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[s.title, { color: colors.textPrimary }]}>Create Flashcard</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={s.infoBox}>
              <Info size={16} color={colors.primary} />
              <Text style={[s.infoText, { color: colors.textSecondary }]}>Create manually, then choose exactly where this card should go.</Text>
            </View>

            <Text style={[s.label, { color: colors.textTertiary }]}>DESTINATION</Text>
            <TouchableOpacity
              style={[s.destinationBtn, { borderColor: destination ? colors.primary : colors.border, backgroundColor: colors.bg }]}
              onPress={() => setDestinationPicker(true)}
              testID="btn-select-destination"
            >
              <MapPin size={16} color={destination ? colors.primary : colors.textTertiary} />
              <Text
                style={{
                  flex: 1,
                  color: destination ? colors.textPrimary : colors.textTertiary,
                  fontWeight: destination ? '800' : '600',
                }}
                numberOfLines={1}
              >
                {destinationLabel || 'Choose destination deck/folder'}
              </Text>
              {destination ? <CheckCircle2 size={18} color={colors.primary} /> : null}
            </TouchableOpacity>

            <View style={[s.divider, { backgroundColor: colors.border }]} />

            <Text style={[s.label, { color: colors.textTertiary }]}>FRONT (QUESTION)</Text>
            <TextInput
              value={front}
              onChangeText={setFront}
              placeholder="The question or prompt..."
              placeholderTextColor={colors.textTertiary + '80'}
              multiline
              textAlignVertical="top"
              style={[s.textArea, { borderColor: colors.border, backgroundColor: colors.bg, color: colors.textPrimary }]}
              testID="input-front"
            />
            {frontImageUrl ? (
              <Image source={{ uri: frontImageUrl }} style={s.previewImage} />
            ) : null}

            <Text style={[s.label, { color: colors.textTertiary, marginTop: 16 }]}>BACK (ANSWER)</Text>
            <TextInput
              value={back}
              onChangeText={setBack}
              placeholder="The answer or explanation..."
              placeholderTextColor={colors.textTertiary + '80'}
              multiline
              textAlignVertical="top"
              style={[s.textArea, { borderColor: colors.border, backgroundColor: colors.bg, color: colors.textPrimary }]}
              testID="input-back"
            />
            {backImageUrl ? (
              <Image source={{ uri: backImageUrl }} style={s.previewImage} />
            ) : null}
          </View>
        </ScrollView>

        {/* Media + Save strip sits above keyboard with KeyboardAvoidingView */}
        <View style={[s.bottomBar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}> 
          <View style={s.mediaRow}>
            <TouchableOpacity
              onPress={async () => {
                if (!uid) return;
                const url = await pickAndUploadFlashcardImage(uid);
                if (url) setFrontImageUrl(url);
              }}
              style={[s.mediaBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}
              testID="btn-media-front"
            >
              <ImagePlus size={16} color={colors.primary} />
              <Text style={[s.mediaBtnText, { color: colors.textPrimary }]}>Front image</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                if (!uid) return;
                const url = await pickAndUploadFlashcardImage(uid);
                if (url) setBackImageUrl(url);
              }}
              style={[s.mediaBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}
              testID="btn-media-back"
            >
              <ImagePlus size={16} color={colors.primary} />
              <Text style={[s.mediaBtnText, { color: colors.textPrimary }]}>Back image</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={save}
            style={[s.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.75 : 1 }]}
            disabled={saving}
            testID="btn-save-card"
          >
            {saving ? (
              <ActivityIndicator color={colors.buttonText} />
            ) : (
              <>
                <Save size={20} color={colors.buttonText} />
                <Text style={[s.saveBtnText, { color: colors.buttonText }]}>Add Card</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <AddToFlashcardSheet
        visible={destinationPicker}
        onClose={() => setDestinationPicker(false)}
        userId={uid || ''}
        cardId={null}
        hint={hint}
        manualOnly
        selectionOnly
        title="Move card to deck"
        onSelectDeck={(deck) => {
          setDestination(deck);
          Alert.alert('Destination selected', deck.path);
        }}
      />
    </PageWrapper>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  scrollContent: { padding: spacing.lg, paddingBottom: 160 },
  card: {
    padding: spacing.xl,
    borderRadius: 26,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  infoText: { fontSize: 12, flex: 1, lineHeight: 18 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  destinationBtn: {
    height: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textArea: {
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 10,
    marginTop: 10,
  },
  divider: { height: 1, marginVertical: spacing.lg, opacity: 0.5 },
  bottomBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  mediaRow: { flexDirection: 'row', gap: 10 },
  mediaBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mediaBtnText: { fontSize: 13, fontWeight: '700' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 52,
    borderRadius: 14,
  },
  saveBtnText: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
});

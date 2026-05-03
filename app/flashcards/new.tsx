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
  const [frontUploading, setFrontUploading] = useState(false);
  const [backUploading, setBackUploading] = useState(false);

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
    
    const hasFront = front.trim() || frontImageUrl;
    const hasBack = back.trim() || backImageUrl;

    if (!hasFront || !hasBack) {
      return Alert.alert('Missing Fields', 'Both front and back sides must have either text or an image.');
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="btn-back-new-card">
            <ChevronLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[s.title, { color: colors.textPrimary }]}>Add cards</Text>
          <TouchableOpacity 
            onPress={save} 
            disabled={saving}
            style={[s.headerSaveBtn, { backgroundColor: colors.primary + '20' }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <CheckCircle2 size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView 
          contentContainerStyle={s.scrollContent} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.inputContainer}>
            <Text style={[s.label, { color: colors.textTertiary }]}>Front side</Text>
            <TextInput
              value={front}
              onChangeText={setFront}
              placeholder="Enter text here"
              placeholderTextColor={colors.textTertiary + '80'}
              multiline
              textAlignVertical="top"
              style={[s.textArea, { backgroundColor: colors.surfaceStrong, color: colors.textPrimary }]}
              testID="input-front"
            />
            {frontImageUrl && <Image source={{ uri: frontImageUrl }} style={s.previewImage} />}
            
            <View style={{ height: 24 }} />

            <Text style={[s.label, { color: colors.textTertiary }]}>Back side</Text>
            <TextInput
              value={back}
              onChangeText={setBack}
              placeholder="Enter text here"
              placeholderTextColor={colors.textTertiary + '80'}
              multiline
              textAlignVertical="top"
              style={[s.textArea, { backgroundColor: colors.surfaceStrong, color: colors.textPrimary }]}
              testID="input-back"
            />
            {backImageUrl && <Image source={{ uri: backImageUrl }} style={s.previewImage} />}

            <View style={{ height: 32 }} />

            <Text style={[s.label, { color: colors.textTertiary }]}>DESTINATION</Text>
            <TouchableOpacity
              style={[s.destinationBtn, { borderColor: destination ? colors.primary : colors.border, backgroundColor: colors.surfaceStrong }]}
              onPress={() => setDestinationPicker(true)}
              testID="btn-select-destination"
            >
              <MapPin size={16} color={destination ? colors.primary : colors.textTertiary} />
              <Text
                style={{
                  flex: 1,
                  color: destination ? colors.textPrimary : colors.textTertiary,
                  fontWeight: destination ? '800' : '600',
                  fontSize: 14
                }}
                numberOfLines={1}
              >
                {destinationLabel || 'Choose deck...'}
              </Text>
              {destination ? <CheckCircle2 size={18} color={colors.primary} /> : null}
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={[s.bottomBar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}> 
          <View style={s.mediaRow}>
            <TouchableOpacity
              onPress={async () => {
                if (!uid || frontUploading) return;
                setFrontUploading(true);
                try {
                  const url = await pickAndUploadFlashcardImage(uid);
                  if (url) setFrontImageUrl(url);
                } finally { setFrontUploading(false); }
              }}
              style={[s.mediaBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}
              testID="btn-media-front"
              disabled={frontUploading}
            >
              {frontUploading ? <ActivityIndicator size="small" color={colors.primary} /> : <ImagePlus size={16} color={colors.primary} />}
              <Text style={[s.mediaBtnText, { color: colors.textPrimary }]}>{frontUploading ? 'Uploading...' : 'Front image'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                if (!uid || backUploading) return;
                setBackUploading(true);
                try {
                  const url = await pickAndUploadFlashcardImage(uid);
                  if (url) setBackImageUrl(url);
                } finally { setBackUploading(false); }
              }}
              style={[s.mediaBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}
              testID="btn-media-back"
              disabled={backUploading}
            >
              {backUploading ? <ActivityIndicator size="small" color={colors.primary} /> : <ImagePlus size={16} color={colors.primary} />}
              <Text style={[s.mediaBtnText, { color: colors.textPrimary }]}>{backUploading ? 'Uploading...' : 'Back image'}</Text>
            </TouchableOpacity>
          </View>
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
  scrollContent: { padding: spacing.lg, paddingBottom: 40 },
  inputContainer: { flex: 1 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 10, color: '#666' },
  destinationBtn: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textArea: {
    minHeight: 100,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 10,
    marginTop: 10,
  },
  headerSaveBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
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

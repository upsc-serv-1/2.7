import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../src/context/ThemeContext';
import { Layers, Plus, Settings, BarChart2, ChevronRight } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';

export default function NojiScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  // Mock data for the "100% Clone" look
  const decks = [
    { id: '1', title: 'UPSC - Modern History', due: 12, new: 5, subdecks: 3 },
    { id: '2', title: 'UPSC - Art & Culture', due: 0, new: 20, subdecks: 0 },
    { id: '3', title: 'Current Affairs - May 2024', due: 45, new: 10, subdecks: 1 },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Decks',
          headerLargeTitle: true,
          headerStyle: { backgroundColor: colors.bg },
          headerRight: () => (
            <TouchableOpacity onPress={() => {}} style={{ marginRight: 15 }}>
              <Settings size={22} color={colors.text} />
            </TouchableOpacity>
          ),
        }} 
      />

      <ScrollView style={styles.scroll}>
        <View style={styles.headerSpacer} />
        
        {decks.map((deck) => (
          <TouchableOpacity 
            key={deck.id} 
            style={[styles.deckCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {}}
          >
            <View style={styles.deckInfo}>
              <View style={styles.titleRow}>
                <Layers size={18} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.deckTitle, { color: colors.text }]}>{deck.title}</Text>
              </View>
              {deck.subdecks > 0 && (
                <Text style={[styles.subdeckText, { color: colors.textTertiary }]}>
                  {deck.subdecks} sub-folders
                </Text>
              )}
            </View>

            <View style={styles.statContainer}>
              {deck.due > 0 && (
                <View style={[styles.badge, { backgroundColor: '#FF4B4B' }]}>
                  <Text style={styles.badgeText}>{deck.due}</Text>
                </View>
              )}
              {deck.new > 0 && (
                <View style={[styles.badge, { backgroundColor: '#3B82F6' }]}>
                  <Text style={styles.badgeText}>{deck.new}</Text>
                </View>
              )}
              <ChevronRight size={18} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 16,
  },
  headerSpacer: {
    height: 10,
  },
  deckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  deckInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deckTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  subdeckText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 26,
  },
  statContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  }
});

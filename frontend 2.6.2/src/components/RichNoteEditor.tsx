import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Highlighter } from 'lucide-react-native';

const HIGHLIGHT_COLORS = ['#FFF59D', '#FFB74D', '#81C784', '#4FC3F7', '#BA68C8', '#FF6A88'];
const DEFAULT_COLOR_KEY = 'notes_editor_highlight_color';

type Props = {
  html: string;
  onChange: (html: string) => void;
  themeColors: { bg: string; surface: string; textPrimary: string; border: string; primary: string };
};

const RichNoteEditor = forwardRef((props: Props, ref) => {
  const { html, onChange, themeColors } = props;

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.bg || '#ffffff' }}>
      <RichEditor
        ref={ref as any}
        initialContentHTML={html}
        onChange={onChange}
        placeholder="Start writing..."
        style={{ minHeight: 600, backgroundColor: themeColors.bg || '#ffffff' }}
        editorStyle={{
          backgroundColor: themeColors.bg || '#ffffff',
          color: themeColors.textPrimary || '#000000',
          contentCSSText: 'font-size:16px;line-height:1.5;padding:12px;',
        }}
        scrollEnabled={false}
      />
    </View>
  );
});

export default RichNoteEditor;

const s = StyleSheet.create({
  picker: { flexDirection: 'row', gap: 8, padding: 8, borderTopWidth: 1, justifyContent: 'center' },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  hlIcon: { padding: 6, borderRadius: 6 },
});

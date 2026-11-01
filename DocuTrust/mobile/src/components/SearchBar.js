import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { radius } from '../core/theme/radius';
import { spacing } from '../core/theme/spacing';

function LensGlyph() {
  return (
    <View style={{ width: 14, height: 14, marginRight: spacing(2) }}>
      <View style={styles.lensRing} />
      <View style={styles.lensHandle} />
    </View>
  );
}

export default function SearchBar({ value, onChangeText, placeholder = 'Search the vault', onSubmit, autoFocus, style }) {
  return (
    <View style={[styles.bar, style]}>
      <LensGlyph />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.slate}
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.clear}>Clear</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderWidth: 1.5,
    borderColor: palette.line,
    borderRadius: radius.input,
    paddingHorizontal: spacing(3),
  },
  input: { flex: 1, fontSize: 15, color: palette.ink, paddingVertical: 12 },
  clear: { color: palette.amber, fontWeight: '600', fontSize: 13 },
  lensRing: { position: 'absolute', left: 0, top: 0, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: palette.slate },
  lensHandle: {
    position: 'absolute', right: 0, bottom: 1, width: 8, height: 2,
    borderRadius: 1, backgroundColor: palette.slate, transform: [{ rotate: '45deg' }],
  },
});

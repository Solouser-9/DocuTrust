import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { SERIF } from '../core/theme/typography';

// Initial-in-a-circle avatar; warm ink disc, serif letter.
export default function Avatar({ name, size = 44, tone = 'ink', style }) {
  const initial = ((name || '').trim()[0] || '?').toUpperCase();
  return (
    <View style={[styles.circle, style, { width: size, height: size, borderRadius: size / 2, backgroundColor: palette[tone] || palette.ink }]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: SERIF, fontWeight: '700', color: palette.parchment },
});

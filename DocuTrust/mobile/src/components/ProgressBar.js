import React from 'react';
import { StyleSheet, View } from 'react-native';
import { palette } from '../core/theme/palette';

export default function ProgressBar({ progress = 0, tone = 'amber', height = 6, style }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress || 0)) * 100);
  return (
    <View style={[styles.track, { height }, style]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: palette[tone] || palette.amber }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: palette.cream, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});

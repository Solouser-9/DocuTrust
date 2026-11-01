import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { palette } from '../core/theme/palette';
import { radius } from '../core/theme/radius';
import { spacing } from '../core/theme/spacing';

export default function Chip({ label, active, onPress, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
      style={[styles.chip, active && styles.active, !onPress && styles.static, style]}
    >
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.chip,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.cream,
    paddingHorizontal: spacing(3),
    paddingVertical: 7,
    marginRight: spacing(2),
  },
  active: { backgroundColor: palette.ink, borderColor: palette.ink },
  static: { opacity: 0.9 },
  text: { fontSize: 13, color: palette.slate, fontWeight: '500' },
  textActive: { color: palette.parchment, fontWeight: '600' },
});

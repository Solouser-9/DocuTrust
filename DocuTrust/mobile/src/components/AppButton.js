import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { palette } from '../core/theme/palette';
import { radius } from '../core/theme/radius';
import { spacing } from '../core/theme/spacing';

const TONES = {
  solid: { bg: palette.ink, fg: palette.parchment },
  amber: { bg: palette.amber, fg: palette.ink },
  ghost: { bg: 'transparent', fg: palette.ink, bordered: true },
  coral: { bg: palette.coral, fg: palette.ink },
};

export default function AppButton({ label, onPress, variant = 'solid', loading, disabled, small, style }) {
  const tone = TONES[variant] || TONES.solid;
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={inactive}
      style={[
        styles.base,
        small && styles.small,
        tone.bordered && styles.bordered,
        { backgroundColor: disabled ? palette.cream : tone.bg },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tone.fg} />
      ) : (
        <Text style={[styles.label, small && styles.labelSmall, { color: disabled ? palette.slate : tone.fg }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    minWidth: 80,
    flexShrink: 0,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(3),
    overflow: 'hidden',
  },
  small: { minHeight: 44, paddingHorizontal: spacing(3), paddingVertical: spacing(2), borderRadius: 10 },
  bordered: { borderWidth: 1.5, borderColor: palette.line },
  label: { fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  labelSmall: { fontSize: 13 },
});
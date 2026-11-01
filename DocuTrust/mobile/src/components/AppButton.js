import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { palette } from '../core/theme/palette';
import { radius } from '../core/theme/radius';
import { spacing } from '../core/theme/spacing';

const TONES = {
  solid: { bg: palette.ink, fg: palette.parchment },
  amber: { bg: palette.amber, fg: palette.ink },
  ghost: { bg: 'transparent', fg: palette.ink, bordered: true },
  coral: { bg: palette.coral, fg: palette.paper },
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
        tone.bordered && { borderWidth: 1.5, borderColor: palette.line },
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
    height: 48,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(5),
  },
  small: { height: 38, paddingHorizontal: spacing(3), borderRadius: 10 },
  label: { fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  labelSmall: { fontSize: 13 },
});

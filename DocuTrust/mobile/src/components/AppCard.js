import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { radius } from '../core/theme/radius';
import { shadow } from '../core/theme/shadows';
import { spacing } from '../core/theme/spacing';

export default function AppCard({ children, style, padded = true, onPress }) {
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.card, padded && styles.padded, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.paper,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    ...shadow,
  },
  padded: { padding: spacing(4) },
});

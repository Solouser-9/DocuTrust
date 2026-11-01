import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { radius } from '../core/theme/radius';
import { shadow } from '../core/theme/shadows';
import { spacing } from '../core/theme/spacing';
import { SERIF, type } from '../core/theme/typography';

// Stat tile with a big serif numeral — the vault's ledger look.
export default function StatTile({ value, label, tone = 'ink', onPress, style }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={0.9} style={[styles.tile, style]}>
      <Text style={[styles.value, { color: palette[tone] || palette.ink }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: palette.paper,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: spacing(3.5),
    paddingHorizontal: spacing(3),
    alignItems: 'flex-start',
    ...shadow,
  },
  value: { fontFamily: SERIF, fontSize: 30, fontWeight: '700', lineHeight: 36 },
  label: { ...type.micro, fontSize: 10, marginTop: spacing(1), textAlign: 'left' },
});

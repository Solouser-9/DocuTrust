import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';

// Eyebrow label + serif title + optional right-hand action link.
export default function SectionHeader({ eyebrow, title, actionLabel, onAction, style }) {
  return (
    <View style={[styles.row, style]}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        {title ? <Text style={styles.title}>{title}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing(4), marginBottom: spacing(2.5) },
  eyebrow: { ...type.micro, marginBottom: 2 },
  title: { ...type.title },
  action: { color: palette.amber, fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },
});

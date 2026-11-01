import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { type } from '../core/theme/typography';
import { spacing } from '../core/theme/spacing';

const TONES = {
  active: 'sage',
  approved: 'sage',
  valid: 'sage',
  verified: 'sage',
  expiring: 'amber',
  pending: 'amber',
  pending_review: 'amber',
  review: 'amber',
  expired: 'coral',
  rejected: 'coral',
  revoked: 'coral',
  tampered: 'coral',
  suspended: 'coral',
  exhausted: 'slate',
  archived: 'slate',
  info: 'slate',
};

// Notary-stamp status badge: rotated, dashed ring, letterspaced uppercase.
export default function StampBadge({ status, label, tone, small, style }) {
  const key = tone || TONES[status] || 'slate';
  const color = palette[key] || palette.slate;
  const text = (label || String(status || '').replace(/_/g, ' ') || '').toUpperCase();
  return (
    <View style={[styles.stamp, small && styles.small, { borderColor: color }, style]}>
      <Text style={[styles.text, small && styles.textSmall, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    transform: [{ rotate: '-2deg' }],
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 4,
    backgroundColor: palette.cream,
    paddingHorizontal: spacing(2),
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  small: { paddingHorizontal: spacing(1.5), paddingVertical: 2 },
  text: { ...type.micro, fontSize: 10, letterSpacing: 1.2, fontWeight: '700' },
  textSmall: { fontSize: 9, letterSpacing: 1 },
});

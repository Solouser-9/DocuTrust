import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { radius } from '../core/theme/radius';
import { shadow } from '../core/theme/shadows';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { formatBytes, relativeTime } from '../core/utils/formatters';
import { docTypeColor, docTypeLabel } from '../microservices/documents/model';
import StampBadge from './StampBadge';

// "File tab" row: paper card with a coloured left edge strip by doc type.
export default function FileTabCard({ doc, onPress, meta, right, style }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.9} style={[styles.card, style]}>
      <View style={[styles.strip, { backgroundColor: docTypeColor(doc.docType) }]} />
      <View style={styles.body}>
        <Text style={styles.eyebrow}>{docTypeLabel(doc.docType)}</Text>
        <Text style={styles.title} numberOfLines={1}>{doc.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta || `${relativeTime(doc.updatedAt || doc.createdAt)} · ${formatBytes(doc.fileSize)}`}
        </Text>
      </View>
      {right !== undefined ? right : <StampBadge status={doc.status} small />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    overflow: 'hidden',
    marginBottom: spacing(2.5),
    ...shadow,
  },
  strip: { width: 4, alignSelf: 'stretch' },
  body: { flex: 1, padding: spacing(3), paddingRight: spacing(2) },
  eyebrow: { ...type.micro, fontSize: 10, marginBottom: 2 },
  title: { ...type.body, fontWeight: '600', marginBottom: 2 },
  meta: { fontSize: 12, color: palette.slate },
});

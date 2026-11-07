import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { SERIF, type } from '../core/theme/typography';
import { formatDateTime } from '../core/utils/formatters';

// Vertical audit trail: 3px rail, 10px dot markers, serif dates.
export default function Timeline({ items }) {
  if (!items || !items.length) return null;
  return (
    <View>
      {items.map((item, i) => (
        <View key={`${i}-${item.date}`} style={styles.row}>
          <View style={styles.rail}>
            <View style={styles.dot} />
            {i < items.length - 1 ? <View style={styles.line} /> : null}
          </View>
          <View style={styles.content}>
            <Text style={styles.date}>{formatDateTime(item.date)}</Text>
            <Text style={styles.title}>{item.title}</Text>
            {item.detail ? <Text style={styles.detail}>{item.detail}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', minHeight: 56 },
  rail: { width: 16, alignItems: 'center' },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.amber,
    borderWidth: 2,
    borderColor: palette.cream,
    marginTop: 4,
  },
  line: { width: 3, flex: 1, backgroundColor: palette.line, borderRadius: 2, marginVertical: 2 },
  content: { flex: 1, paddingLeft: spacing(2), paddingBottom: spacing(3.5) },
  date: { fontFamily: SERIF, fontSize: 12.5, color: palette.slate, marginBottom: 2 },
  title: { ...type.body, fontWeight: '600' },
  detail: { ...type.caption, marginTop: 2 },
});

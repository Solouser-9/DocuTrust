import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';

export default function ListItem({ title, subtitle, right, onPress, danger, last, style }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={0.85} style={[styles.row, !last && styles.bordered, style]}>
      <View style={styles.content}>
        <Text style={[styles.title, danger && styles.dangerTitle]} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right !== undefined ? right : null}
      {onPress && right === undefined ? <View style={styles.chevron} /> : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(2.75),
    paddingHorizontal: spacing(4),
  },
  content: { flex: 1, flexShrink: 1, minWidth: 0, paddingRight: spacing(2) },
  bordered: { borderBottomWidth: 1, borderBottomColor: palette.line },
  title: { ...type.body, fontWeight: '500', flexShrink: 1 },
  dangerTitle: { color: palette.coral },
  subtitle: { ...type.caption, marginTop: 2 },
  chevron: {
    width: 8,
    height: 8,
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderColor: palette.slate,
    transform: [{ rotate: '45deg' }],
    marginLeft: spacing(2),
  },
});
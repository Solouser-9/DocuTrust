import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';

// Six sealed boxes rendered from a single controlled digit string.
export default function CodeBoxes({ code }) {
  return (
    <View style={styles.boxes}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[styles.box, code.length === i && styles.boxActive]}>
          <Text style={styles.digit}>{code[i] || ''}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing(2) },
  box: {
    width: 46,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: palette.amber },
  digit: { fontSize: 22, fontWeight: '700', color: palette.ink },
});

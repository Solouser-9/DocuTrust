import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { radius } from '../core/theme/radius';
import { spacing } from '../core/theme/spacing';

export default function SegmentedTabs({ options, value, onChange, style }) {
  return (
    <View style={[styles.track, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange && onChange(opt.value)}
            style={[styles.seg, active && styles.segActive]}
          >
            <Text style={[styles.text, active && styles.textActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: palette.cream,
    borderRadius: radius.input,
    padding: 3,
  },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  segActive: { backgroundColor: palette.ink },
  text: { fontSize: 13.5, fontWeight: '600', color: palette.slate },
  textActive: { color: palette.parchment },
});

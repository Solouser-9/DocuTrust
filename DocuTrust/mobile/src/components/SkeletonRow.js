import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { radius } from '../core/theme/radius';
import { spacing } from '../core/theme/spacing';

// Pulsing placeholder rows — lists never show bare spinners.
export default function SkeletonRow({ height = 68, style }) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 650, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <View style={[styles.card, { height }, style]}>
      <Animated.View style={[styles.bar, { opacity: pulse, width: '58%' }]} />
      <Animated.View style={[styles.bar, { opacity: pulse, width: '34%' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.paper,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing(3),
    marginBottom: spacing(2.5),
    justifyContent: 'center',
  },
  bar: { height: 10, borderRadius: 5, backgroundColor: palette.cream, marginBottom: 8 },
});

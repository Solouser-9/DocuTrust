import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { radius } from '../core/theme/radius';
import { shadow } from '../core/theme/shadows';
import { spacing } from '../core/theme/spacing';
import { ToastStore } from '../core/store/ToastStore';

const TONES = {
  success: { bg: palette.sage, fg: palette.paper },
  error: { bg: palette.coral, fg: palette.paper },
  info: { bg: palette.ink, fg: palette.parchment },
};

function ToastRow({ toast }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [fade]);
  const tone = TONES[toast.tone] || TONES.info;
  return (
    <Animated.View style={[styles.toast, { backgroundColor: tone.bg, opacity: fade }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{toast.message}</Text>
    </Animated.View>
  );
}

// Bottom toast host, mounted once above the tab bar.
export default function Toast() {
  const [items, setItems] = useState(ToastStore.getToasts());
  useEffect(() => ToastStore.subscribe(setItems), []);
  if (!items.length) return null;
  return (
    <View pointerEvents="none" style={styles.host}>
      {items.map((t) => <ToastRow key={t.id} toast={t} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    bottom: 84,
    left: spacing(4),
    right: spacing(4),
    alignItems: 'center',
  },
  toast: {
    borderRadius: radius.input,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    marginBottom: spacing(2),
    ...shadow,
  },
  text: { fontSize: 13.5, fontWeight: '600' },
});

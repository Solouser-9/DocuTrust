import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '../core/theme/palette';
import { type } from '../core/theme/typography';
import { spacing } from '../core/theme/spacing';
import SkeletonRow from './SkeletonRow';

const Chevron = () => (
  <View
    style={{
      width: 9,
      height: 9,
      borderLeftWidth: 2,
      borderBottomWidth: 2,
      borderColor: palette.ink,
      transform: [{ rotate: '45deg' }],
    }}
  />
);

// Common chrome for every screen: parchment canvas, serif header, safe area,
// keyboard-safe scroll body with optional pull-to-refresh and skeleton loading.
export default function Screen({
  title,
  eyebrow,
  onBack,
  headerRight,
  children,
  scroll = true,
  loading = false,
  refreshing,
  onRefresh,
  footer,
  padded = true,
}) {
  const insets = useSafeAreaInsets();
  const refreshControl = onRefresh
    ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={palette.slate} colors={[palette.amber]} />
    : undefined;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          {onBack ? (
            <TouchableOpacity style={styles.back} onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Chevron />
            </TouchableOpacity>
          ) : (
            <View style={styles.back} />
          )}
          <View style={styles.heading}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            {title ? <Text style={styles.title}>{title}</Text> : null}
          </View>
          {headerRight}
        </View>

        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.body, !padded && { paddingHorizontal: 0 }]}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
          >
            {loading ? [0, 1, 2, 3].map((i) => <SkeletonRow key={i} />) : children}
          </ScrollView>
        ) : (
          <View style={[styles.body, styles.flexBody, !padded && { paddingHorizontal: 0 }]}>
            {loading ? [0, 1, 2].map((i) => <SkeletonRow key={i} />) : children}
          </View>
        )}
        {footer}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.parchment },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
    paddingBottom: spacing(3),
    minHeight: 64,
  },
  back: { width: 40, alignItems: 'flex-start', justifyContent: 'center' },
  heading: { flex: 1 },
  eyebrow: { ...type.micro, marginBottom: 2 },
  title: { ...type.title },
  body: { paddingHorizontal: spacing(4), paddingBottom: spacing(12) },
  flexBody: { flex: 1 },
});

import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { SERIF, type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { OnboardingPresenter } from '../microservices/auth/presenters';
import AppButton from '../components/AppButton';

const { width } = Dimensions.get('window');

// Three swipeable pull-quotes about document safety, with ink-dot pagination.
export default function OnboardingScreen({ navigation }) {
  const presenter = usePresenter(() => new OnboardingPresenter(navigation))[1];
  const pages = presenter.pages();
  const [index, setIndex] = useState(0);
  const listRef = useRef(null);

  const onScroll = (event) => {
    const next = Math.min(pages.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / width)));
    setIndex(next);
  };

  const advance = () => {
    if (index >= pages.length - 1) {
      presenter.complete();
      return;
    }
    if (listRef.current) listRef.current.scrollToIndex({ index: index + 1, animated: true });
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.skipRow}>
        <TouchableOpacity onPress={() => presenter.complete()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item }) => (
          <View style={styles.page}>
            <Text style={styles.eyebrow}>{item.eyebrow}</Text>
            <View style={styles.rule} />
            <Text style={styles.quote}>{item.quote}</Text>
            <Text style={styles.detail}>{item.detail}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {pages.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <AppButton label={index >= pages.length - 1 ? 'Enter the vault' : 'Continue'} variant="amber" onPress={advance} style={styles.cta} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.parchment },
  skipRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing(4), paddingTop: spacing(2) },
  skip: { color: palette.slate, fontSize: 14, fontWeight: '600' },
  page: { width, paddingHorizontal: spacing(7), alignItems: 'flex-start', justifyContent: 'center', flex: 1 },
  eyebrow: { ...type.micro },
  rule: { width: 34, height: 3, backgroundColor: palette.amber, borderRadius: 2, marginTop: spacing(3), marginBottom: spacing(4) },
  quote: { fontFamily: SERIF, fontSize: 26, lineHeight: 36, fontWeight: '700', color: palette.ink },
  detail: { ...type.caption, marginTop: spacing(4) },
  footer: { paddingHorizontal: spacing(5), paddingBottom: spacing(6) },
  dots: { flexDirection: 'row', marginBottom: spacing(4), paddingHorizontal: spacing(2) },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.line, marginRight: spacing(1.5) },
  dotActive: { backgroundColor: palette.amber, width: 18 },
  cta: { width: '100%' },
});

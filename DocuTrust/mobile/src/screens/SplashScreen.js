import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { SERIF, type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { SplashPresenter } from '../microservices/auth/presenters';

function SealMark() {
  return (
    <View style={styles.seal}>
      <View style={styles.sealRing}>
        <View style={styles.sealDial} />
      </View>
    </View>
  );
}

// Gating splash: decides between the vault and onboarding once hydration lands.
export default function SplashScreen({ navigation }) {
  const [, presenter] = usePresenter(() => new SplashPresenter(navigation));

  useEffect(() => {
    presenter.bootstrap();
  }, [presenter]);

  return (
    <View style={styles.root}>
      <SealMark />
      <Text style={styles.wordmark}>DocuTrust</Text>
      <View style={styles.rule} />
      <Text style={styles.tagline}>Sealed records. Verified proof.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.parchment, alignItems: 'center', justifyContent: 'center' },
  seal: { marginBottom: spacing(6) },
  sealRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    borderColor: palette.amber,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-2deg' }],
  },
  sealDial: { width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, borderColor: palette.ink },
  wordmark: { fontFamily: SERIF, fontSize: 30, fontWeight: '700', color: palette.ink, letterSpacing: 0.5 },
  rule: { width: 42, height: 3, backgroundColor: palette.amber, marginTop: spacing(3), borderRadius: 2 },
  tagline: { ...type.caption, marginTop: spacing(3), letterSpacing: 0.4 },
});

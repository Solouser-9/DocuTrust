import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { mono, type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { PublicVerifyResultPresenter } from '../microservices/verification/presenters';
import { PROOF_NOTE, RESULT_TONES, RESULT_TITLES } from '../microservices/verification/model';
import { formatDate } from '../core/utils/formatters';
import { docTypeLabel } from '../microservices/documents/model';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import ListItem from '../components/ListItem';

// The verdict card: giant rotated stamp, then the proof summary.
export default function PublicVerifyResultScreen({ navigation, route }) {
  const [state, presenter] = usePresenter(() => new PublicVerifyResultPresenter(navigation));

  useEffect(() => {
    presenter.configure((route && route.params) || {});
  }, [presenter, route]);

  const result = state.data && state.data.result;
  const proof = result ? result.proof : null;
  const tone = result ? RESULT_TONES[result.status] || 'slate' : 'slate';
  const title = result ? RESULT_TITLES[result.status] || result.status : '…';
  const colors = { sage: palette.sage, coral: palette.coral, slate: palette.slate };

  return (
    <Screen
      title="Verification result"
      eyebrow="Sealed proof"
      onBack={navigation.canGoBack && navigation.canGoBack() ? () => navigation.goBack() : undefined}
    >
      {state.status === 'loading' ? null : (
        <View>
          <View style={styles.verdictWrap}>
            <View style={[styles.verdict, { borderColor: colors[tone] }]}>
              <Text style={[styles.verdictText, { color: colors[tone] }]}>{title}</Text>
            </View>
          </View>

          {result && result.note ? <Text style={styles.note}>{result.note}</Text> : null}

          {proof ? (
            <AppCard style={{ marginTop: spacing(3), padding: 0 }}>
              <ListItem title="Document" value right={<Text style={styles.strong}>{proof.documentTitle || '—'}</Text>} />
              <ListItem title="Type" value right={<Text style={type.caption}>{docTypeLabel(proof.docType)}</Text>} />
              <ListItem title="Owner" value right={<Text style={type.caption}>{proof.ownerName || '—'}</Text>} />
              <ListItem title="Issued" value right={<Text style={type.caption}>{formatDate(proof.issuedAt)}</Text>} />
              <ListItem title="Verified" value right={<Text style={type.caption}>{formatDate(proof.verifiedAt)}</Text>} last />
            </AppCard>
          ) : null}

          {proof && proof.sha256 ? (
            <AppCard style={{ marginTop: spacing(3) }}>
              <Text style={styles.eyebrow}>SHA-256 fingerprint</Text>
              <Text style={styles.hash}>{proof.sha256}</Text>
              <AppButton label="Copy fingerprint" variant="ghost" small onPress={() => presenter.copyHash(proof.sha256)} style={{ alignSelf: 'flex-start' }} />
            </AppCard>
          ) : null}

          <Text style={[type.caption, { marginTop: spacing(4), textAlign: 'center' }]}>{PROOF_NOTE}</Text>

          <AppButton
            label="Check another token"
            variant="ghost"
            onPress={() => {
              if (navigation.canGoBack && navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('PublicVerify');
            }}
            style={{ marginTop: spacing(3) }}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  verdictWrap: { flexDirection: 'row', justifyContent: 'center', marginVertical: spacing(5) },
  verdict: {
    transform: [{ rotate: '-2deg' }],
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: palette.cream,
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(3),
  },
  verdictText: { fontFamily: 'Georgia', fontSize: 30, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  note: { ...type.caption, textAlign: 'center', marginTop: spacing(2) },
  eyebrow: { ...type.micro, marginBottom: spacing(2) },
  hash: { ...mono, fontSize: 11 },
  strong: { fontSize: 13.5, fontWeight: '600', color: palette.ink, maxWidth: 180, textAlign: 'right' },
});

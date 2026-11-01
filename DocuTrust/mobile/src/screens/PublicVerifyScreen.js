import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { mono, type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { PublicVerifyPresenter } from '../microservices/verification/presenters';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import AppCard from '../components/AppCard';
import EmptyState from '../components/EmptyState';

// Public screen: paste a token, or arrive here from a docutrust://verify deep link.
export default function PublicVerifyScreen({ navigation, route }) {
  const [state, presenter] = usePresenter(() => new PublicVerifyPresenter(navigation));
  const deepLinkToken = (route && route.params && route.params.token) || '';
  const value = (state.data && state.data.token) || deepLinkToken;

  useEffect(() => {
    if (deepLinkToken) {
      presenter.check(deepLinkToken);
    } else {
      presenter.setState({ data: { token: '' } });
    }
  }, [presenter, deepLinkToken]);

  const change = (t) => presenter.setState({ data: { token: t }, fieldErrors: {} });

  return (
    <Screen
      title="Verify a document"
      eyebrow="Public proof service"
      onBack={navigation.canGoBack && navigation.canGoBack() ? () => navigation.goBack() : undefined}
    >
      {state.status === 'loading' ? (
        <EmptyState variant="check" title="Checking the seal…" message="Comparing fingerprints. This takes a second." />
      ) : (
        <View>
          <Text style={styles.body}>
            Paste the verification token from a DocuTrust proof link. You will see whether the document is authentic — the file itself never leaves the vault.
          </Text>
          <AppCard>
            <AppInput
              label="Verification token"
              value={value}
              onChangeText={change}
              error={(state.fieldErrors && state.fieldErrors.token) || null}
              placeholder="e.g. 9f2c…43-character token"
              hint="Or open the docutrust://verify/<token> link directly."
            />
            <AppButton label="Verify" variant="amber" onPress={() => presenter.check(value)} style={{ marginTop: spacing(1) }} />
          </AppCard>
          {state.status === 'error' ? <Text style={styles.error}>{state.error}</Text> : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...type.body, lineHeight: 24, marginBottom: spacing(4) },
  error: { color: palette.coral, fontSize: 13, marginTop: spacing(2) },
});

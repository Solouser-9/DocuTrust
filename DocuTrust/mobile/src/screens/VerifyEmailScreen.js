import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { VerifyEmailPresenter } from '../microservices/auth/presenters';
import AppButton from '../components/AppButton';
import Screen from '../components/Screen';
import StampBadge from '../components/StampBadge';
import EmptyState from '../components/EmptyState';

// Verification landing. The token arrives from the register flow or a mail link.
export default function VerifyEmailScreen({ navigation, route }) {
  const [state, presenter] = usePresenter(() => new VerifyEmailPresenter(navigation));
  const token = (route && route.params && route.params.token) || null;
  const verified = state.status === 'success' && state.data && state.data.verified;

  useEffect(() => {
    presenter.check(token);
  }, [presenter, token]);

  const continue_ = () => {
    if (navigation.replace) navigation.replace('Login');
    else navigation.goBack();
  };

  return (
    <Screen title="Verify your email" eyebrow="One last formality" onBack={() => navigation.goBack()}>
      <View style={styles.stampWrap}>
        {verified ? (
          <StampBadge status="approved" label="Verified" style={{ transform: [{ rotate: '-2deg' }] }} />
        ) : (
          <StampBadge status="pending" label="Awaiting verification" />
        )}
      </View>

      {state.status === 'loading' ? null : verified ? (
        <View>
          <Text style={styles.body}>
            Your email is confirmed. Shares, verification links and notifications are now fully unlocked.
          </Text>
          <AppButton label="Continue" variant="amber" onPress={continue_} style={{ marginTop: spacing(4) }} />
        </View>
      ) : state.status === 'error' ? (
        <EmptyState
          variant="vault"
          title="That link did not work"
          message={state.error}
          actionLabel="Back to sign in"
          onAction={continue_}
        />
      ) : (
        <View>
          <Text style={styles.body}>
            We sent a verification link to your inbox. Tap it there, or ask the person who invited you to resend it.
          </Text>
          <AppButton label="Continue to sign in" variant="ghost" onPress={continue_} style={{ marginTop: spacing(4) }} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stampWrap: { flexDirection: 'row', justifyContent: 'center', marginVertical: spacing(5) },
  body: { ...type.body, color: palette.ink, lineHeight: 24 },
});

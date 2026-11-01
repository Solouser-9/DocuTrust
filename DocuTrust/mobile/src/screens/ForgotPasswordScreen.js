import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { ForgotPasswordPresenter } from '../microservices/auth/presenters';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import Screen from '../components/Screen';

export default function ForgotPasswordScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new ForgotPasswordPresenter(navigation));
  const [email, setEmail] = useState('');
  const sent = state.status === 'success' && state.data && state.data.sent;

  const submit = () => {
    presenter.form = {};
    presenter.submit(email);
  };

  return (
    <Screen title="Reset your password" eyebrow="Recovering access" onBack={() => navigation.goBack()}>
      {sent ? (
        <View>
          <Text style={styles.body}>
            If an account exists for <Text style={styles.strong}>{state.data.email}</Text>, a single-use 6-digit reset code is on its way.
            The code expires in 10 minutes and is only ever sent to your inbox.
          </Text>
          <AppButton label="Enter reset code" variant="amber" onPress={() => navigation.navigate('ResetPassword', { email: state.data.email })} style={{ marginTop: spacing(4) }} />
          <AppButton label="Back to sign in" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: spacing(2.5) }} />
        </View>
      ) : (
        <View>
          <Text style={styles.body}>
            Enter the email on your account. We never reveal whether an address is registered — the reply looks the same either way.
          </Text>
          <View style={{ marginTop: spacing(4) }}>
            <AppInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              error={(state.fieldErrors && state.fieldErrors.email) || null}
              placeholder="you@example.com"
            />
          </View>
          {state.status === 'error' ? <Text style={styles.error}>{state.error}</Text> : null}
          <AppButton label="Send reset code" variant="amber" loading={state.status === 'loading'} onPress={submit} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...type.body, lineHeight: 24, marginBottom: spacing(2) },
  strong: { fontWeight: '700', color: palette.ink },
  error: { color: palette.coral, fontSize: 13, marginBottom: spacing(2) },
});

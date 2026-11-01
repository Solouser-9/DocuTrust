import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { MfaPresenter } from '../microservices/auth/presenters';
import AppButton from '../components/AppButton';
import Screen from '../components/Screen';
import CodeBoxes from '../components/CodeBoxes';

// MFA challenge during login: six boxes over one hidden numeric field.
export default function MfaScreen({ navigation, route }) {
  const [state, presenter] = usePresenter(() => new MfaPresenter(navigation));
  const hiddenRef = useRef(null);
  const code = (state.data && state.data.code) || '';
  const pendingEmail = (route && route.params && route.params.email) || '';
  const mode = (state.data && state.data.mode) || 'totp';

  useEffect(() => {
    const params = (route && route.params) || {};
    presenter.configure(params.email || '', params.password || '');
  }, [presenter, route]);

  const submit = () => presenter.submit();

  return (
    <Screen
      title={mode === 'email' ? 'Email code' : 'Authenticator code'}
      eyebrow="Two-factor check"
      onBack={() => navigation.goBack()}
    >
      <Text style={styles.body}>
        {mode === 'email'
          ? `We emailed a 6-digit code to ${pendingEmail || 'your address'}. Enter it to finish signing in.`
          : pendingEmail
            ? `Enter the six-digit code for ${pendingEmail}.`
            : 'Enter the six-digit code from your authenticator app.'}
      </Text>

      <CodeBoxes code={code} />
      <TextInput
        ref={hiddenRef}
        style={styles.hidden}
        value={code}
        onChangeText={(v) => presenter.setCode(v)}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        onSubmitEditing={submit}
      />

      {state.fieldErrors.code ? <Text style={styles.error}>{state.fieldErrors.code}</Text> : null}
      {state.status === 'error' ? <Text style={styles.error}>{state.error}</Text> : null}

      <AppButton
        label="Verify and continue"
        variant="amber"
        loading={state.status === 'loading'}
        onPress={submit}
        disabled={code.length !== 6}
      />
      {mode === 'totp' ? (
        <AppButton
          label="Email me a code instead"
          variant="ghost"
          loading={state.status === 'loading'}
          onPress={() => presenter.sendEmailCode()}
          style={{ marginTop: spacing(2.5) }}
        />
      ) : null}
      <Text style={[type.caption, { marginTop: spacing(3) }]}>
        {mode === 'email'
          ? 'The emailed code expires in 10 minutes and works once. Request a fresh one if it expired.'
          : 'Codes rotate every 30 seconds. Wait for the next one if yours was just rejected.'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...type.body, lineHeight: 24, marginBottom: spacing(4) },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  error: { color: palette.coral, fontSize: 13, marginBottom: spacing(2) },
});

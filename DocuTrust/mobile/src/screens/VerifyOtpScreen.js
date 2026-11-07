import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { VerifyOtpPresenter } from '../microservices/auth/presenters';
import AppButton from '../components/AppButton';
import CodeBoxes from '../components/CodeBoxes';
import Screen from '../components/Screen';

export default function VerifyOtpScreen({ navigation, route }) {
  const [state, presenter] = usePresenter(() => new VerifyOtpPresenter(navigation));
  const email = (route && route.params && route.params.email) || '';
  const code = (state.data && state.data.code) || '';

  useEffect(() => {
    presenter.configure(email);
  }, [email, presenter]);

  const submit = () => presenter.submit();

  return (
    <Screen title="Verify your email" eyebrow="Single-use code" onBack={() => navigation.goBack()}>
      <Text style={styles.body}>
        Enter the 6-digit code we sent to {email || 'your email address'}. It expires in 10 minutes.
      </Text>
      <CodeBoxes
        code={code}
        onChangeText={(value) => presenter.setCode(value)}
        onSubmitEditing={submit}
        accessibilityLabel="6-digit verification code"
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...type.body, lineHeight: 24, marginBottom: spacing(4) },
  error: { color: palette.coralText, fontSize: 13, marginBottom: spacing(2) },
});

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { ResetPasswordPresenter } from '../microservices/auth/presenters';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import Screen from '../components/Screen';
import StampBadge from '../components/StampBadge';

// OTP reset: the 6-digit code arrives by email; it is never part of any API response.
export default function ResetPasswordScreen({ navigation, route }) {
  const [state, presenter] = usePresenter(() => new ResetPasswordPresenter(navigation));
  const [form, setForm] = useState({ email: '', code: '', newPassword: '', confirmPassword: '' });
  const done = state.status === 'success' && state.data && state.data.reset;

  useEffect(() => {
    const email = route && route.params && route.params.email;
    if (email) {
      presenter.configure(email);
      setForm((f) => ({ ...f, email }));
    }
  }, [presenter, route]);

  const change = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    presenter.setField(key, value);
  };

  const submit = () => {
    presenter.form = { ...form };
    presenter.submit();
  };

  return (
    <Screen title="Choose a new password" eyebrow="Single-use code" onBack={() => navigation.goBack()}>
      {done ? (
        <View>
          <View style={styles.stampRow}>
            <StampBadge status="approved" label="Password reset" />
          </View>
          <Text style={styles.body}>Your old password no longer works. Sign in with the new one.</Text>
          <AppButton
            label="Go to sign in"
            variant="amber"
            onPress={() => {
              if (navigation.replace) navigation.replace('Login');
              else navigation.goBack();
            }}
          />
        </View>
      ) : (
        <View>
          <Text style={styles.body}>Paste the 6-digit code from your email, then choose a fresh password. The code expires in 10 minutes.</Text>
          <AppInput label="Account email" value={form.email} onChangeText={change('email')} keyboardType="email-address" error={state.fieldErrors.email} placeholder="you@example.com" autoCapitalize="none" />
          <AppInput label="Reset code" value={form.code} onChangeText={(v) => change('code')(v.replace(/\D/g, '').slice(0, 6))} error={state.fieldErrors.code} placeholder="000000" keyboardType="number-pad" />
          <AppInput label="New password" value={form.newPassword} onChangeText={change('newPassword')} secure error={state.fieldErrors.newPassword} hint="At least 8 characters with letters and numbers." />
          <AppInput label="Repeat new password" value={form.confirmPassword} onChangeText={change('confirmPassword')} secure error={state.fieldErrors.confirmPassword} />
          {state.status === 'error' ? <Text style={styles.error}>{state.error}</Text> : null}
          <AppButton label="Reset password" variant="amber" loading={state.status === 'loading'} onPress={submit} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...type.body, lineHeight: 24, marginBottom: spacing(4) },
  stampRow: { marginBottom: spacing(4) },
  error: { color: palette.coral, fontSize: 13, marginBottom: spacing(2) },
});

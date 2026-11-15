import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { AcceptInvitePresenter } from '../microservices/auth/presenters';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import Screen from '../components/Screen';
import StampBadge from '../components/StampBadge';
import CodeBoxes from '../components/CodeBoxes';

export default function AcceptInviteScreen({ navigation, route }) {
  const [state, presenter] = usePresenter(() => new AcceptInvitePresenter(navigation));
  const [form, setForm] = useState({ email: '', fullName: '', code: '', newPassword: '', confirmPassword: '' });
  const done = state.status === 'success' && state.data && state.data.accepted;

  useEffect(() => {
    const email = route && route.params && route.params.email;
    if (email) {
      presenter.configure(email);
      setForm((prevForm) => ({ ...prevForm, email }));
    }
  }, [presenter, route]);

  const change = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    presenter.setField(key, value);
  };

  const submit = () => {
    if (state.status === 'loading') return;
    presenter.form = { ...form };
    presenter.submit();
  };

  return (
      <Screen title="Activate your invite" eyebrow="Team invitation" onBack={() => navigation.goBack()}>
        {done ? (
            <View>
              <View style={styles.stampRow}>
                <StampBadge status="approved" label="Invite accepted" />
              </View>
              <Text style={styles.body}>Your account is active — welcome to the team.</Text>
            </View>
        ) : (
            <View>
              <Text style={styles.body}>Your organisation invited this email address. Enter the 6-digit code from the invite email, then choose the password you will sign in with. The code expires in 24 hours.</Text>
              <AppInput label="Account email" value={form.email} onChangeText={change('email')} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" error={state.fieldErrors.email} />

              <AppInput label="Full name (optional)" value={form.fullName} onChangeText={change('fullName')} error={state.fieldErrors.fullName} placeholder="How your name appears in the team directory" />

              <Text style={styles.label}>Invite code</Text>
              <CodeBoxes
                  code={form.code}
                  onChangeText={(v) => change('code')(v.replace(/\D/g, '').slice(0, 6))}
                  onSubmitEditing={submit}
                  accessibilityLabel="6-digit invite code"
              />
              {state.fieldErrors.code ? <Text style={styles.error}>{state.fieldErrors.code}</Text> : null}

              <AppInput label="Choose a password" value={form.newPassword} onChangeText={change('newPassword')} secure error={state.fieldErrors.newPassword} hint="At least 8 characters with letters and numbers." />
              <AppInput label="Repeat password" value={form.confirmPassword} onChangeText={change('confirmPassword')} secure error={state.fieldErrors.confirmPassword} />

              {state.status === 'error' ? <Text style={styles.error}>{state.error}</Text> : null}

              <AppButton label="Activate account" variant="amber" loading={state.status === 'loading'} onPress={submit} />

              <Text style={styles.hint}>Code valid for 24 hours. Expired? Ask your manager to send the invite again.</Text>
            </View>
        )}
      </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...type.body, lineHeight: 24, marginBottom: spacing(4) },
  stampRow: { marginBottom: spacing(4) },
  label: { ...type.micro, marginBottom: spacing(2) },
  error: { color: palette.coralText, fontSize: 13, marginBottom: spacing(2) },
  hint: { ...type.caption, color: palette.slate, textAlign: 'center', marginTop: spacing(4) },
});

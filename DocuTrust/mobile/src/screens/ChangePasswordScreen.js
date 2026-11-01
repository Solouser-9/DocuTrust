import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { ChangePasswordPresenter } from '../microservices/auth/presenters';
import { passwordScore } from '../core/utils/validators';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import ProgressBar from '../components/ProgressBar';

const SCORE_LABELS = ['Too weak', 'Weak', 'Fair', 'Strong', 'Vault-grade'];

export default function ChangePasswordScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new ChangePasswordPresenter(navigation));
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [otp, setOtp] = useState('');
  const stepUpRequired = !!(state.data && state.data.stepUpRequired);

  const change = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    presenter.setField(key, value);
  };

  const score = passwordScore(form.newPassword);

  const submit = () => {
    presenter.form = { ...form };
    presenter.submit();
  };

  return (
    <Screen title="Change password" eyebrow="Rotate your key" onBack={() => navigation.goBack()}>
      {stepUpRequired ? (
        <View>
          <Text style={styles.body}>
            For safety, confirm this change with the 6-digit code we just emailed you. It expires in 10 minutes.
          </Text>
          <AppInput label="Email code" value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" error={(state.fieldErrors && state.fieldErrors.code) || null} placeholder="000000" />
          {state.status === 'error' ? <Text style={styles.error}>{state.error}</Text> : null}
          <AppButton label="Confirm and update" variant="amber" loading={state.status === 'loading'} onPress={() => presenter.confirmStepUp(otp)} />
        </View>
      ) : (
        <View>
          <AppInput label="Current password" value={form.currentPassword} onChangeText={change('currentPassword')} secure error={state.fieldErrors.currentPassword} />
          <AppInput label="New password" value={form.newPassword} onChangeText={change('newPassword')} secure error={state.fieldErrors.newPassword} hint="At least 8 characters with letters and numbers." />

          <View style={styles.meterRow}>
            <ProgressBar progress={score / 4} tone={score >= 3 ? 'sage' : score === 2 ? 'amber' : 'coral'} style={{ flex: 1 }} />
            <Text style={styles.meterLabel}>{SCORE_LABELS[score]}</Text>
          </View>

          <AppInput label="Repeat new password" value={form.confirmPassword} onChangeText={change('confirmPassword')} secure error={state.fieldErrors.confirmPassword} />

          {state.status === 'error' ? <Text style={styles.error}>{state.error}</Text> : null}
          <AppButton label="Update password" variant="amber" loading={state.status === 'loading'} onPress={submit} />
        </View>
      )}
      <Text style={[type.caption, { marginTop: spacing(3) }]}>
        Password changes are protected by step-up verification: a fresh email code is required on top of your session.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...type.body, lineHeight: 24, marginBottom: spacing(4) },
  meterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing(4) },
  meterLabel: { ...type.micro, marginLeft: spacing(3), width: 92, textAlign: 'right' },
  error: { color: palette.coral, fontSize: 13, marginBottom: spacing(2) },
});

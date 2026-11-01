import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { RegisterPresenter } from '../microservices/auth/presenters';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import Screen from '../components/Screen';
import SegmentedTabs from '../components/SegmentedTabs';

const TABS = [
  { value: 'personal', label: 'Personal' },
  { value: 'org', label: 'Organisation' },
];

export default function RegisterScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new RegisterPresenter(navigation));
  const [form, setForm] = useState({ accountType: 'personal', fullName: '', email: '', phone: '', password: '', orgName: '' });
  const accountType = (state.data && state.data.accountType) || form.accountType;

  const change = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    presenter.setField(key, value);
  };

  const setAccountType = (value) => {
    setForm((f) => ({ ...f, accountType: value }));
    presenter.setAccountType(value);
  };

  const submit = () => {
    presenter.form = { ...form };
    presenter.submit();
  };

  return (
    <Screen title="Create your account" eyebrow="DocuTrust" onBack={() => navigation.goBack()}>
      <Text style={styles.lede}>
        A private vault for the documents you cannot afford to lose — passports, deeds, certificates.
      </Text>

      <SegmentedTabs options={TABS} value={accountType} onChange={setAccountType} style={{ marginBottom: spacing(4) }} />

      <AppInput label="Full name" value={form.fullName} onChangeText={change('fullName')} error={state.fieldErrors.fullName} placeholder="Amelia Vance" />
      <AppInput label="Email" value={form.email} onChangeText={change('email')} keyboardType="email-address" error={state.fieldErrors.email} placeholder="you@example.com" />
      <AppInput label="Phone (optional)" value={form.phone} onChangeText={change('phone')} keyboardType="phone-pad" error={state.fieldErrors.phone} placeholder="+1 555 0100" />
      {accountType === 'org' ? (
        <AppInput label="Organisation name" value={form.orgName} onChangeText={change('orgName')} error={state.fieldErrors.orgName} placeholder="Vance & Co." hint="You become the custodian of this organisation." />
      ) : null}
      <AppInput
        label="Password"
        value={form.password}
        onChangeText={change('password')}
        secure
        error={state.fieldErrors.password}
        hint="At least 8 characters with letters and numbers."
      />

      {state.status === 'error' ? <Text style={styles.apiError}>{state.error}</Text> : null}

      <AppButton label="Create account" variant="amber" loading={state.status === 'loading'} onPress={submit} style={{ marginTop: spacing(1) }} />
      <Text style={[type.caption, { marginTop: spacing(3) }]}>
        We email a verification link. Your vault is ready either way — verification unlocks shares.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { ...type.caption, marginBottom: spacing(4) },
  apiError: { color: palette.coral, fontSize: 13, marginBottom: spacing(2), textAlign: 'center' },
});

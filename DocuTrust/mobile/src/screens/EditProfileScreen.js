import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { EditProfilePresenter } from '../microservices/profile/presenters';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';

export default function EditProfileScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new EditProfilePresenter(navigation));
  const form = (state.data && state.data.form) || presenter.form;
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!hydrated && form.fullName) {
      setHydrated(true);
      setLocal({ fullName: form.fullName, phone: form.phone || '' });
    }
  }, [form, hydrated]);

  const [local, setLocal] = useState({ fullName: '', phone: '' });

  const change = (key) => (value) => {
    setLocal((f) => ({ ...f, [key]: value }));
    presenter.setField(key, value);
  };

  const submit = () => {
    presenter.form = { ...local };
    presenter.submit();
  };

  return (
    <Screen title="Edit profile" eyebrow="Named on every seal" onBack={() => navigation.goBack()}>
      <AppInput label="Full name" value={local.fullName} onChangeText={change('fullName')} error={state.fieldErrors.fullName} placeholder="Amelia Vance" />
      <AppInput label="Phone (optional)" value={local.phone} onChangeText={change('phone')} keyboardType="phone-pad" error={state.fieldErrors.phone} placeholder="+1 555 0100" />
      <AppButton label="Save profile" variant="amber" loading={state.status === 'loading'} onPress={submit} />
      <Text style={[type.caption, { marginTop: spacing(3) }]}>Your email is your identity in the vault and cannot be changed here.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { marginTop: spacing(2) },
});

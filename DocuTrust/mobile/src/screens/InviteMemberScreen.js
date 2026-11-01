import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { InviteMemberPresenter } from '../microservices/org/presenters';
import { INVITE_ROLES } from '../microservices/org/model';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import SegmentedTabs from '../components/SegmentedTabs';

// Invitation form: one email, one role, sealed with a tap.
export default function InviteMemberScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new InviteMemberPresenter(navigation));
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');

  const submit = () => {
    presenter.form = { email, role };
    presenter.submit();
  };

  return (
    <Screen title="Invite member" eyebrow="Grow the organisation" onBack={() => navigation.goBack()}>
      <Text style={styles.body}>
        New members receive an email invitation. They join as pending until they accept and sign in for the first time.
      </Text>

      <AppInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="colleague@example.com"
        keyboardType="email-address"
        error={state.fieldErrors.email}
      />

      <Text style={styles.eyebrow}>Role</Text>
      <SegmentedTabs
        options={INVITE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
        value={role}
        onChange={setRole}
        style={{ marginBottom: spacing(4) }}
      />

      {state.status === 'error' ? <Text style={styles.error}>{state.error}</Text> : null}
      <AppButton label="Send invitation" variant="amber" loading={state.status === 'loading'} onPress={submit} />
      <Text style={[type.caption, { marginTop: spacing(3) }]}>
        Custodians can adjust roles later from the team directory. Invitations expire with the audit trail intact.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...type.body, lineHeight: 24, marginBottom: spacing(4) },
  eyebrow: { ...type.micro, marginBottom: spacing(2) },
  error: { color: palette.coral, fontSize: 12.5, marginBottom: spacing(2) },
});

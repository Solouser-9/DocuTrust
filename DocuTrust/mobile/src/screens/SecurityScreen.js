import React, { useEffect, useState } from 'react';
import { Clipboard } from 'react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { mono, type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { SecurityPresenter } from '../microservices/profile/presenters';
import { AuthStore } from '../core/store/AuthStore';
import { ToastStore } from '../core/store/ToastStore';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import StampBadge from '../components/StampBadge';
import ListItem from '../components/ListItem';
import CodeBoxes from '../components/CodeBoxes';

export default function SecurityScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new SecurityPresenter(navigation));
  const [code, setCode] = useState('');
  const [disabling, setDisabling] = useState(false);
  const user = (state.data && state.data.user) || AuthStore.getState().user || {};
  const sessions = (state.data && state.data.sessions) || [];
  const mfaEnabled = !!(state.data && state.data.mfaEnabled);
  const setup = state.data && state.data.setup;

  useEffect(() => {
    presenter.load();
  }, [presenter]);

  const copy = (value, label) => {
    Clipboard.setString(value);
    ToastStore.success(`${label} copied.`);
  };

  return (
    <Screen title="Security" eyebrow="Locks on the vault door" onBack={() => navigation.goBack()}>
      <AppCard>
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Two-factor authentication</Text>
            <Text style={type.caption}>A six-digit code on top of your password.</Text>
          </View>
          <StampBadge status={mfaEnabled ? 'active' : 'info'} label={mfaEnabled ? 'Enabled' : 'Off'} small />
        </View>

        {!mfaEnabled && !setup ? (
          <AppButton label="Set up MFA" variant="amber" onPress={() => presenter.startSetup()} style={{ marginTop: spacing(3) }} />
        ) : null}

        {setup && state.data.secret ? (
          <View style={{ marginTop: spacing(3) }}>
            <Text style={styles.eyebrow}>1 · Add this secret to your authenticator</Text>
            <View style={styles.secretRow}>
              <Text style={styles.secret}>{state.data.secret}</Text>
              <TouchableOpacity onPress={() => copy(state.data.secret, 'Secret')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.copy}>Copy</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.eyebrow}>Or paste the otpauth URL</Text>
            <View style={styles.secretRow}>
              <Text style={styles.secretSmall} numberOfLines={2}>{state.data.otpauthUrl}</Text>
              <TouchableOpacity onPress={() => copy(state.data.otpauthUrl, 'otpauth URL')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.copy}>Copy</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.eyebrow}>2 · Confirm the six-digit code</Text>
            <CodeBoxes code={code} />
            <View style={styles.row}>
              <AppButton label="Cancel" variant="ghost" small onPress={() => { setCode(''); presenter.load(); }} style={{ flex: 1 }} />
              <AppButton label="Enable MFA" variant="amber" small loading={state.status === 'loading'} onPress={() => presenter.confirmSetup(code)} style={{ flex: 1, marginLeft: spacing(2.5) }} />
            </View>
          </View>
        ) : null}

        {mfaEnabled ? (
          <View style={{ marginTop: spacing(3) }}>
            {disabling ? (
              <View>
                <CodeBoxes code={code} />
                <View style={styles.row}>
                  <AppButton label="Keep MFA" variant="ghost" small onPress={() => { setCode(''); setDisabling(false); }} style={{ flex: 1 }} />
                  <AppButton label="Disable" variant="coral" small loading={state.status === 'loading'} onPress={() => presenter.disable(code)} style={{ flex: 1, marginLeft: spacing(2.5) }} />
                </View>
              </View>
            ) : (
              <AppButton label="Disable MFA" variant="ghost" small onPress={() => setDisabling(true)} style={{ alignSelf: 'flex-start' }} />
            )}
          </View>
        ) : null}
      </AppCard>

      <AppCard style={{ marginTop: spacing(3), padding: 0 }}>
        <Text style={[styles.eyebrow, { paddingHorizontal: spacing(4), paddingTop: spacing(3.5) }]}>Active sessions</Text>
        {sessions.map((s, i) => (
          <ListItem key={s.id} title={s.device} subtitle="This install holds your rotating refresh token" value last={i === sessions.length - 1} right={<StampBadge status="active" label="Active" small />} />
        ))}
        <Text style={[type.caption, { paddingHorizontal: spacing(4), paddingBottom: spacing(3.5) }]}>
          Sessions come from your refresh token, which rotates on every use. Signing out revokes it server-side; a replayed token revokes the whole family.
        </Text>
      </AppCard>

      <AppCard style={{ marginTop: spacing(3) }}>
        <ListItem title="Change password" onPress={() => navigation.navigate('ChangePassword')} last />
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center' },
  eyebrow: { ...type.micro, marginBottom: spacing(2) },
  secretRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing(3) },
  secret: { ...mono, backgroundColor: palette.cream, borderRadius: 8, paddingHorizontal: spacing(2.5), paddingVertical: spacing(1.5), flex: 1 },
  secretSmall: { ...mono, fontSize: 11, backgroundColor: palette.cream, borderRadius: 8, paddingHorizontal: spacing(2.5), paddingVertical: spacing(1.5), flex: 1 },
  copy: { color: palette.amber, fontWeight: '700', fontSize: 13, marginLeft: spacing(2.5) },
  row: { flexDirection: 'row', marginTop: spacing(1) },
});

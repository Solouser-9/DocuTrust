import React, { useEffect, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { mono, type } from '../core/theme/typography';
import { formatDate } from '../core/utils/formatters';
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
  const inputRef = useRef(null);
  const [disabling, setDisabling] = useState(false);
  const user = (state.data && state.data.user) || AuthStore.getState().user || {};
  const mfaEnabled = !!(state.data && state.data.mfaEnabled);
  const setup = state.data && state.data.setup;
  const sessions = (state.data && state.data.sessions) || [];
  const sessionsLoading = !!(state.data && state.data.sessionsLoading);
  const sessionsError = state.data && state.data.sessionsError;

  const changeCode = (value) => {
    setCode(value);
    if (state.fieldErrors.code) {
      presenter.setState({ fieldErrors: { ...state.fieldErrors, code: null } });
    }
  };

  useEffect(() => {
    presenter.load();
  }, [presenter]);

  const copy = async (value, label) => {
    try {
      await Clipboard.setStringAsync(value);
      ToastStore.success(`${label} copied.`);
    } catch (e) {
      ToastStore.error(`Could not copy ${label}.`);
    }
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
                <Text style={styles.eyebrow}>Scan this QR code with Google Authenticator</Text>
                <View style={styles.qrCode}>
                  <QRCode value={state.data.otpauthUrl} size={200} />
                </View>
                <Text style={styles.eyebrow}>Or copy the setup URL</Text>
                <View style={styles.secretRow}>
                  <Text style={styles.secretSmall} numberOfLines={1}>Authenticator setup URL</Text>
                  <TouchableOpacity onPress={() => copy(state.data.otpauthUrl, 'otpauth URL')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.copy}>Copy</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.eyebrow}>2 · Confirm the six-digit code</Text>

                {/* Removed redundant Pressable wrapper here */}
                <CodeBoxes inputRef={inputRef} code={code} onChangeText={changeCode} accessibilityLabel="MFA setup confirmation code" />

                {state.fieldErrors.code ? <Text style={styles.error}>{state.fieldErrors.code}</Text> : null}
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
                      {/* Removed redundant Pressable wrapper here */}
                      <CodeBoxes inputRef={inputRef} code={code} onChangeText={changeCode} accessibilityLabel="MFA disable confirmation code" />

                      {state.fieldErrors.code ? <Text style={styles.error}>{state.fieldErrors.code}</Text> : null}
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
          {sessionsLoading ? (
              <View style={styles.sessionsState}>
                <ActivityIndicator color={palette.amberText} />
                <Text style={[type.caption, { marginTop: spacing(2) }]}>Loading active sessions…</Text>
              </View>
          ) : sessionsError ? (
              <View style={styles.sessionsState}>
                <Text style={styles.sessionsNoticeText}>Couldn’t load active sessions. Please try again.</Text>
                <AppButton label="Try again" variant="ghost" small onPress={() => presenter.loadSessions()} style={{ marginTop: spacing(2) }} />
              </View>
          ) : sessions.length === 0 ? (
              <View style={styles.sessionsState}>
                <Text style={styles.sessionsNoticeText}>No active sessions found.</Text>
              </View>
          ) : (
              <View style={styles.sessionList}>
                {sessions.map((session, index) => (
                    <View key={String(session.id)} style={[styles.sessionRow, index < sessions.length - 1 && styles.sessionDivider]}>
                      <View style={styles.sessionDetails}>
                        <Text style={styles.sessionDevice}>{session.device || 'Unknown device'}</Text>
                        <Text style={styles.sessionMeta}>IP · {session.ip || 'Unavailable'}</Text>
                        <Text style={styles.sessionMeta}>Signed in · {formatDate(session.createdAt)}</Text>
                      </View>
                      <AppButton
                          label="Revoke"
                          variant="coral"
                          small
                          loading={state.revokingSessionId === session.id}
                          disabled={!!state.revokingSessionId}
                          onPress={() => presenter.revokeSession(session.id)}
                          style={styles.revokeButton}
                      />
                    </View>
                ))}
              </View>
          )}
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
  qrCode: { alignSelf: 'center', backgroundColor: palette.paper, padding: spacing(3), borderRadius: 12, marginBottom: spacing(3) },
  secret: { ...mono, backgroundColor: palette.cream, borderRadius: 8, paddingHorizontal: spacing(2.5), paddingVertical: spacing(1.5), flex: 1 },
  secretSmall: { ...mono, fontSize: 11, backgroundColor: palette.cream, borderRadius: 8, paddingHorizontal: spacing(2.5), paddingVertical: spacing(1.5), flex: 1 },
  copy: { color: palette.amberText, fontWeight: '700', fontSize: 13, marginLeft: spacing(2.5) },
  row: { flexDirection: 'row', marginTop: spacing(1) },
  error: { color: palette.coralText, fontSize: 13, marginBottom: spacing(2) },
  sessionsState: {
    backgroundColor: palette.cream,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: spacing(4),
    marginBottom: spacing(3.5),
    padding: spacing(3),
    alignItems: 'center',
  },
  sessionsNoticeText: { ...type.caption, color: palette.ink, lineHeight: 20 },
  sessionList: { paddingHorizontal: spacing(4), paddingBottom: spacing(1) },
  sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(3) },
  sessionDivider: { borderBottomWidth: 1, borderBottomColor: palette.line },
  sessionDetails: { flex: 1, paddingRight: spacing(2) },
  sessionDevice: { color: palette.ink, fontSize: 14, fontWeight: '700', marginBottom: spacing(1) },
  sessionMeta: { ...type.caption, color: palette.slate, marginTop: spacing(0.5) },
  revokeButton: { backgroundColor: palette.coral, minWidth: 78 },
});
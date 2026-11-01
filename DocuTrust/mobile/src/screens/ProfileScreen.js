import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { SERIF, type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { ProfilePresenter } from '../microservices/profile/presenters';
import { roleLabel, roleTone } from '../microservices/auth/model';
import { formatDate } from '../core/utils/formatters';
import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import StampBadge from '../components/StampBadge';
import ListItem from '../components/ListItem';
import ConfirmDialog from '../components/ConfirmDialog';
import { AuthStore } from '../core/store/AuthStore';

export default function ProfileScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new ProfilePresenter(navigation));
  const [confirmLogout, setConfirmLogout] = useState(false);
  const user = AuthStore.getState().user || (state.data && state.data.user) || {};

  useEffect(() => {
    presenter.load();
    const unsub = navigation.addListener('focus', () => presenter.load());
    return unsub;
  }, [presenter, navigation]);

  return (
    <Screen title="Profile" eyebrow="Your standing in the vault" loading={state.status === 'loading' && !user.id}>
      <View style={styles.head}>
        <Avatar name={user.fullName} size={62} />
        <View style={{ flex: 1, marginLeft: spacing(3) }}>
          <Text style={styles.name}>{user.fullName || 'Member'}</Text>
          <Text style={type.caption}>{user.email}</Text>
          <View style={{ flexDirection: 'row', marginTop: spacing(2) }}>
            <StampBadge status="info" label={roleLabel(user.role)} tone={roleTone(user.role)} small />
            {user.orgName ? <StampBadge status="info" label={user.orgName} tone="slate" small style={{ marginLeft: spacing(2) }} /> : null}
          </View>
        </View>
      </View>

      <AppCard style={{ marginTop: spacing(4), padding: 0 }}>
        <ListItem title="Email verification" value right={<StampBadge status={user.emailVerified ? 'verified' : 'pending'} label={user.emailVerified ? 'Verified' : 'Pending'} small />} />
        <ListItem title="Two-factor (MFA)" value right={<StampBadge status={user.mfaEnabled ? 'active' : 'info'} label={user.mfaEnabled ? 'Enabled' : 'Off'} small />} />
        <ListItem title="Member since" value right={<Text style={type.caption}>{formatDate(user.createdAt)}</Text>} last />
      </AppCard>

      <AppCard style={{ marginTop: spacing(3), padding: 0 }}>
        <ListItem title="Edit profile" onPress={() => navigation.navigate('EditProfile')} />
        <ListItem title="Change password" onPress={() => navigation.navigate('ChangePassword')} />
        <ListItem title="Security & sessions" onPress={() => navigation.navigate('Security')} />
        <ListItem title="Notification preferences" onPress={() => navigation.navigate('NotificationPrefs')} />
        <ListItem title="Help & FAQ" onPress={() => navigation.navigate('Help')} last />
      </AppCard>

      {user.role === 'admin' || user.role === 'org_manager' ? (
        <AppCard style={{ marginTop: spacing(3), padding: 0 }}>
          {user.role === 'admin' ? (
            <ListItem title="Admin console" subtitle="Registrar stewardship of the platform" onPress={() => navigation.navigate('AdminStack')} />
          ) : null}
          <ListItem
            title="Organisation"
            subtitle="Roster, stats and invitations"
            onPress={() => navigation.navigate('OrgStack')}
            last={user.role !== 'admin'}
          />
        </AppCard>
      ) : null}

      <AppButton label="Sign out" variant="coral" onPress={() => setConfirmLogout(true)} style={{ marginTop: spacing(5) }} />
      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing(3) }]}>
        Signing out revokes your refresh token on the server.
      </Text>

      <ConfirmDialog
        visible={confirmLogout}
        title="Sign out?"
        message="Your vault stays sealed. You can sign back in at any time."
        confirmLabel="Sign out"
        danger
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          presenter.logout();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginTop: spacing(2) },
  name: { fontFamily: SERIF, fontSize: 20, fontWeight: '700', color: palette.ink, marginBottom: 2 },
});

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { AdminUserDetailPresenter } from '../microservices/admin/presenters';
import { roleLabel, roleTone } from '../microservices/auth/model';
import { formatDate } from '../core/utils/formatters';
import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import StampBadge from '../components/StampBadge';
import ListItem from '../components/ListItem';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';

// Registrar stewardship over one account: identity, stamps, suspend/activate.
export default function AdminUserDetailScreen({ navigation, route }) {
  const id = (route && route.params && route.params.id) || null;
  const [state, presenter] = usePresenter(() => new AdminUserDetailPresenter(navigation));
  const [confirmStatus, setConfirmStatus] = useState(null); // 'suspended' | 'active'
  const user = state.data && state.data.user;
  const isSelf = !!(state.data && state.data.isSelf);

  useEffect(() => {
    presenter.load(id);
  }, [presenter, id]);

  if (state.status === 'empty') {
    return (
      <Screen title="User" onBack={() => navigation.goBack()}>
        <EmptyState variant="vault" title="User not found" message="This account may have been removed." />
      </Screen>
    );
  }

  const confirm = () => {
    const status = confirmStatus;
    setConfirmStatus(null);
    if (status) presenter.setStatus(status);
  };

  return (
    <Screen
      title="User record"
      eyebrow="Registrar stewardship"
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !user}
    >
      {user ? (
        <View>
          <View style={styles.head}>
            <Avatar name={user.fullName || user.email} size={58} />
            <View style={{ flex: 1, marginLeft: spacing(3) }}>
              <Text style={styles.name} numberOfLines={1}>{user.fullName || 'Member'}</Text>
              <Text style={type.caption} numberOfLines={1}>{user.email}</Text>
              <View style={styles.stampRow}>
                <StampBadge status="info" label={roleLabel(user.role)} tone={roleTone(user.role)} small />
                <StampBadge status={user.status} small style={{ marginLeft: spacing(2) }} />
              </View>
            </View>
          </View>

          <AppCard style={{ marginTop: spacing(4), padding: 0 }}>
            <ListItem title="Email" value right={<Text style={type.caption}>{user.email || '—'}</Text>} />
            <ListItem title="Role" value right={<Text style={type.caption}>{roleLabel(user.role)}</Text>} />
            <ListItem title="Organisation" value right={<Text style={type.caption}>{user.orgName || '—'}</Text>} />
            <ListItem
              title="Email verified"
              value
              right={<StampBadge status={user.emailVerified ? 'verified' : 'pending'} label={user.emailVerified ? 'Verified' : 'Pending'} small />}
            />
            <ListItem title="Member since" value right={<Text style={type.caption}>{formatDate(user.createdAt)}</Text>} last />
          </AppCard>

          {isSelf ? (
            <AppCard style={{ marginTop: spacing(4) }}>
              <Text style={type.caption}>You cannot suspend your own registrar account.</Text>
            </AppCard>
          ) : (
            <View style={styles.actions}>
              {user.status === 'suspended' ? (
                <AppButton label="Reactivate account" variant="amber" onPress={() => setConfirmStatus('active')} style={{ flex: 1 }} />
              ) : (
                <AppButton label="Suspend account" variant="coral" onPress={() => setConfirmStatus('suspended')} style={{ flex: 1 }} />
              )}
            </View>
          )}

          <Text style={[type.caption, { marginTop: spacing(3) }]}>
            Suspension blocks vault access on the next token refresh. The account keeps every sealed record.
          </Text>
        </View>
      ) : null}

      <ConfirmDialog
        visible={!!confirmStatus}
        title={confirmStatus === 'suspended' ? 'Suspend this account?' : 'Reactivate this account?'}
        message={
          confirmStatus === 'suspended'
            ? 'The user loses vault access until a registrar reactivates them.'
            : 'The user regains full vault access immediately.'
        }
        confirmLabel={confirmStatus === 'suspended' ? 'Suspend' : 'Reactivate'}
        danger={confirmStatus === 'suspended'}
        onCancel={() => setConfirmStatus(null)}
        onConfirm={confirm}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginTop: spacing(2) },
  name: { fontFamily: 'Georgia', fontSize: 20, fontWeight: '700', color: palette.ink, marginBottom: 2 },
  stampRow: { flexDirection: 'row', marginTop: spacing(2), flexWrap: 'wrap' },
  actions: { flexDirection: 'row', marginTop: spacing(4) },
});

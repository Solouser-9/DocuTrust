import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { TeamMembersPresenter } from '../microservices/org/presenters';
import { roleLabel, roleTone } from '../microservices/auth/model';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import { relativeTime } from '../core/utils/formatters';
import Screen from '../components/Screen';
import SectionHeader from '../components/SectionHeader';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import Avatar from '../components/Avatar';
import StampBadge from '../components/StampBadge';
import EmptyState from '../components/EmptyState';

// Team directory: active roster with role stamps, pending invites below.
export default function TeamMembersScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new TeamMembersPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load());
  const active = (state.data && state.data.active) || [];
  const pending = (state.data && state.data.pending) || [];
  const meId = state.data && state.data.meId;

  useEffect(() => {
    presenter.load();
    const unsub = navigation.addListener('focus', () => presenter.load());
    return unsub;
  }, [presenter, navigation]);

  return (
    <Screen
      title="Team"
      eyebrow={`${active.length} active · ${pending.length} pending`}
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !active.length && !pending.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {state.status === 'empty' ? (
        <EmptyState
          variant="folder"
          title="No members yet"
          message="Invite colleagues to share custody of the organisation vault."
          actionLabel="Invite member"
          onAction={() => navigation.navigate('InviteMember')}
        />
      ) : state.status === 'error' ? (
        <EmptyState variant="vault" title="Roster unavailable" message={state.error} actionLabel="Try again" onAction={() => presenter.load()} />
      ) : (
        <View>
          <SectionHeader eyebrow="Roster" title="Active members" />
          <AppCard style={{ padding: 0 }}>
            {active.map((m, i) => (
              <View key={String(m.id)} style={[styles.memberRow, i < active.length - 1 && styles.bordered]}>
                <Avatar name={m.fullName || m.email} size={38} />
                <View style={styles.who}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {m.fullName || m.email}
                    {String(m.id) === String(meId) ? ' (you)' : ''}
                  </Text>
                  <Text style={type.caption} numberOfLines={1}>{m.email}</Text>
                </View>
                <StampBadge status="info" label={roleLabel(m.role)} tone={roleTone(m.role)} small />
              </View>
            ))}
          </AppCard>

          {pending.length ? (
            <View>
              <SectionHeader eyebrow="Awaiting acceptance" title="Pending invites" />
              <AppCard style={{ padding: 0 }}>
                {pending.map((m, i) => (
                  <View key={String(m.id)} style={[styles.memberRow, i < pending.length - 1 && styles.bordered]}>
                    <Avatar name={m.email} size={38} tone="slate" />
                    <View style={styles.who}>
                      <Text style={styles.memberName} numberOfLines={1}>{m.email}</Text>
                      <Text style={type.caption}>Invitation sent {relativeTime(m.createdAt)}</Text>
                    </View>
                    <StampBadge status="pending" label="Pending" small />
                  </View>
                ))}
              </AppCard>
            </View>
          ) : null}

          <AppButton label="Invite member" variant="amber" onPress={() => navigation.navigate('InviteMember')} style={{ marginTop: spacing(4) }} />
          <Text style={[type.caption, { marginTop: spacing(3) }]}>
            Custodians invite members and steward roles. Pending invites activate on first sign-in.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(2.75), paddingHorizontal: spacing(4) },
  bordered: { borderBottomWidth: 1, borderBottomColor: palette.line },
  who: { flex: 1, marginLeft: spacing(2.5) },
  memberName: { fontSize: 14.5, fontWeight: '600', color: palette.ink },
});

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { OrgPresenter } from '../microservices/org/presenters';
import { roleLabel, roleTone } from '../microservices/auth/model';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import Screen from '../components/Screen';
import StatTile from '../components/StatTile';
import SectionHeader from '../components/SectionHeader';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import Avatar from '../components/Avatar';
import StampBadge from '../components/StampBadge';
import EmptyState from '../components/EmptyState';

// Org stats as serif tiles + a member preview that hands off to TeamMembers.
export default function OrgScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new OrgPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load());
  const stats = (state.data && state.data.stats) || {};
  const members = (state.data && state.data.members) || [];
  const pending = members.filter((m) => m.status === 'pending').length;
  const preview = members.slice(0, 5);

  useEffect(() => {
    presenter.load();
    const unsub = navigation.addListener('focus', () => presenter.load());
    return unsub;
  }, [presenter, navigation]);

  const count = (...keys) => {
    for (const key of keys) {
      if (stats && stats[key] !== undefined && stats[key] !== null) return String(stats[key]);
    }
    return '—';
  };

  return (
    <Screen
      title="Organisation"
      eyebrow="Custodian oversight"
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !members.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {state.status === 'error' ? (
        <EmptyState variant="vault" title="Organisation unavailable" message={state.error} actionLabel="Try again" onAction={() => presenter.load()} />
      ) : (
        <View>
          <View style={styles.gridRow}>
            <StatTile value={count('memberCount', 'members', 'totalMembers')} label="Members" />
            <StatTile
              value={count('sharedDocuments', 'sharedDocs', 'sharedDocumentCount', 'sharedCount', 'shared')}
              label="Shared documents"
              tone="amber"
              style={{ marginLeft: spacing(2.5) }}
            />
          </View>
          <View style={[styles.gridRow, { marginTop: spacing(2.5) }]}>
            <StatTile value={String(members.length - pending)} label="Active roster" />
            <StatTile value={String(pending)} label="Pending invites" tone="amber" style={{ marginLeft: spacing(2.5) }} />
          </View>

          <SectionHeader eyebrow="Roster" title="Members" actionLabel="View all" onAction={() => navigation.navigate('TeamMembers')} />
          {preview.length ? (
            <AppCard style={{ padding: 0 }}>
              {preview.map((m, i) => (
                <View key={String(m.id)} style={[styles.memberRow, i < preview.length - 1 && styles.bordered]}>
                  <Avatar name={m.fullName || m.email} size={36} />
                  <View style={styles.who}>
                    <Text style={styles.memberName} numberOfLines={1}>{m.fullName || m.email}</Text>
                    <Text style={type.caption} numberOfLines={1}>{m.email}</Text>
                  </View>
                  <StampBadge status="info" label={roleLabel(m.role)} tone={roleTone(m.role)} small />
                </View>
              ))}
            </AppCard>
          ) : (
            <AppCard>
              <Text style={type.caption}>No members yet. Invite the first custodian or member.</Text>
            </AppCard>
          )}

          <View style={styles.actions}>
            <AppButton label="Team directory" variant="ghost" onPress={() => navigation.navigate('TeamMembers')} style={{ flex: 1 }} />
            <AppButton label="Invite member" variant="amber" onPress={() => navigation.navigate('InviteMember')} style={{ flex: 1, marginLeft: spacing(2.5) }} />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gridRow: { flexDirection: 'row' },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(2.75), paddingHorizontal: spacing(4) },
  bordered: { borderBottomWidth: 1, borderBottomColor: palette.line },
  who: { flex: 1, marginLeft: spacing(2.5) },
  memberName: { fontSize: 14.5, fontWeight: '600', color: palette.ink },
  actions: { flexDirection: 'row', marginTop: spacing(5) },
});

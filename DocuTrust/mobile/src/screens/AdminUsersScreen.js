import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { AdminUsersPresenter } from '../microservices/admin/presenters';
import { USER_ROLES, USER_STATUSES } from '../microservices/admin/model';
import { roleLabel, roleTone } from '../microservices/auth/model';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import { relativeTime } from '../core/utils/formatters';
import Screen from '../components/Screen';
import SearchBar from '../components/SearchBar';
import Chip from '../components/Chip';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import Avatar from '../components/Avatar';
import StampBadge from '../components/StampBadge';
import EmptyState from '../components/EmptyState';

// Registrar directory: search + role/status filter chips over every account.
export default function AdminUsersScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new AdminUsersPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load());
  const [term, setTerm] = useState('');
  const [filters, setFilters] = useState(presenter.filters);
  const items = (state.data && state.data.items) || [];
  const hasMore = !!(state.data && state.data.hasMore);

  useEffect(() => {
    presenter.load();
    const unsub = navigation.addListener('focus', () => presenter.load());
    return unsub;
  }, [presenter, navigation]);

  const setFilter = (key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    presenter.setFilter(key, value);
  };

  return (
    <Screen
      title="User directory"
      eyebrow={`${items.length} account${items.length === 1 ? '' : 's'} listed`}
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !items.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <SearchBar
        value={term}
        onChangeText={setTerm}
        onSubmit={() => presenter.setFilter('search', term.trim())}
        placeholder="Search names or emails"
        style={{ marginBottom: spacing(3) }}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingRight: spacing(4) }}>
        {USER_ROLES.map((f) => (
          <Chip key={f.value || 'all'} label={f.label} active={(filters.role || '') === f.value} onPress={() => setFilter('role')(f.value)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingRight: spacing(4) }}>
        {USER_STATUSES.map((f) => (
          <Chip key={f.value || 'all'} label={f.label} active={(filters.status || '') === f.value} onPress={() => setFilter('status')(f.value)} />
        ))}
      </ScrollView>

      {state.status === 'empty' ? (
        <EmptyState variant="search" title="No accounts match" message="Loosen the search or filters to widen the directory." />
      ) : state.status === 'error' ? (
        <EmptyState variant="vault" title="Directory unavailable" message={state.error} actionLabel="Try again" onAction={() => presenter.load()} />
      ) : (
        items.map((user) => (
          <AppCard key={String(user.id)} onPress={() => presenter.open(user)} style={styles.card}>
            <View style={styles.row}>
              <Avatar name={user.fullName || user.email} size={40} />
              <View style={styles.who}>
                <Text style={styles.name} numberOfLines={1}>{user.fullName || user.email || 'Member'}</Text>
                <Text style={type.caption} numberOfLines={1}>{user.email || '—'}</Text>
              </View>
              <StampBadge status="info" label={roleLabel(user.role)} tone={roleTone(user.role)} small />
            </View>
            <View style={[styles.row, styles.footRow]}>
              <StampBadge status={user.status} small />
              <Text style={[type.caption, { marginLeft: spacing(2) }]}>Joined {relativeTime(user.createdAt)}</Text>
            </View>
          </AppCard>
        ))
      )}

      {hasMore ? (
        <AppButton label="Load more" variant="ghost" loading={state.status === 'loading'} onPress={() => presenter.loadMore()} style={{ marginTop: spacing(2) }} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: { marginBottom: spacing(2.5), marginLeft: -spacing(4) },
  card: { marginBottom: spacing(2.5) },
  row: { flexDirection: 'row', alignItems: 'center' },
  who: { flex: 1, marginLeft: spacing(2.5) },
  name: { fontSize: 14.5, fontWeight: '600', color: palette.ink },
  footRow: { marginTop: spacing(2), paddingLeft: spacing(6.5) },
});

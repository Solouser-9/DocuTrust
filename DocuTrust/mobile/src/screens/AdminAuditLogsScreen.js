import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { spacing } from '../core/theme/spacing';
import { usePresenter } from '../mvp/usePresenter';
import { AdminAuditPresenter } from '../microservices/admin/presenters';
import { AUDIT_ACTIONS } from '../microservices/admin/model';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import Screen from '../components/Screen';
import Chip from '../components/Chip';
import AppButton from '../components/AppButton';
import Timeline from '../components/Timeline';
import EmptyState from '../components/EmptyState';

// Append-only platform trail: action filter chips feeding Timeline rows.
export default function AdminAuditLogsScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new AdminAuditPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load());
  const [action, setAction] = useState('');
  const items = (state.data && state.data.items) || [];
  const hasMore = !!(state.data && state.data.hasMore);

  useEffect(() => {
    presenter.load();
  }, [presenter]);

  const pick = (value) => {
    setAction(value);
    presenter.setAction(value);
  };

  return (
    <Screen
      title="Audit logs"
      eyebrow="Append-only platform trail"
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !items.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingRight: spacing(4) }}>
        {AUDIT_ACTIONS.map((f) => (
          <Chip key={f.value || 'all'} label={f.label} active={(action || '') === f.value} onPress={() => pick(f.value)} />
        ))}
      </ScrollView>

      {state.status === 'empty' ? (
        <EmptyState variant="check" title="Nothing logged yet" message="Platform events will appear here as they happen." />
      ) : state.status === 'error' ? (
        <EmptyState variant="vault" title="Log unavailable" message={state.error} actionLabel="Try again" onAction={() => presenter.load()} />
      ) : (
        <Timeline items={items} />
      )}

      {hasMore ? (
        <AppButton label="Load older entries" variant="ghost" loading={state.status === 'loading'} onPress={() => presenter.loadMore()} style={{ marginTop: spacing(2) }} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: { marginBottom: spacing(3), marginLeft: -spacing(4) },
});

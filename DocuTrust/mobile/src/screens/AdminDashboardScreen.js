import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { SERIF, type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { AdminDashboardPresenter } from '../microservices/admin/presenters';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import Screen from '../components/Screen';
import StatTile from '../components/StatTile';
import SectionHeader from '../components/SectionHeader';
import AppCard from '../components/AppCard';
import ListItem from '../components/ListItem';
import EmptyState from '../components/EmptyState';

// Registrar console home: v_admin_stats as serif tiles + quick links.
export default function AdminDashboardScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new AdminDashboardPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load());
  const tiles = (state.data && state.data.tiles) || [];

  useEffect(() => {
    presenter.load();
  }, [presenter]);

  const tile = (key) => tiles.find((t) => t.key === key);

  return (
    <Screen
      title="Registrar console"
      eyebrow="Platform overview"
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !tiles.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {state.status === 'error' ? (
        <EmptyState variant="vault" title="Stats unavailable" message={state.error} actionLabel="Try again" onAction={() => presenter.load()} />
      ) : (
        <View>
          <View style={styles.gridRow}>
            <StatTile value={fmt(tile('users'))} label="Users" />
            <StatTile value={fmt(tile('documents'))} label="Documents" style={{ marginLeft: spacing(2.5) }} />
          </View>
          <View style={[styles.gridRow, { marginTop: spacing(2.5) }]}>
            <StatTile value={fmt(tile('pending'))} label="Pending reviews" tone="amber" />
            <StatTile value={fmt(tile('shares'))} label="Active shares" style={{ marginLeft: spacing(2.5) }} />
          </View>
          <View style={[styles.gridRow, { marginTop: spacing(2.5) }]}>
            <StatTile value={fmt(tile('verifications'))} label="Verifications" />
            <StatTile value={fmt(tile('orgs'))} label="Organisations" style={{ marginLeft: spacing(2.5) }} />
          </View>

          <SectionHeader eyebrow="Workbench" title="Jump to" />
          <AppCard style={{ padding: 0 }}>
            <ListItem title="Review queue" subtitle="Sensitive uploads awaiting a registrar" onPress={() => navigation.navigate('AdminReviewQueue')} />
            <ListItem title="User directory" subtitle="Search, filter, suspend" onPress={() => navigation.navigate('AdminUsers')} />
            <ListItem title="Platform documents" subtitle="Read-only ledger of every seal" onPress={() => navigation.navigate('AdminDocuments')} />
            <ListItem title="Audit logs" subtitle="Append-only platform trail" onPress={() => navigation.navigate('AdminAuditLogs')} last />
          </AppCard>
        </View>
      )}
    </Screen>
  );
}

function fmt(tileObj) {
  const v = tileObj ? tileObj.value : null;
  return v === null || v === undefined ? '—' : String(v);
}

const styles = StyleSheet.create({
  gridRow: { flexDirection: 'row' },
});

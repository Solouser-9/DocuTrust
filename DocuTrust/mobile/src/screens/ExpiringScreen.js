import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { SERIF, type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { ExpiringPresenter } from '../microservices/documents/presenters';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import { docTypeLabel } from '../microservices/documents/model';
import { formatDate, daysUntil } from '../core/utils/formatters';
import Screen from '../components/Screen';
import SegmentedTabs from '../components/SegmentedTabs';
import AppCard from '../components/AppCard';
import EmptyState from '../components/EmptyState';

const HORIZONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

export default function ExpiringScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new ExpiringPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load(horizon));
  const [horizon, setHorizon] = useState('30');
  const items = (state.data && state.data.items) || [];

  useEffect(() => {
    presenter.load(30);
  }, [presenter]);

  const choose = (value) => {
    setHorizon(value);
    presenter.load(Number(value));
  };

  return (
    <Screen
      title="Expiring"
      eyebrow="Renew before the seal cracks"
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !items.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <SegmentedTabs options={HORIZONS} value={horizon} onChange={choose} style={{ marginBottom: spacing(4) }} />

      {state.status === 'empty' ? (
        <EmptyState variant="vault" title="Nothing expires soon" message={`No document expires within the next ${horizon} days.`} />
      ) : state.status === 'error' ? (
        <EmptyState variant="vault" title="Could not load" message={state.error} actionLabel="Try again" onAction={() => presenter.load(Number(horizon))} />
      ) : (
        items.map((doc) => {
          const left = daysUntil(doc.expiresAt);
          const overdue = left !== null && left <= 0;
          return (
            <AppCard key={String(doc.id)} onPress={() => navigation.navigate('DocumentDetail', { id: doc.id })} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.typeEyebrow}>{docTypeLabel(doc.docType)}</Text>
                <Text style={styles.title} numberOfLines={1}>{doc.title}</Text>
                <Text style={type.caption}>{doc.expiresAt ? `Expiry ${formatDate(doc.expiresAt)}` : 'No expiry'}</Text>
              </View>
              <View style={styles.daysBox}>
                <Text style={[styles.days, overdue && { color: palette.coral }]}>{overdue ? 'Lapsed' : `${left} d`}</Text>
              </View>
            </AppCard>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing(2.5) },
  typeEyebrow: { ...type.micro, fontSize: 10, marginBottom: spacing(1) },
  title: { fontFamily: SERIF, fontSize: 16, fontWeight: '700', color: palette.ink, marginBottom: 2 },
  daysBox: { marginLeft: spacing(3), alignItems: 'center' },
  days: { fontFamily: SERIF, fontSize: 20, fontWeight: '700', color: palette.amber },
});

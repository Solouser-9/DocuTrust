import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { SERIF, type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { DashboardPresenter } from '../microservices/documents/presenters';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import { AuthStore } from '../core/store/AuthStore';
import { relativeTime, daysUntil } from '../core/utils/formatters';
import { docTypeLabel } from '../microservices/documents/model';
import Screen from '../components/Screen';
import StatTile from '../components/StatTile';
import SectionHeader from '../components/SectionHeader';
import FileTabCard from '../components/FileTabCard';
import AppCard from '../components/AppCard';
import EmptyState from '../components/EmptyState';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new DashboardPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load());

  useEffect(() => {
    presenter.load();
    const unsub = navigation.addListener('focus', () => presenter.load());
    return unsub;
  }, [presenter, navigation]);

  const user = AuthStore.getState().user || {};
  const firstName = (user.fullName || 'there').split(' ')[0];
  const d = state.data || { recent: [], expiring: [], total: 0, sharedCount: 0 };

  return (
    <Screen
      eyebrow={new Date().toDateString()}
      title={`${greeting()}, ${firstName}.`}
      loading={state.status === 'loading' && !d.total && !d.recent.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginLeft: -spacing(4) }} contentContainerStyle={{ paddingHorizontal: spacing(4) }}>
        <StatTile value={String(d.total)} label="Documents" onPress={() => navigation.navigate('Documents')} />
        <StatTile value={String(d.expiring.length)} label="Expiring soon" tone="coral" onPress={() => navigation.navigate('Expiring')} style={{ marginHorizontal: spacing(2.5) }} />
        <StatTile value={String(d.sharedCount)} label="Shared links" onPress={() => navigation.navigate('Shares')} />
      </ScrollView>

      <SectionHeader eyebrow="Under seal" title="Expiring soon" actionLabel="All" onAction={() => navigation.navigate('Expiring')} />
      {d.expiring.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginLeft: -spacing(4) }} contentContainerStyle={{ paddingHorizontal: spacing(4) }}>
          {d.expiring.map((doc) => {
            const left = daysUntil(doc.expiresAt);
            return (
              <TouchableOpacity key={String(doc.id)} onPress={() => navigation.navigate('DocumentDetail', { id: doc.id })} style={styles.expiringCard}>
                <Text style={styles.expiringType}>{docTypeLabel(doc.docType)}</Text>
                <Text style={styles.expiringTitle} numberOfLines={2}>{doc.title}</Text>
                <View style={styles.expiringFoot}>
                  <Text style={styles.days}>{left !== null && left <= 0 ? 'Expired' : `${left} d`}</Text>
                  <Text style={type.caption}>{relativeTime(doc.expiresAt)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <AppCard style={{ marginBottom: spacing(2) }}>
          <Text style={[type.caption, { marginBottom: 0 }]}>Nothing near expiry in the next 30 days.</Text>
        </AppCard>
      )}

      <SectionHeader eyebrow="Recent activity" title="Latest additions" actionLabel="Vault" onAction={() => navigation.navigate('Documents')} />
      {d.recent.length ? (
        d.recent.map((doc) => (
          <FileTabCard key={String(doc.id)} doc={doc} onPress={() => navigation.navigate('DocumentDetail', { id: doc.id })} />
        ))
      ) : (
        <EmptyState
          variant="vault"
          title="The vault is empty"
          message="Seal your first document to start the ledger."
          actionLabel="Upload a document"
          onAction={() => navigation.navigate('UploadDocument')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  expiringCard: {
    width: 168,
    backgroundColor: palette.paper,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing(3),
    marginRight: spacing(2.5),
  },
  expiringType: { ...type.micro, fontSize: 9.5, marginBottom: spacing(1.5) },
  expiringTitle: { fontFamily: SERIF, fontSize: 15, fontWeight: '700', color: palette.ink, height: 40 },
  expiringFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing(1) },
  days: { fontFamily: SERIF, fontSize: 16, fontWeight: '700', color: palette.coral },
});

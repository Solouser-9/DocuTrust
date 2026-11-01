import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { NotificationsPresenter } from '../microservices/notifications/presenters';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import { relativeTime } from '../core/utils/formatters';
import Screen from '../components/Screen';
import SectionHeader from '../components/SectionHeader';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import EmptyState from '../components/EmptyState';

// Inbox with unread dots; taps deep-link through the notification type map.
export default function NotificationsScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new NotificationsPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load());
  const data = state.data || { items: [], unread: 0, hasMore: false };

  useEffect(() => {
    presenter.load();
    const unsub = navigation.addListener('focus', () => presenter.load());
    return unsub;
  }, [presenter, navigation]);

  return (
    <Screen
      title="Alerts"
      eyebrow={data.unread ? `${data.unread} unread` : 'All caught up'}
      loading={state.status === 'loading' && !data.items.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {state.status === 'empty' ? (
        <EmptyState variant="bell" title="A quiet bell" message="Expiry warnings, share activity and verification updates land here." />
      ) : state.status === 'error' ? (
        <EmptyState variant="bell" title="Could not load alerts" message={state.error} actionLabel="Try again" onAction={() => presenter.load()} />
      ) : (
        <View>
          <SectionHeader
            eyebrow="Inbox"
            title="Recent"
            actionLabel={data.unread ? 'Mark all read' : undefined}
            onAction={data.unread ? () => presenter.markAll() : undefined}
          />
          {data.items.map((item) => (
            <AppCard key={String(item.id)} onPress={() => presenter.open(item)} style={[styles.card, item.read && styles.read]}>
              <View style={styles.row}>
                {!item.read ? <View style={styles.dot} /> : <View style={styles.dotSpacer} />}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, item.read && styles.readText]}>{item.title}</Text>
                  {item.body ? <Text style={[type.caption, item.read && styles.readText]}>{item.body}</Text> : null}
                  <Text style={[type.micro, { marginTop: spacing(1), fontSize: 9.5 }]}>{relativeTime(item.createdAt)}</Text>
                </View>
              </View>
            </AppCard>
          ))}
          {data.hasMore ? (
            <AppButton label="Load older" variant="ghost" onPress={() => presenter.loadMore()} style={{ marginTop: spacing(2) }} />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing(2.5) },
  read: { opacity: 0.72 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.amber, marginTop: 5, marginRight: spacing(2) },
  dotSpacer: { width: 8, marginRight: spacing(2) },
  title: { fontSize: 14.5, fontWeight: '600', color: palette.ink },
  readText: { fontWeight: '400' },
});

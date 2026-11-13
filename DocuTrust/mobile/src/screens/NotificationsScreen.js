import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { NotificationsPresenter } from '../microservices/notifications/presenters';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import EmptyState from '../components/EmptyState';

export default function NotificationsScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new NotificationsPresenter(navigation));

  // FIXED: Safely handle missing data so it doesn't crash
  const notifications = state.data?.notifications || state.data?.items || [];

  useEffect(() => {
    presenter.load();
    const unsub = navigation.addListener('focus', () => presenter.load());
    return unsub;
  }, [presenter, navigation]);

  return (
      <Screen title="Alerts" eyebrow="Inbox" loading={state.status === 'loading' && !notifications.length}>
        {notifications.length === 0 ? (
            <EmptyState variant="vault" title="All caught up" message="You have no new notifications." />
        ) : (
            // FIXED: Safely map
            notifications.map((n) => (
                <AppCard key={String(n.id)} style={styles.card}>
                  <Text style={styles.title}>{n.title}</Text>
                  <Text style={styles.body}>{n.body}</Text>
                </AppCard>
            ))
        )}
      </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing(2.5), padding: spacing(3) },
  title: { ...type.body, fontWeight: '700', marginBottom: spacing(1) },
  body: { ...type.caption },
});
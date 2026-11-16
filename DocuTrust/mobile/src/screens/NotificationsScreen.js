import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
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

  // Unread count from the server's meta.unreadCount; drives the Mark-all-read pill.
  const unread = state.data?.unread || 0;
  const markAllBtn = notifications.length > 0 && unread > 0 ? (
      <TouchableOpacity
          style={styles.markAllBtn}
          onPress={() => presenter.markAll()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.markAllText}>Mark all read ({unread})</Text>
      </TouchableOpacity>
  ) : null;

  return (
      <Screen
          title="Alerts"
          eyebrow="Inbox"
          headerRight={markAllBtn}
          loading={state.status === 'loading' && !notifications.length}
      >
        {notifications.length === 0 ? (
            <EmptyState variant="vault" title="All caught up" message="You have no new notifications." />
        ) : (
            // FIXED: Safely map
            notifications.map((n) => (
                <AppCard
                    key={String(n.id)}
                    style={styles.card}
                    onPress={() => presenter.open(n).then(() => presenter.load())}
                >
                  <Text style={[styles.title, n.read && styles.titleRead]}>{n.title}</Text>
                  <Text style={styles.body}>{n.body}</Text>
                </AppCard>
            ))
        )}
      </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing(2.5), padding: spacing(3) },
  markAllBtn: {
    backgroundColor: palette.cream,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 999,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.25),
    marginLeft: spacing(2),
  },
  markAllText: { ...type.micro, color: palette.amberText, fontWeight: '700' },
  title: { ...type.body, fontWeight: '700', marginBottom: spacing(1) },
  titleRead: { opacity: 0.55 },
  body: { ...type.caption },
});
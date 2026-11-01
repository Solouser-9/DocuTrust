import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { AdminQueuePresenter } from '../microservices/admin/presenters';
import { QUEUE_FILTERS } from '../microservices/admin/model';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import { relativeTime } from '../core/utils/formatters';
import Screen from '../components/Screen';
import Chip from '../components/Chip';
import AppCard from '../components/AppCard';
import StampBadge from '../components/StampBadge';
import EmptyState from '../components/EmptyState';

export default function AdminReviewQueueScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new AdminQueuePresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load());
  const items = (state.data && state.data.items) || [];
  const status = (state.data && state.data.status) || 'pending';

  useEffect(() => {
    presenter.load();
    const unsub = navigation.addListener('focus', () => presenter.load());
    return unsub;
  }, [presenter, navigation]);

  return (
    <Screen
      title="Review queue"
      eyebrow="Sensitive documents"
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !items.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={styles.chipRow}>
        {QUEUE_FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} active={status === f.value} onPress={() => presenter.setStatus(f.value)} />
        ))}
      </View>

      {state.status === 'empty' ? (
        <EmptyState variant="check" title="Queue is clear" message={`No ${status} reviews right now.`} />
      ) : state.status === 'error' ? (
        <EmptyState variant="vault" title="Queue unavailable" message={state.error} actionLabel="Try again" onAction={() => presenter.load()} />
      ) : (
        items.map((review) => (
          <AppCard key={String(review.id)} onPress={() => navigation.navigate('AdminReviewDetail', { id: review.id })} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.title} numberOfLines={1}>{review.targetTitle || review.documentTitle || 'Document review'}</Text>
              <StampBadge status={review.status} small />
            </View>
            <Text style={type.caption}>
              {/* H-3: server field is submitterEmail (ownerName/ownerEmail never existed) */}
              {review.targetType ? `${review.targetType} · ` : ''}Owner {review.submitterEmail || '—'} · {relativeTime(review.createdAt)}
            </Text>
            {review.reason ? <Text style={[type.caption, { marginTop: spacing(1) }]}>{review.reason}</Text> : null}
          </AppCard>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(2) },
  card: { marginBottom: spacing(2.5) },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1.5) },
  title: { fontFamily: 'Georgia', fontSize: 16, fontWeight: '700', color: palette.ink, flex: 1, marginRight: spacing(2) },
});

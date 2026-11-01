import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { SharesPresenter } from '../microservices/sharing/presenters';
import { shareStatus } from '../microservices/sharing/model';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import { relativeTime } from '../core/utils/formatters';
import Screen from '../components/Screen';
import SegmentedTabs from '../components/SegmentedTabs';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import StampBadge from '../components/StampBadge';
import EmptyState from '../components/EmptyState';

const TABS = [
  { value: 'mine', label: 'My links' },
  { value: 'incoming', label: 'Incoming' },
];

export default function SharesScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new SharesPresenter(navigation));
  const tab = (state.data && state.data.tab) || 'mine';
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load(tab));
  const items = (state.data && state.data.items) || [];
  const incoming = (state.data && state.data.incoming) || [];

  useEffect(() => {
    presenter.load('mine');
    const unsub = navigation.addListener('focus', () => presenter.load(tab));
    return unsub;
  }, [presenter, navigation]);

  return (
    <Screen
      title="Shares"
      eyebrow="Sealed links under your control"
      loading={state.status === 'loading' && !items.length && !incoming.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <SegmentedTabs options={TABS} value={tab} onChange={(v) => presenter.load(v)} style={{ marginBottom: spacing(4) }} />

      {tab === 'mine' ? (
        state.status === 'empty' ? (
          <EmptyState
            variant="share"
            title="No shares yet"
            message="Share a document with a sealed link — view-only or downloadable, expiring on your terms."
            actionLabel="Create share"
            onAction={() => navigation.navigate('CreateShare')}
          />
        ) : (
          <View>
            {items.map((share) => {
              const status = shareStatus(share);
              return (
                <AppCard key={String(share.id)} onPress={() => navigation.navigate('ShareDetail', { id: share.id })} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.title} numberOfLines={1}>{share.documentTitle || share.title || 'Document'}</Text>
                    <StampBadge status={status} small />
                  </View>
                  <Text style={type.caption}>
                    {share.permission === 'download' ? 'View + download' : 'View only'} · {relativeTime(share.expiresAt)} · {share.viewCount || 0}
                    {share.maxViews ? `/${share.maxViews}` : ''} views
                  </Text>
                </AppCard>
              );
            })}
            <AppButton label="Create share" variant="amber" onPress={() => navigation.navigate('CreateShare')} style={{ marginTop: spacing(2) }} />
          </View>
        )
      ) : state.status === 'empty' ? (
        <EmptyState variant="share" title="No incoming shares" message="When someone shares a document directly with you, it appears here." />
      ) : (
        incoming.map((share) => (
          <AppCard key={String(share.id)} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.title} numberOfLines={1}>{share.documentTitle || share.title || 'Document'}</Text>
              <StampBadge status={share.permission === 'download' ? 'approved' : 'info'} label={share.permission === 'download' ? 'Download' : 'View'} small />
            </View>
            <Text style={type.caption}>From {share.ownerName || 'a member'} · {relativeTime(share.createdAt)}</Text>
          </AppCard>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing(2.5) },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1.5) },
  title: { fontFamily: 'Georgia', fontSize: 16, fontWeight: '700', color: palette.ink, flex: 1, marginRight: spacing(2) },
});

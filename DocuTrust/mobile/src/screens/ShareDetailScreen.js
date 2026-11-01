import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { mono, type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { ShareDetailPresenter } from '../microservices/sharing/presenters';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import { formatDateTime, relativeTime, shortHash } from '../core/utils/formatters';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import StampBadge from '../components/StampBadge';
import ListItem from '../components/ListItem';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';

export default function ShareDetailScreen({ navigation, route }) {
  const id = (route && route.params && route.params.id) || null;
  const [state, presenter] = usePresenter(() => new ShareDetailPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load(id));
  const [confirm, setConfirm] = useState(null); // 'revoke' | 'remove'
  const data = state.data || {};
  const share = data.share;
  const stats = data.stats || {};

  useEffect(() => {
    presenter.load(id);
  }, [presenter, id]);

  if (state.status === 'empty') {
    return (
      <Screen title="Share" onBack={() => navigation.goBack()}>
        <EmptyState variant="share" title="Share not found" message="It may have been deleted." />
      </Screen>
    );
  }

  return (
    <Screen
      title="Share detail"
      eyebrow={share ? share.documentTitle || share.title : ''}
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !share}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {share ? (
        <View>
          <AppCard>
            <View style={styles.headRow}>
              <Text style={styles.title}>{share.documentTitle || share.title || 'Document'}</Text>
              <StampBadge status={data.status || 'active'} />
            </View>
            <Text style={type.caption}>
              {share.permission === 'download' ? 'View + download' : 'View only'} · expires {relativeTime(share.expiresAt)}
            </Text>
          </AppCard>

          <AppCard style={{ marginTop: spacing(3) }}>
            <Text style={styles.eyebrow}>The link token</Text>
            {/* H-3: server field is linkToken (share.token never existed) */}
            <Text style={styles.token} numberOfLines={2}>{share.linkToken || '—'}</Text>
            <AppButton label="Copy token" variant="ghost" small onPress={() => presenter.copyLink(share)} style={{ alignSelf: 'flex-start' }} />
            <Text style={[type.caption, { marginTop: spacing(2) }]}>Anyone with this token can open the share at /api/public/shares/&lt;token&gt;.</Text>
          </AppCard>

          <AppCard style={{ marginTop: spacing(3), padding: 0 }}>
            <ListItem title="Views" value right={<Text style={styles.statNum}>{String(stats.viewCount !== undefined ? stats.viewCount : share.viewCount || 0)}</Text>} />
            <ListItem title="View limit" value right={<Text style={type.caption}>{share.maxViews ? `${share.maxViews} max` : 'Unlimited'}</Text>} />
            <ListItem title="Passcode" value right={<Text style={type.caption}>{share.passcodeRequired ? 'Required' : share.passcode ? 'Set' : 'None'}</Text>} />
            <ListItem title="Last opened" value right={<Text style={type.caption}>{stats.lastViewedAt ? relativeTime(stats.lastViewedAt) : 'Never'}</Text>} last />
          </AppCard>

          {stats.history && stats.history.length ? (
            <AppCard style={{ marginTop: spacing(3) }}>
              <Text style={styles.eyebrow}>Recent opens</Text>
              {stats.history.slice(0, 5).map((h, i) => (
                <ListItem key={String(i)} title={h.action || 'Opened'} value right={<Text style={type.caption}>{relativeTime(h.createdAt)}</Text>} last={i === Math.min(4, stats.history.length - 1)} />
              ))}
            </AppCard>
          ) : null}

          {data.status !== 'revoked' ? (
            <AppButton label="Revoke now" variant="coral" onPress={() => setConfirm('revoke')} style={{ marginTop: spacing(4) }} />
          ) : null}
          <AppButton label="Delete share record" variant="ghost" onPress={() => setConfirm('remove')} style={{ marginTop: spacing(2.5) }} />
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirm === 'revoke'}
        title="Revoke this share?"
        message="Openers are refused immediately with SHARE_REVOKED. This cannot be undone."
        confirmLabel="Revoke"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          presenter.revoke();
        }}
      />
      <ConfirmDialog
        visible={confirm === 'remove'}
        title="Delete share record?"
        message="Removes the share from your ledger. Existing link rules stop applying."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          presenter.remove();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1.5) },
  title: { fontFamily: 'Georgia', fontSize: 18, fontWeight: '700', color: palette.ink, flex: 1, marginRight: spacing(2) },
  eyebrow: { ...type.micro, marginBottom: spacing(2) },
  token: { ...mono, backgroundColor: palette.cream, borderRadius: 8, padding: spacing(2.5), marginBottom: spacing(2.5) },
  statNum: { fontFamily: 'Georgia', fontSize: 16, fontWeight: '700', color: palette.ink },
});

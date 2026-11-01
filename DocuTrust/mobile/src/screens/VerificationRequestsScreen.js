import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { VerificationListPresenter } from '../microservices/verification/presenters';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import { relativeTime } from '../core/utils/formatters';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import StampBadge from '../components/StampBadge';
import EmptyState from '../components/EmptyState';

export default function VerificationRequestsScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new VerificationListPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load());
  const items = (state.data && state.data.items) || [];

  useEffect(() => {
    presenter.load();
    const unsub = navigation.addListener('focus', () => presenter.load());
    return unsub;
  }, [presenter, navigation]);

  return (
    <Screen
      title="Verification"
      eyebrow="Proofs you have minted"
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !items.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {state.status === 'empty' ? (
        <EmptyState
          variant="check"
          title="No verification requests"
          message="Mint a sealed proof for a document and approve it — then anyone with the link can verify it."
          actionLabel="New request"
          onAction={() => navigation.navigate('CreateVerification')}
        />
      ) : (
        <View>
          {items.map((request) => (
            <AppCard key={String(request.id)} onPress={() => navigation.navigate('VerificationDetail', { id: request.id })} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.title} numberOfLines={1}>{request.documentTitle || request.verifierName || 'Request'}</Text>
                <StampBadge status={request.status} small />
              </View>
              <Text style={type.caption}>
                For {request.verifierName}{request.verifierOrg ? ` · ${request.verifierOrg}` : ''} · {relativeTime(request.createdAt)}
              </Text>
            </AppCard>
          ))}
          <AppButton label="New verification request" variant="amber" onPress={() => navigation.navigate('CreateVerification')} style={{ marginTop: spacing(2) }} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing(2.5) },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1.5) },
  title: { fontFamily: 'Georgia', fontSize: 16, fontWeight: '700', color: palette.ink, flex: 1, marginRight: spacing(2) },
});

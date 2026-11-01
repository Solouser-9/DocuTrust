import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { mono, type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { VerificationDetailPresenter } from '../microservices/verification/presenters';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import { formatDate, shortHash } from '../core/utils/formatters';
import { docTypeLabel } from '../microservices/documents/model';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import StampBadge from '../components/StampBadge';
import ListItem from '../components/ListItem';
import EmptyState from '../components/EmptyState';

export default function VerificationDetailScreen({ navigation, route }) {
  const id = (route && route.params && route.params.id) || null;
  const [state, presenter] = usePresenter(() => new VerificationDetailPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load(id));
  const request = state.data && state.data.request;

  useEffect(() => {
    presenter.load(id);
  }, [presenter, id]);

  if (state.status === 'empty') {
    return (
      <Screen title="Verification" onBack={() => navigation.goBack()}>
        <EmptyState variant="check" title="Request not found" message="It may have been removed." />
      </Screen>
    );
  }

  return (
    <Screen
      title="Verification"
      eyebrow={request ? `For ${request.verifierName}` : ''}
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !request}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {request ? (
        <View>
          <AppCard>
            <View style={styles.headRow}>
              <Text style={styles.title}>{request.documentTitle || 'Document'}</Text>
              <StampBadge status={request.status} />
            </View>
            <Text style={type.caption}>
              {request.purpose}
              {request.verifierOrg ? ` · ${request.verifierOrg}` : ''}
            </Text>
            {request.status === 'pending' ? (
              <Text style={[type.caption, { marginTop: spacing(2), color: palette.ink }]}>
                Approve below to activate the proof link. Until then nobody can verify anything.
              </Text>
            ) : null}
          </AppCard>

          <AppCard style={{ marginTop: spacing(3), padding: 0 }}>
            <ListItem title="Requested" value right={<Text style={type.caption}>{formatDate(request.createdAt)}</Text>} />
            <ListItem title="Expires" value right={<Text style={type.caption}>{request.expiresAt ? formatDate(request.expiresAt) : '—'}</Text>} />
            <ListItem title="Document type" value right={<Text style={type.caption}>{docTypeLabel(request.docType)}</Text>} last />
          </AppCard>

          {state.data.link ? (
            <AppCard style={{ marginTop: spacing(3) }}>
              <Text style={styles.eyebrow}>Public proof link</Text>
              <Text style={styles.link} numberOfLines={3}>{state.data.link}</Text>
              <AppButton label="Copy link" variant="ghost" small onPress={() => presenter.copyLink()} style={{ alignSelf: 'flex-start' }} />
              <Text style={[type.caption, { marginTop: spacing(2) }]}>
                This URL is also the crawler-friendly HTML page — search engines see Open Graph and JSON-LD there.
              </Text>
            </AppCard>
          ) : null}

          {request.sha256 ? (
            <AppCard style={{ marginTop: spacing(3) }}>
              <Text style={styles.eyebrow}>Sealed fingerprint</Text>
              <Text style={styles.hash}>{shortHash(request.sha256)}</Text>
            </AppCard>
          ) : null}

          {request.status === 'pending' ? (
            <View style={styles.actions}>
              <AppButton label="Approve" variant="amber" onPress={() => presenter.decide('approved')} style={{ flex: 1 }} />
              <AppButton label="Reject" variant="coral" onPress={() => presenter.decide('rejected')} style={{ flex: 1, marginLeft: spacing(2.5) }} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1.5) },
  title: { fontFamily: 'Georgia', fontSize: 18, fontWeight: '700', color: palette.ink, flex: 1, marginRight: spacing(2) },
  eyebrow: { ...type.micro, marginBottom: spacing(2) },
  link: { ...mono, fontSize: 11.5, backgroundColor: palette.cream, borderRadius: 8, padding: spacing(2.5), marginBottom: spacing(2.5) },
  hash: { ...mono },
  actions: { flexDirection: 'row', marginTop: spacing(4) },
});

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { AdminDocumentsPresenter } from '../microservices/admin/presenters';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import { relativeTime } from '../core/utils/formatters';
import Screen from '../components/Screen';
import SearchBar from '../components/SearchBar';
import AppButton from '../components/AppButton';
import FileTabCard from '../components/FileTabCard';
import StampBadge from '../components/StampBadge';
import EmptyState from '../components/EmptyState';

// Registrar ledger: every document on the platform, strictly read-only.
export default function AdminDocumentsScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new AdminDocumentsPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load());
  const [term, setTerm] = useState('');
  const items = (state.data && state.data.items) || [];
  const hasMore = !!(state.data && state.data.hasMore);

  useEffect(() => {
    presenter.load();
    const unsub = navigation.addListener('focus', () => presenter.load());
    return unsub;
  }, [presenter, navigation]);

  const ownerLabel = (doc) => doc.ownerName || doc.ownerEmail || (doc.ownerId ? `Owner ${doc.ownerId}` : 'Owner —');

  return (
    <Screen
      title="Platform documents"
      eyebrow={`${items.length} seal${items.length === 1 ? '' : 's'} on record`}
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !items.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <SearchBar
        value={term}
        onChangeText={setTerm}
        onSubmit={() => presenter.setSearch(term.trim())}
        placeholder="Search every vault by title"
        style={{ marginBottom: spacing(3) }}
      />

      {state.status === 'empty' ? (
        <EmptyState variant="folder" title="No documents match" message="Try a different title — the ledger holds every seal on the platform." />
      ) : state.status === 'error' ? (
        <EmptyState variant="vault" title="Ledger unavailable" message={state.error} actionLabel="Try again" onAction={() => presenter.load()} />
      ) : (
        items.map((doc) => (
          <FileTabCard
            key={String(doc.id)}
            doc={doc}
            meta={`${ownerLabel(doc)} · ${relativeTime(doc.updatedAt || doc.createdAt)}`}
            right={<StampBadge status={doc.status} small />}
          />
        ))
      )}

      {hasMore ? (
        <AppButton label="Load more" variant="ghost" loading={state.status === 'loading'} onPress={() => presenter.loadMore()} style={{ marginTop: spacing(2) }} />
      ) : null}

      <Text style={[type.caption, { marginTop: spacing(3) }]}>
        Read-only ledger. Stewardship stays with each owner; registrars observe but never touch.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: { marginBottom: spacing(2.5) },
});

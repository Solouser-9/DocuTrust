import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { DocumentsListPresenter } from '../microservices/documents/presenters';
import { STATUS_FILTERS, DOC_TYPES } from '../microservices/documents/model';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import Screen from '../components/Screen';
import Chip from '../components/Chip';
import FileTabCard from '../components/FileTabCard';
import EmptyState from '../components/EmptyState';
import AppButton from '../components/AppButton';

// Vault list: search, three filter axes (status / type / folder), pagination.
export default function DocumentsScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new DocumentsListPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.refresh());
  const [filters, setFilters] = useState(presenter.filters);
  const data = state.data || { items: [], total: 0, hasMore: false, folders: [] };

  useEffect(() => {
    presenter.load();
    const unsub = navigation.addListener('focus', () => presenter.refresh());
    return unsub;
  }, [presenter, navigation]);

  const setFilter = (key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    presenter.setFilter(key, value);
  };

  const folders = data.folders || [];
  const folderName = (id) => {
    const f = folders.find((x) => String(x.id) === String(id));
    return f ? f.name : 'Folder';
  };

  return (
    <Screen
      title="The Vault"
      eyebrow={`${data.total} document${data.total === 1 ? '' : 's'} under seal`}
      loading={state.status === 'loading' && !data.items.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={styles.searchWrap}>
        <Chip label="Search titles" onPress={() => navigation.navigate('Search')} />
        <Chip label="Folders" onPress={() => navigation.navigate('Folders')} />
        <Chip label="Trash" onPress={() => navigation.navigate('Trash')} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingRight: spacing(4) }}>
        {STATUS_FILTERS.map((f) => (
          <Chip key={f.value || 'all'} label={f.label} active={(filters.status || '') === f.value} onPress={() => setFilter('status')(f.value)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingRight: spacing(4) }}>
        <Chip label="All types" active={!filters.type} onPress={() => setFilter('type')('')} />
        {DOC_TYPES.slice(0, 8).map((t) => (
          <Chip key={t.value} label={t.label} active={filters.type === t.value} onPress={() => setFilter('type')(t.value)} />
        ))}
      </ScrollView>
      {folders.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingRight: spacing(4) }}>
          <Chip label="No folder" active={!filters.folder} onPress={() => setFilter('folder')('')} />
          {folders.map((f) => (
            <Chip key={String(f.id)} label={f.name} active={String(filters.folder) === String(f.id)} onPress={() => setFilter('folder')(String(f.id))} />
          ))}
        </ScrollView>
      ) : null}

      {state.status === 'error' ? (
        <EmptyState variant="vault" title="Could not open the vault" message={state.error} actionLabel="Try again" onAction={() => presenter.load()} />
      ) : state.status === 'empty' ? (
        <EmptyState
          variant="folder"
          title="No documents match"
          message={filters.status || filters.type || filters.folder ? 'Loosen a filter to see more.' : 'Seal your first document.'}
          actionLabel="Upload document"
          onAction={() => navigation.navigate('UploadDocument')}
        />
      ) : (
        data.items.map((doc) => (
          <FileTabCard
            key={String(doc.id)}
            doc={doc}
            onPress={() => navigation.navigate('DocumentDetail', { id: doc.id })}
            meta={`${relativeLabel(doc)} · ${folderName(doc.folderId)}`}
          />
        ))
      )}

      {data.hasMore ? (
        <AppButton label={`Load more (${data.total - data.items.length} left)`} variant="ghost" loading={state.status === 'loading'} onPress={() => presenter.loadMore()} style={{ marginTop: spacing(2) }} />
      ) : null}
    </Screen>
  );
}

function relativeLabel(doc) {
  if (doc.status === 'pending_review') return 'Awaiting review';
  if (doc.daysLeft !== null && doc.daysLeft !== undefined && doc.daysLeft <= 30) return `${doc.daysLeft} d to expiry`;
  return 'Active';
}

const styles = StyleSheet.create({
  searchWrap: { flexDirection: 'row', marginBottom: spacing(3) },
  chipRow: { marginBottom: spacing(2.5), marginLeft: -spacing(4) },
  chipRowInner: { paddingHorizontal: spacing(4) },
});

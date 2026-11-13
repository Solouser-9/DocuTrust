import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { usePresenter } from '../mvp/usePresenter';
import { DocumentsListPresenter } from '../microservices/documents/presenters';
import { STATUS_FILTERS, DOC_TYPES } from '../microservices/documents/model';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import Screen from '../components/Screen';
import Chip from '../components/Chip';
import FileTabCard from '../components/FileTabCard';
import EmptyState from '../components/EmptyState';
import AppButton from '../components/AppButton';

export default function DocumentsScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new DocumentsListPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.refresh());
  const [filters, setFilters] = useState(presenter.filters);

  // FIXED: Safely handle missing data
  const data = state.data || {};
  const items = data.items || [];
  const folders = data.folders || [];

  useEffect(() => {
    presenter.load();
    const unsub = navigation.addListener('focus', () => presenter.refresh());
    return unsub;
  }, [presenter, navigation]);

  const setFilter = (key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    presenter.setFilter(key, value);
  };

  const folderName = (id) => {
    const f = folders.find((x) => String(x.id) === String(id));
    return f ? f.name : 'Folder';
  };

  return (
      <Screen
          title="The Vault"
          eyebrow={`${data.total || 0} document${data.total === 1 ? '' : 's'} under seal`}
          loading={state.status === 'loading' && !items.length}
          refreshing={refreshing}
          onRefresh={onRefresh}
      >
        <View style={styles.searchWrap}>
          <Chip label="Search titles" onPress={() => navigation.navigate('Search')} />
          <Chip label="Folders" onPress={() => navigation.navigate('Folders')} />
          <Chip label="Trash" onPress={() => navigation.navigate('Trash')} />
        </View>

        <View style={styles.chipRow}>
          {STATUS_FILTERS.map((f) => (
              <Chip key={f.value || 'all'} label={f.label} active={(filters.status || '') === f.value} onPress={() => setFilter('status')(f.value)} />
          ))}
        </View>

        <View style={styles.chipRow}>
          <Chip label="All types" active={!filters.type} onPress={() => setFilter('type')('')} />
          {DOC_TYPES.slice(0, 8).map((t) => (
              <Chip key={t.value} label={t.label} active={filters.type === t.value} onPress={() => setFilter('type')(t.value)} />
          ))}
        </View>

        {folders.length ? (
            <View style={styles.chipRow}>
              <Chip label="No folder" active={!filters.folder} onPress={() => setFilter('folder')('')} />
              {folders.map((f) => (
                  <Chip key={String(f.id)} label={f.name} active={String(filters.folder) === String(f.id)} onPress={() => setFilter('folder')(String(f.id))} />
              ))}
            </View>
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
            // FIXED: Safely map over items
            items.map((doc) => (
                <FileTabCard
                    key={String(doc.id)}
                    doc={doc}
                    onPress={() => navigation.navigate('DocumentDetail', { id: doc.id })}
                    meta={`${relativeLabel(doc)} · ${folderName(doc.folderId)}`}
                />
            ))
        )}

        {data.hasMore ? (
            <AppButton label={`Load more (${(data.total || 0) - items.length} left)`} variant="ghost" loading={state.status === 'loading'} onPress={() => presenter.loadMore()} style={{ marginTop: spacing(2) }} />
        ) : null}

        <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate('UploadDocument')}
            activeOpacity={0.8}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </Screen>
  );
}

function relativeLabel(doc) {
  if (doc.status === 'pending_review') return 'Awaiting review';
  if (doc.daysLeft !== null && doc.daysLeft !== undefined && doc.daysLeft <= 30) return `${doc.daysLeft} d to expiry`;
  return 'Active';
}

const styles = StyleSheet.create({
  searchWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginBottom: spacing(3) },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginBottom: spacing(3) },
  fab: {
    position: 'absolute',
    bottom: spacing(6),
    right: spacing(4),
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.amber,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  fabText: {
    fontSize: 28,
    color: palette.ink,
    fontWeight: '300',
    marginTop: -2,
  },
});
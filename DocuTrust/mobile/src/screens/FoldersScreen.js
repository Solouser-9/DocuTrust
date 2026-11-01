import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { FoldersPresenter } from '../microservices/folders/presenters';
import { countOf } from '../microservices/folders/model';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import AppCard from '../components/AppCard';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { SERIF } from '../core/theme/typography';

// Grid of folder cards with serif doc counts and an inline create dialog.
export default function FoldersScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new FoldersPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load());
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const items = (state.data && state.data.items) || [];

  useEffect(() => {
    presenter.load();
  }, [presenter]);

  const create = async () => {
    const ok = await presenter.create(name);
    if (ok) {
      setName('');
      setCreating(false);
    }
  };

  return (
    <Screen
      title="Folders"
      eyebrow={`${items.length} drawer${items.length === 1 ? '' : 's'}`}
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !items.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {state.status === 'empty' ? (
        <EmptyState variant="folder" title="No folders yet" message="Group documents by purpose — travel, property, health." actionLabel="Create folder" onAction={() => setCreating(true)} />
      ) : (
        <View style={styles.grid}>
          {items.map((f) => (
            <AppCard key={String(f.id)} onPress={() => navigation.navigate('FolderDetail', { id: f.id })} style={styles.folderCard}>
              <Text style={styles.count}>{String(countOf(f))}</Text>
              <Text style={styles.folderName} numberOfLines={1}>{f.name}</Text>
            </AppCard>
          ))}
        </View>
      )}

      <AppButton label="Create folder" variant="amber" onPress={() => setCreating(true)} style={{ marginTop: spacing(3) }} />

      <ConfirmDialog
        visible={creating}
        title="New folder"
        message="One level deep, unique per owner — like a well-kept drawer."
        confirmLabel="Create"
        cancelLabel="Discard"
        onCancel={() => {
          setCreating(false);
          setName('');
        }}
        onConfirm={create}
        extra={
          <View style={{ marginTop: spacing(2) }}>
            <AppInput label="Folder name" value={name} onChangeText={setName} error={(state.fieldErrors && state.fieldErrors.name) || null} placeholder="Travel documents" autoFocus />
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  folderCard: { width: '48%', marginBottom: spacing(2.5), padding: spacing(3.5) },
  count: { fontFamily: SERIF, fontSize: 28, fontWeight: '700', color: palette.amber },
  folderName: { fontSize: 14.5, fontWeight: '600', color: palette.ink, marginTop: spacing(1) },
});

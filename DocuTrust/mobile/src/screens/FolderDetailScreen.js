import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { FolderDetailPresenter } from '../microservices/folders/presenters';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import FileTabCard from '../components/FileTabCard';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';

export default function FolderDetailScreen({ navigation, route }) {
  const id = (route && route.params && route.params.id) || null;
  const [state, presenter] = usePresenter(() => new FolderDetailPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load(id));
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const data = state.data || { folder: null, items: [] };
  const folder = data.folder;

  useEffect(() => {
    presenter.load(id);
  }, [presenter, id]);

  return (
    <Screen
      title={folder ? folder.name : 'Folder'}
      eyebrow={`${(data.items || []).length} document${(data.items || []).length === 1 ? '' : 's'}`}
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !data.items.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {(data.items || []).length ? (
        data.items.map((doc) => <FileTabCard key={String(doc.id)} doc={doc} onPress={() => navigation.navigate('DocumentDetail', { id: doc.id })} />)
      ) : (
        <EmptyState variant="folder" title="Empty drawer" message="Move documents here from their detail page." actionLabel="Upload here" onAction={() => navigation.navigate('UploadDocument')} />
      )}

      {folder ? (
        <AppCard style={{ marginTop: spacing(3) }}>
          <Text style={styles.eyebrow}>Housekeeping</Text>
          <View style={styles.row}>
            <AppButton label="Rename" variant="ghost" small onPress={() => {
              setName(folder.name);
              setRenaming(true);
            }} style={{ flex: 1 }} />
            <AppButton label="Delete folder" variant="coral" small onPress={() => setConfirmDelete(true)} style={{ flex: 1, marginLeft: spacing(2.5) }} />
          </View>
          <Text style={[type.caption, { marginTop: spacing(2) }]}>Deleting the folder keeps every document — they simply become loose.</Text>
        </AppCard>
      ) : null}

      <ConfirmDialog
        visible={renaming}
        title="Rename folder"
        confirmLabel="Rename"
        cancelLabel="Keep as is"
        onCancel={() => setRenaming(false)}
        onConfirm={async () => {
          const ok = await presenter.rename(name);
          if (ok) setRenaming(false);
        }}
        extra={
          <View style={{ marginTop: spacing(2) }}>
            <Text style={styles.eyebrow}>Folder name</Text>
            <AppInput label="" value={name} onChangeText={setName} />
          </View>
        }
      />

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this folder?"
        message="Documents inside are kept and unassigned. This cannot be undone."
        confirmLabel="Delete folder"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          presenter.remove();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.micro, marginBottom: spacing(2) },
  row: { flexDirection: 'row' },
});

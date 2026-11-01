import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { HistoryPresenter } from '../microservices/documents/presenters';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import Screen from '../components/Screen';
import Timeline from '../components/Timeline';
import EmptyState from '../components/EmptyState';

// Append-only document ledger, rendered as the vertical timeline.
export default function HistoryScreen({ navigation, route }) {
  const id = (route && route.params && route.params.id) || null;
  const [state, presenter] = usePresenter(() => new HistoryPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load(id));
  const items = (state.data && state.data.items) || [];

  useEffect(() => {
    presenter.load(id);
  }, [presenter, id]);

  return (
    <Screen
      title="History"
      eyebrow="Append-only ledger"
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !items.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {state.status === 'empty' ? (
        <EmptyState variant="vault" title="Nothing recorded yet" message="Every open, edit and share is written here permanently." />
      ) : state.status === 'error' ? (
        <EmptyState variant="vault" title="Ledger unavailable" message={state.error} actionLabel="Try again" onAction={() => presenter.load(id)} />
      ) : (
        <View style={styles.ledger}>
          <Text style={styles.note}>Entries are written by the database itself — nobody, including you, can edit or remove them.</Text>
          <Timeline items={items} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ledger: { paddingTop: spacing(1) },
  note: { ...type.caption, marginBottom: spacing(4) },
});

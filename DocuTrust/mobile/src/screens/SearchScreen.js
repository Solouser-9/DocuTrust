import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { SearchPresenter } from '../microservices/documents/presenters';
import Screen from '../components/Screen';
import SearchBar from '../components/SearchBar';
import Chip from '../components/Chip';
import FileTabCard from '../components/FileTabCard';
import EmptyState from '../components/EmptyState';
import SectionHeader from '../components/SectionHeader';

// Live search with locally-remembered recent queries.
export default function SearchScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new SearchPresenter(navigation));
  const data = state.data || { recent: [], term: '', items: [] };

  useEffect(() => {
    presenter.loadRecent();
  }, [presenter]);

  return (
    <Screen title="Search" eyebrow="Full titles, instantly" onBack={() => navigation.goBack()}>
      <SearchBar
        value={data.term || ''}
        onChangeText={(t) => presenter.onTerm(t)}
        placeholder="Try “passport”"
        autoFocus
      />

      {!data.term && (data.recent || []).length ? (
        <View>
          <SectionHeader eyebrow="Recent searches" title="Pick up where you left off" />
          <View style={styles.chipWrap}>
            {data.recent.map((term) => (
              <Chip key={term} label={term} onPress={() => presenter.onTerm(term)} />
            ))}
          </View>
        </View>
      ) : null}

      {state.status === 'loading' ? null : state.status === 'empty' ? (
        <EmptyState variant="search" title={`Nothing for “${data.term}”`} message="Search matches document titles. Try fewer words." />
      ) : state.status === 'error' ? (
        <EmptyState variant="vault" title="Search failed" message={state.error} actionLabel="Try again" onAction={() => presenter.search()} />
      ) : (data.items || []).length ? (
        <View style={{ marginTop: spacing(3) }}>
          <Text style={styles.count}>{`Found ${(data.items || []).length} document${(data.items || []).length === 1 ? '' : 's'}`}</Text>
          {data.items.map((doc) => <FileTabCard key={String(doc.id)} doc={doc} onPress={() => navigation.navigate('DocumentDetail', { id: doc.id })} />)}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  count: { ...type.micro, marginBottom: spacing(2.5) },
});

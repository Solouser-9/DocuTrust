import React, { useEffect, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { mono, type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { VersionsPresenter } from '../microservices/documents/presenters';
import { formatBytes, formatDateTime, shortHash } from '../core/utils/formatters';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import StampBadge from '../components/StampBadge';
import EmptyState from '../components/EmptyState';

export default function VersionsScreen({ navigation, route }) {
  const id = (route && route.params && route.params.id) || null;
  const [state, presenter] = usePresenter(() => new VersionsPresenter(navigation));
  const data = state.data || { versions: [], doc: null };
  const versions = data.versions || [];

  useEffect(() => {
    presenter.load(id);
  }, [presenter, id]);

  const currentNumber = versions.length ? presenter.num(versions[0]) : 0;

  return (
    <Screen
      title="Versions"
      eyebrow={data.doc ? data.doc.title : ''}
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !versions.length}
    >
      {state.status === 'empty' ? (
        <EmptyState variant="vault" title="No versions yet" message="The first sealed file becomes version 1." />
      ) : (
        versions.map((v) => {
          const n = presenter.num(v);
          const isCurrent = n === currentNumber;
          return (
            <AppCard key={String(v.id)} style={{ marginBottom: spacing(2.5) }}>
              <View style={styles.rowTop}>
                <Text style={styles.version}>v{n}</Text>
                {isCurrent ? <StampBadge status="active" label="Current" /> : <StampBadge status="archived" label="Superseded" />}
              </View>
              <Text style={styles.hash}>{shortHash(v.sha256)}</Text>
              <Text style={type.caption}>
                {formatBytes(v.fileSize)} · {formatDateTime(v.createdAt)}
              </Text>
              {!isCurrent ? (
                <AppButton
                  label="Save copy"
                  variant="ghost"
                  small
                  loading={state.workingId === v.id}
                  onPress={() => presenter.downloadVersion(v)}
                  style={{ alignSelf: 'flex-start', marginTop: spacing(2.5) }}
                />
              ) : null}
            </AppCard>
          );
        })
      )}

      <AppCard style={{ marginTop: spacing(2) }}>
        <Text style={styles.eyebrow}>New version</Text>
        <Text style={type.caption}>Replaces the fingerprint. The old version is kept forever in this list.</Text>
        <AppButton
          label="Upload new version"
          variant="amber"
          loading={state.status === 'loading' && versions.length > 0}
          onPress={async () => {
            const result = await DocumentPicker.getDocumentAsync({
              copyToCacheDirectory: true,
              type: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            });
            presenter.uploadVersion(result);
          }}
          style={{ marginTop: spacing(3) }}
        />
        {state.status === 'error' ? <Text style={styles.error}>{state.error}</Text> : null}
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(2) },
  version: { fontFamily: 'Georgia', fontSize: 22, fontWeight: '700', color: palette.ink },
  hash: { ...mono, fontSize: 11.5, marginBottom: spacing(1) },
  eyebrow: { ...type.micro, marginBottom: spacing(1.5) },
  error: { color: palette.coral, fontSize: 12.5, marginTop: spacing(2) },
});

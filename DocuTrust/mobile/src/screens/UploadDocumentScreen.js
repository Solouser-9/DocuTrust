import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { UploadDocumentPresenter } from '../microservices/documents/presenters';
import { DOC_TYPES, REMINDER_CHOICES } from '../microservices/documents/model';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import AppCard from '../components/AppCard';
import Chip from '../components/Chip';
import ProgressBar from '../components/ProgressBar';
import SegmentedTabs from '../components/SegmentedTabs';
import EmptyState from '../components/EmptyState';

export default function UploadDocumentScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new UploadDocumentPresenter(navigation));
  const form = (state.data && state.data.form) || presenter.form;
  const folders = (state.data && state.data.folders) || presenter.folders;
  const file = (state.data && state.data.file) || null;

  useEffect(() => {
    presenter.load();
  }, [presenter]);

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });
    presenter.pick(result);
  };

  const change = (key) => (value) => presenter.setField(key, value);

  return (
    <Screen title="Seal a document" eyebrow="Upload" onBack={() => navigation.goBack()}>
      <AppCard>
        <Text style={styles.eyebrow}>The file</Text>
        {file ? (
          <View>
            <Text style={styles.fileName} numberOfLines={1}>{file.name || 'Selected file'}</Text>
            <Text style={type.caption}>{file.mimeType || 'Unknown type'}</Text>
          </View>
        ) : (
          <Text style={type.caption}>PDF, PNG, JPEG, WEBP, DOC or DOCX. Up to 25 MB.</Text>
        )}
        <AppButton label={file ? 'Choose a different file' : 'Choose file'} variant="ghost" small onPress={pick} style={{ alignSelf: 'flex-start', marginTop: spacing(2.5) }} />
        {state.fieldErrors.file ? <Text style={styles.error}>{state.fieldErrors.file}</Text> : null}
      </AppCard>

      <View style={{ marginTop: spacing(4) }}>
        <AppInput label="Title" value={form.title} onChangeText={change('title')} error={state.fieldErrors.title} placeholder="Passport — 2031 renewal" />
        <AppInput label="Description (optional)" value={form.description} onChangeText={change('description')} multiline error={state.fieldErrors.description} placeholder="Notes for future you." />
      </View>

      <Text style={styles.eyebrow}>Document type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingRight: spacing(4) }}>
        {DOC_TYPES.map((t) => (
          <Chip key={t.value} label={t.label} active={form.docType === t.value} onPress={() => change('docType')(t.value)} />
        ))}
      </ScrollView>

      <Text style={styles.eyebrow}>Folder (optional)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingRight: spacing(4) }}>
        <Chip label="No folder" active={!form.folderId} onPress={() => change('folderId')('')} />
        {folders.map((f) => (
          <Chip key={String(f.id)} label={f.name} active={String(form.folderId) === String(f.id)} onPress={() => change('folderId')(String(f.id))} />
        ))}
      </ScrollView>

      <AppInput label="Expiry date (optional)" value={form.expiresAt} onChangeText={change('expiresAt')} placeholder="2031-06-30" error={state.fieldErrors.expiresAt} hint="The real-world expiry printed on the document." />

      <Text style={styles.eyebrow}>Remind me before expiry</Text>
      <SegmentedTabs
        options={REMINDER_CHOICES.map((d) => ({ value: String(d), label: `${d} d` }))}
        value={String(form.reminderDays || 30)}
        onChange={(v) => change('reminderDays')(Number(v))}
        style={{ marginBottom: spacing(4) }}
      />

      {state.status === 'loading' ? (
        <View style={{ marginBottom: spacing(3) }}>
          <ProgressBar progress={state.progress || 0} />
          <Text style={[type.caption, { marginTop: spacing(1.5) }]}>Sealing… {Math.round((state.progress || 0) * 100)}%</Text>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <EmptyState variant="vault" title="Upload failed" message={state.error} actionLabel="Try again" onAction={() => presenter.submit()} style={{ paddingVertical: spacing(3) }} />
      ) : null}

      <AppButton label="Seal in the vault" variant="amber" loading={state.status === 'loading'} onPress={() => presenter.submit()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.micro, marginBottom: spacing(2) },
  fileName: { fontSize: 15, fontWeight: '600', color: palette.ink },
  chipRow: { marginBottom: spacing(4), marginLeft: -spacing(4) },
  error: { color: palette.coral, fontSize: 12.5, marginTop: spacing(1.5) },
});

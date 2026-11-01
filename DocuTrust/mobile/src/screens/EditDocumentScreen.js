import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { EditDocumentPresenter } from '../microservices/documents/presenters';
import { DOC_TYPES, REMINDER_CHOICES } from '../microservices/documents/model';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import Chip from '../components/Chip';
import SegmentedTabs from '../components/SegmentedTabs';

export default function EditDocumentScreen({ navigation, route }) {
  const id = (route && route.params && route.params.id) || null;
  const [state, presenter] = usePresenter(() => new EditDocumentPresenter(navigation));
  const data = state.data || {};
  const form = data.form || presenter.form;
  const folders = data.folders || [];

  useEffect(() => {
    presenter.load(id);
  }, [presenter, id]);

  const change = (key) => (value) => presenter.setField(key, value);

  return (
    <Screen title="Edit details" eyebrow="Metadata only" onBack={() => navigation.goBack()} loading={state.status === 'loading' && !data.doc}>
      <AppInput label="Title" value={form.title} onChangeText={change('title')} error={state.fieldErrors.title} />
      <AppInput label="Description" value={form.description} onChangeText={change('description')} multiline error={state.fieldErrors.description} />

      <Text style={styles.eyebrow}>Document type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingRight: spacing(4) }}>
        {DOC_TYPES.map((t) => (
          <Chip key={t.value} label={t.label} active={form.docType === t.value} onPress={() => change('docType')(t.value)} />
        ))}
      </ScrollView>

      <Text style={styles.eyebrow}>Folder</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingRight: spacing(4) }}>
        <Chip label="No folder" active={!form.folderId} onPress={() => change('folderId')('')} />
        {folders.map((f) => (
          <Chip key={String(f.id)} label={f.name} active={String(form.folderId) === String(f.id)} onPress={() => change('folderId')(String(f.id))} />
        ))}
      </ScrollView>

      <AppInput label="Expiry date" value={form.expiresAt} onChangeText={change('expiresAt')} placeholder="2031-06-30" error={state.fieldErrors.expiresAt} hint="Leave empty to remove the expiry." />

      <Text style={styles.eyebrow}>Reminder window</Text>
      <SegmentedTabs
        options={REMINDER_CHOICES.map((d) => ({ value: String(d), label: `${d} d` }))}
        value={String(form.reminderDays || 30)}
        onChange={(v) => change('reminderDays')(Number(v))}
        style={{ marginBottom: spacing(4) }}
      />

      {state.status === 'error' ? <Text style={styles.error}>{state.error}</Text> : null}
      <AppButton label="Save changes" variant="amber" loading={state.status === 'loading'} onPress={() => presenter.submit()} />
      <Text style={[type.caption, { marginTop: spacing(3) }]}>New bytes belong in a new version — see Versions on the document.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.micro, marginBottom: spacing(2) },
  chipRow: { marginBottom: spacing(4), marginLeft: -spacing(4) },
  error: { color: palette.coral, fontSize: 13, marginBottom: spacing(2) },
});

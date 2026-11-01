import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { VerificationCreatePresenter } from '../microservices/verification/presenters';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import Chip from '../components/Chip';
import SegmentedTabs from '../components/SegmentedTabs';
import EmptyState from '../components/EmptyState';

const WINDOWS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

export default function CreateVerificationScreen({ navigation, route }) {
  const preselect = (route && route.params && route.params.documentId) || '';
  const [state, presenter] = usePresenter(() => new VerificationCreatePresenter(navigation));
  const data = state.data || { docs: [], form: presenter.form };
  const form = data.form || presenter.form;

  useEffect(() => {
    presenter.load(preselect);
  }, [presenter, preselect]);

  const change = (key) => (value) => presenter.setField(key, value);

  return (
    <Screen title="Mint a proof" eyebrow="Verification request" onBack={() => navigation.goBack()}>
      {!(data.docs || []).length ? (
        <EmptyState variant="folder" title="No active documents" message="Verifications are minted from active documents only." />
      ) : (
        <View>
          <Text style={styles.eyebrow}>Which document?</Text>
          <View style={styles.chipWrap}>
            {data.docs.map((doc) => (
              <Chip key={String(doc.id)} label={doc.title} active={String(form.documentId) === String(doc.id)} onPress={() => change('documentId')(String(doc.id))} />
            ))}
          </View>
          {state.fieldErrors.documentId ? <Text style={styles.error}>{state.fieldErrors.documentId}</Text> : null}

          <AppInput label="Verifier name" value={form.verifierName} onChangeText={change('verifierName')} error={state.fieldErrors.verifierName} placeholder="Consulate officer" />
          <AppInput label="Verifier organisation (optional)" value={form.verifierOrg} onChangeText={change('verifierOrg')} error={state.fieldErrors.verifierOrg} placeholder="Embassy of… " />
          <AppInput label="Purpose" value={form.purpose} onChangeText={change('purpose')} multiline error={state.fieldErrors.purpose} placeholder="Visa application supporting documents" />

          <Text style={styles.eyebrow}>Link stays valid for</Text>
          <SegmentedTabs options={WINDOWS} value={String(form.expiresInDays || 30)} onChange={(v) => change('expiresInDays')(Number(v))} style={{ marginBottom: spacing(4) }} />

          {state.status === 'error' ? <Text style={styles.error}>{state.error}</Text> : null}
          <AppButton label="Create request" variant="amber" loading={state.status === 'loading'} onPress={() => presenter.submit()} />
          <Text style={[type.caption, { marginTop: spacing(3) }]}>
            Two steps by design: you create it, you approve it. The proof link only becomes live after your approval.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.micro, marginBottom: spacing(2) },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(3) },
  error: { color: palette.coral, fontSize: 12.5, marginBottom: spacing(2) },
});

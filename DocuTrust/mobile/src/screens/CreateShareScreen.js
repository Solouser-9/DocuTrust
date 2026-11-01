import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { ShareCreatePresenter } from '../microservices/sharing/presenters';
import { PERMISSIONS } from '../microservices/sharing/model';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import AppCard from '../components/AppCard';
import Chip from '../components/Chip';
import SegmentedTabs from '../components/SegmentedTabs';
import EmptyState from '../components/EmptyState';

const HOUR_STEPS = [
  { value: 'link', label: 'Sealed link' },
  { value: 'member', label: 'Share with member' },
];

function Stepper({ label, value, display, onStep }) {
  return (
    <View style={styles.stepperRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>{label}</Text>
        <Text style={styles.stepperValue}>{display}</Text>
      </View>
      <AppButton label="−" variant="ghost" small onPress={() => onStep(-1)} style={styles.stepBtn} />
      <AppButton label="+" variant="ghost" small onPress={() => onStep(1)} style={[styles.stepBtn, { marginLeft: spacing(2) }]} />
    </View>
  );
}

export default function CreateShareScreen({ navigation, route }) {
  const preselect = (route && route.params && route.params.documentId) || '';
  const [state, presenter] = usePresenter(() => new ShareCreatePresenter(navigation));
  const data = state.data || { docs: [], members: [], mode: 'link' };
  const form = data.form || presenter.form;
  const mode = data.mode || 'link';

  useEffect(() => {
    presenter.load(preselect);
  }, [presenter, preselect]);

  const change = (key) => (value) => presenter.setField(key, value);

  return (
    <Screen title="Create a share" eyebrow="Terms of release" onBack={() => navigation.goBack()}>
      {!(data.docs || []).length ? (
        <EmptyState variant="folder" title="Nothing to share yet" message="Only active documents can be shared. Upload one first." />
      ) : (
        <View>
          <Text style={styles.eyebrow}>Document</Text>
          <View style={styles.chipWrap}>
            {data.docs.map((doc) => (
              <Chip key={String(doc.id)} label={doc.title} active={String(form.documentId) === String(doc.id)} onPress={() => change('documentId')(String(doc.id))} />
            ))}
          </View>
          {state.fieldErrors.documentId ? <Text style={styles.error}>{state.fieldErrors.documentId}</Text> : null}

          <SegmentedTabs options={HOUR_STEPS} value={mode} onChange={(v) => presenter.setMode(v)} style={{ marginVertical: spacing(4) }} />

          <Text style={styles.eyebrow}>Permission</Text>
          <SegmentedTabs
            options={PERMISSIONS.map((p) => ({ value: p.value, label: p.label }))}
            value={form.permission}
            onChange={change('permission')}
            style={{ marginBottom: spacing(4) }}
          />

          {mode === 'link' ? (
            <View>
              <Stepper label="Expires in" value={form.expiresInHours} display={`${form.expiresInHours} h`} onStep={(s) => presenter.cycleHours(s)} />
              <Stepper label="View limit (0 = unlimited)" value={form.maxViews} display={form.maxViews > 0 ? `${form.maxViews} views max` : 'Unlimited'} onStep={(s) => presenter.cycleMaxViews(s)} />
              <AppInput label="Passcode (optional)" value={form.passcode} onChangeText={change('passcode')} error={state.fieldErrors.passcode} placeholder="Four characters or more" />
            </View>
          ) : (
            <View>
              <Text style={styles.eyebrow}>Member</Text>
              {(data.members || []).length ? (
                <View style={styles.chipWrap}>
                  {data.members.map((m) => (
                    <Chip key={String(m.id)} label={m.fullName || m.email} active={String(form.sharedWithUserId) === String(m.id)} onPress={() => change('sharedWithUserId')(String(m.id))} />
                  ))}
                </View>
              ) : (
                <AppCard><Text style={type.caption}>No members found. Direct shares need an organisation.</Text></AppCard>
              )}
              {state.fieldErrors.sharedWithUserId ? <Text style={styles.error}>{state.fieldErrors.sharedWithUserId}</Text> : null}
            </View>
          )}

          {state.status === 'error' ? <Text style={styles.error}>{state.error}</Text> : null}
          <AppButton label="Seal and share" variant="amber" loading={state.status === 'loading'} onPress={() => presenter.submit()} style={{ marginTop: spacing(2) }} />
          <Text style={[type.caption, { marginTop: spacing(3) }]}>
            Links die on schedule, on the view limit, or the instant you revoke — whichever comes first.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.micro, marginBottom: spacing(2) },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(3) },
  stepperRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing(4) },
  stepperValue: { fontFamily: 'Georgia', fontSize: 18, fontWeight: '700', color: palette.ink },
  stepBtn: { width: 44 },
  error: { color: palette.coral, fontSize: 12.5, marginBottom: spacing(2) },
});

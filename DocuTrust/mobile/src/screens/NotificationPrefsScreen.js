import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { NotificationPrefsPresenter } from '../microservices/notifications/presenters';
import { PREF_TOGGLES } from '../microservices/notifications/model';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';

export default function NotificationPrefsScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new NotificationPrefsPresenter(navigation));
  const settings = state.data && state.data.settings;

  useEffect(() => {
    presenter.load();
  }, [presenter]);

  return (
    <Screen title="Alert preferences" eyebrow="Who gets told, when" onBack={() => navigation.goBack()} loading={state.status === 'loading' && !settings}>
      {settings ? (
        <View>
          <AppCard style={{ padding: 0 }}>
            {PREF_TOGGLES.map((pref, i) => (
              <View key={pref.key} style={[styles.row, i < PREF_TOGGLES.length - 1 && styles.bordered]}>
                <View style={{ flex: 1, paddingRight: spacing(3) }}>
                  <Text style={styles.label}>{pref.label}</Text>
                  <Text style={type.caption}>{pref.detail}</Text>
                </View>
                <Switch
                  value={!!settings[pref.key]}
                  onValueChange={() => presenter.toggle(pref.key)}
                  trackColor={{ false: palette.cream, true: palette.sage }}
                  thumbColor={palette.paper}
                />
              </View>
            ))}
          </AppCard>

          <AppCard style={{ marginTop: spacing(3) }}>
            <Text style={styles.eyebrow}>Reminder lead time</Text>
            <View style={styles.stepper}>
              <AppButton label="−" variant="ghost" small onPress={() => presenter.cycleOffset(-1)} style={styles.stepBtn} />
              <Text style={styles.offset}>{`${settings.reminderOffsetDays} days before expiry`}</Text>
              <AppButton label="+" variant="ghost" small onPress={() => presenter.cycleOffset(1)} style={styles.stepBtn} />
            </View>
            <Text style={type.caption}>Applies to expiry warnings; the scheduler sends at most one per document per day.</Text>
          </AppCard>

          <AppButton label="Save preferences" variant="amber" loading={state.status === 'loading'} onPress={() => presenter.save()} style={{ marginTop: spacing(4) }} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing(3.5) },
  bordered: { borderBottomWidth: 1, borderBottomColor: palette.line },
  label: { fontSize: 14.5, fontWeight: '600', color: palette.ink, marginBottom: 2 },
  eyebrow: { ...type.micro, marginBottom: spacing(2.5) },
  stepper: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing(2) },
  stepBtn: { width: 44 },
  offset: { flex: 1, textAlign: 'center', fontSize: 14.5, fontWeight: '600', color: palette.ink },
});

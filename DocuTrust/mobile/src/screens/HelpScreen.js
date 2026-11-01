import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { HelpPresenter } from '../microservices/profile/presenters';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import SectionHeader from '../components/SectionHeader';
import StampBadge from '../components/StampBadge';

// Accordion FAQ from real product knowledge + live /api/meta about-card.
export default function HelpScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new HelpPresenter(navigation));
  const data = state.data || { faq: [], openIndex: -1 };
  const meta = data.meta;

  useEffect(() => {
    presenter.load();
  }, [presenter]);

  return (
    <Screen title="Help" eyebrow="How the vault works" onBack={() => navigation.goBack()}>
      <View>
        {(data.faq || []).map((item, i) => {
          const open = data.openIndex === i;
          return (
            <AppCard key={String(i)} onPress={() => presenter.toggle(i)} style={[styles.card, open && styles.cardOpen]}>
              <Text style={styles.question}>{item.q}</Text>
              {open ? <Text style={styles.answer}>{item.a}</Text> : null}
            </AppCard>
          );
        })}
      </View>

      <SectionHeader eyebrow="About" title="DocuTrust" />
      <AppCard>
        <Text style={type.body}>{meta ? meta.tagline || meta.description : 'A secure document vault and verification platform.'}</Text>
        <View style={styles.metaRow}>
          <StampBadge status="info" label={`${meta && meta.screens ? meta.screens : 45} screens`} small />
          <StampBadge status="info" label={`${meta && meta.features ? meta.features : 216} features`} small style={{ marginLeft: spacing(2) }} />
          <StampBadge status="info" label="v1.0.0" small style={{ marginLeft: spacing(2) }} />
        </View>
        <Text style={[type.caption, { marginTop: spacing(3) }]}>
          Documents are encrypted with AES-256-GCM before storage and fingerprinted with SHA-256. Verification links share proof, never bytes.
        </Text>
        {(meta && meta.roles) ? (
          <Text style={[type.caption, { marginTop: spacing(2) }]}>Roles on this platform: {meta.roles.join(', ')}.</Text>
        ) : null}
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing(2.5) },
  cardOpen: { borderColor: palette.amber },
  question: { fontSize: 14.5, fontWeight: '600', color: palette.ink },
  answer: { ...type.caption, marginTop: spacing(2), lineHeight: 21 },
  metaRow: { flexDirection: 'row', marginTop: spacing(3) },
});

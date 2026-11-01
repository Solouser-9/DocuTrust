import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clipboard } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { mono, type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { DocumentDetailPresenter } from '../microservices/documents/presenters';
import { docTypeLabel } from '../microservices/documents/model';
import { formatBytes, formatDate, daysUntil } from '../core/utils/formatters';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import StampBadge from '../components/StampBadge';
import ListItem from '../components/ListItem';
import ProgressBar from '../components/ProgressBar';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';

// Pure-View countdown ring: two clipped half-turns around a track.
function Ring({ size = 76, progress }) {
  const half = size / 2;
  const deg = Math.max(0, Math.min(1, progress)) * 360;
  const circle = { position: 'absolute', width: size, height: size, borderRadius: half, borderWidth: 4, borderColor: 'transparent' };
  const rightColor = deg > 0 ? palette.amber : 'transparent';
  const leftColor = deg > 180 ? palette.amber : 'transparent';
  return (
    <View style={{ width: size, height: size }}>
      <View style={[circle, { borderColor: palette.line }]} />
      <View style={{ position: 'absolute', left: half, top: 0, width: half, height: size, overflow: 'hidden' }}>
        <View style={[circle, { left: -half, borderRightColor: rightColor, borderTopColor: rightColor, borderBottomColor: rightColor, transform: [{ rotate: `${-180 + Math.min(deg, 180)}deg` }] }]} />
      </View>
      <View style={{ position: 'absolute', left: 0, top: 0, width: half, height: size, overflow: 'hidden' }}>
        <View style={[circle, { borderLeftColor: leftColor, borderTopColor: leftColor, borderBottomColor: leftColor, transform: [{ rotate: `${deg - 360}deg` }] }]} />
      </View>
    </View>
  );
}

export default function DocumentDetailScreen({ navigation, route }) {
  const id = (route && route.params && route.params.id) || null;
  const [state, presenter] = usePresenter(() => new DocumentDetailPresenter(navigation));
  const [confirmTrash, setConfirmTrash] = useState(false);
  const doc = state.data;

  useEffect(() => {
    presenter.load(id);
  }, [presenter, id]);

  if (state.status === 'error') {
    return (
      <Screen title="Document" onBack={() => navigation.goBack()}>
        <EmptyState variant="vault" title="Not available" message={state.error} actionLabel="Back" onAction={() => navigation.goBack()} />
      </Screen>
    );
  }

  const left = doc ? daysUntil(doc.expiresAt) : null;
  const ringProgress = left !== null ? Math.max(0, Math.min(1, (90 - Math.max(0, left)) / 90)) : 0;

  return (
    <Screen title={doc ? doc.title : 'Document'} eyebrow={doc ? docTypeLabel(doc.docType) : ''} onBack={() => navigation.goBack()}>
      {doc ? (
        <View>
          <AppCard>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.typeEyebrow}>{docTypeLabel(doc.docType)}</Text>
                <Text style={styles.fileTitle}>{doc.title}</Text>
              </View>
              <Ring size={68} progress={doc.expiresAt ? ringProgress : 0} />
            </View>
            <View style={styles.stampRow}>
              <StampBadge status={doc.status} />
              {doc.reviewStatus === 'pending_review' || doc.status === 'pending_review' ? <StampBadge status="pending_review" style={{ marginLeft: spacing(2) }} /> : null}
            </View>
            {doc.expiresAt ? (
              <Text style={styles.expiryNote}>
                {left !== null && left <= 0 ? 'Expired' : `Expires ${formatDate(doc.expiresAt)} — ${left} day${left === 1 ? '' : 's'}`}
              </Text>
            ) : (
              <Text style={styles.expiryNote}>No expiry recorded for this document.</Text>
            )}
          </AppCard>

          <AppCard style={{ marginTop: spacing(3), padding: 0 }}>
            <ListItem title="Size" value right={<Text style={type.caption}>{formatBytes(doc.fileSize)}</Text>} />
            <ListItem title="Folder" value right={<Text style={type.caption}>{doc.folderId ? 'Assigned' : 'Loose'}</Text>} />
            <ListItem title="Uploaded" value right={<Text style={type.caption}>{formatDate(doc.createdAt)}</Text>} />
            <ListItem title="Current version" value right={<Text style={type.caption}>{`v${doc.currentVersion || 1}`}</Text>} last />
          </AppCard>

          <AppCard style={{ marginTop: spacing(3) }}>
            <Text style={styles.eyebrow}>SHA-256 fingerprint</Text>
            <Text style={styles.hash} numberOfLines={2}>{doc.sha256 || '—'}</Text>
            <AppButton label="Copy fingerprint" variant="ghost" small onPress={() => presenter.copyHash()} style={{ alignSelf: 'flex-start' }} />
            <ProgressBar progress={ringProgress} style={{ marginTop: spacing(3) }} />
          </AppCard>

          <View style={styles.actions}>
            <AppButton label="Share" variant="amber" small onPress={() => navigation.navigate('CreateShare', { documentId: doc.id })} style={{ flex: 1 }} />
            <AppButton label="Verify" variant="solid" small onPress={() => navigation.navigate('CreateVerification', { documentId: doc.id })} style={{ flex: 1, marginHorizontal: spacing(2) }} />
            <AppButton label="Save" variant="ghost" small loading={state.working} onPress={() => presenter.download()} style={{ flex: 1 }} />
          </View>

          <View style={[styles.actions, { marginTop: spacing(2) }]}>
            <AppButton label="Versions" variant="ghost" small onPress={() => navigation.navigate('Versions', { id: doc.id })} style={{ flex: 1 }} />
            <AppButton label="History" variant="ghost" small onPress={() => navigation.navigate('History', { id: doc.id })} style={{ flex: 1, marginHorizontal: spacing(2) }} />
            <AppButton label="Edit" variant="ghost" small onPress={() => navigation.navigate('EditDocument', { id: doc.id })} style={{ flex: 1 }} />
          </View>

          <AppButton label="Move to trash" variant="coral" small onPress={() => setConfirmTrash(true)} style={{ marginTop: spacing(4) }} />
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmTrash}
        title="Move to trash?"
        message="The document leaves your active vault. You can restore it from Trash."
        confirmLabel="Move to trash"
        danger
        onCancel={() => setConfirmTrash(false)}
        onConfirm={() => {
          setConfirmTrash(false);
          presenter.trash();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  typeEyebrow: { ...type.micro, marginBottom: spacing(1) },
  fileTitle: { fontFamily: 'Georgia', fontSize: 20, fontWeight: '700', color: palette.ink, flexShrink: 1 },
  stampRow: { flexDirection: 'row', marginTop: spacing(3) },
  expiryNote: { ...type.caption, marginTop: spacing(3) },
  eyebrow: { ...type.micro, marginBottom: spacing(1.5) },
  hash: { ...mono, backgroundColor: palette.cream, borderRadius: 8, padding: spacing(2.5), marginBottom: spacing(2.5) },
  actions: { flexDirection: 'row', marginTop: spacing(4) },
});

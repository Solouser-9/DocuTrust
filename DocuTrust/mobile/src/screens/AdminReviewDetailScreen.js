import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { mono, type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { AdminReviewDetailPresenter } from '../microservices/admin/presenters';
import { formatDate, shortHash } from '../core/utils/formatters';
import { docTypeLabel } from '../microservices/documents/model';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import StampBadge from '../components/StampBadge';
import ListItem from '../components/ListItem';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';

export default function AdminReviewDetailScreen({ navigation, route }) {
  const id = (route && route.params && route.params.id) || null;
  const [state, presenter] = usePresenter(() => new AdminReviewDetailPresenter(navigation));
  const [decide, setDecide] = useState(null); // 'rejected' | 'escalated' | 'approved'
  const [note, setNote] = useState('');
  const review = state.data && state.data.review;

  useEffect(() => {
    presenter.load(id);
  }, [presenter, id]);

  if (state.status === 'empty') {
    return (
      <Screen title="Review" onBack={() => navigation.goBack()}>
        <EmptyState variant="vault" title="Review not found" message="It may have been decided already." />
      </Screen>
    );
  }

  const confirm = () => {
    if (!decide) return;
    const decision = decide;
    setDecide(null);
    setNote('');
    presenter.decide(decision, note);
  };

  return (
    <Screen
      title="Review detail"
      eyebrow="Full context before you stamp"
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !review}
    >
      {review ? (
        <View>
          <AppCard>
            <View style={styles.headRow}>
              <Text style={styles.title}>{review.targetTitle || review.documentTitle || 'Document'}</Text>
              <StampBadge status={review.status} />
            </View>
            <Text style={type.caption}>{review.reason || 'Flagged automatically: sensitive document type.'}</Text>
          </AppCard>

          <AppCard style={{ marginTop: spacing(3), padding: 0 }}>
            <ListItem title="Document type" value right={<Text style={type.caption}>{docTypeLabel(review.docType || review.targetType)}</Text>} />
            {/* H-3: server field is submitterEmail (ownerName/ownerEmail never existed on AdminReview) */}
            <ListItem title="Owner" value right={<Text style={type.caption}>{review.submitterEmail || '—'}</Text>} />
            <ListItem title="Uploaded" value right={<Text style={type.caption}>{formatDate(review.createdAt)}</Text>} />
            <ListItem title="Fingerprint" value right={<Text style={styles.hash}>{shortHash(review.sha256)}</Text>} last />
          </AppCard>

          {review.status === 'pending' ? (
            <View style={{ marginTop: spacing(4) }}>
              <Text style={styles.eyebrow}>Decision</Text>
              <View style={styles.actions}>
                <AppButton label="Approve" variant="amber" onPress={() => setDecide('approved')} style={{ flex: 1 }} />
                <AppButton label="Reject" variant="coral" onPress={() => setDecide('rejected')} style={{ flex: 1, marginHorizontal: spacing(2.5) }} />
                <AppButton label="Escalate" variant="ghost" onPress={() => setDecide('escalated')} style={{ flex: 1 }} />
              </View>
              <Text style={[type.caption, { marginTop: spacing(3) }]}>
                Approve makes the document active. Reject notifies the owner with your note. Every decision is written to the audit log.
              </Text>
            </View>
          ) : (
            <AppCard style={{ marginTop: spacing(3) }}>
              <Text style={styles.eyebrow}>Decision recorded</Text>
              {/* H-3: server field is decisionNote (AdminReview has no note column) */}
              <Text style={type.caption}>{review.decisionNote || 'No note attached.'}</Text>
            </AppCard>
          )}
        </View>
      ) : null}

      <ConfirmDialog
        visible={!!decide}
        title={decide === 'approved' ? 'Approve this document?' : decide === 'rejected' ? 'Reject this document?' : 'Escalate to senior registrar?'}
        message="The owner is notified and the audit log records your decision."
        confirmLabel={decide === 'approved' ? 'Approve' : decide === 'rejected' ? 'Reject' : 'Escalate'}
        danger={decide === 'rejected'}
        onCancel={() => setDecide(null)}
        onConfirm={confirm}
        extra={
          <View style={{ marginTop: spacing(2) }}>
            <Text style={styles.eyebrow}>Note (optional)</Text>
            <AppInput label="" value={note} onChangeText={setNote} multiline placeholder="Reason the owner will see…" />
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1.5) },
  title: { fontFamily: 'Georgia', fontSize: 18, fontWeight: '700', color: palette.ink, flex: 1, marginRight: spacing(2) },
  eyebrow: { ...type.micro, marginBottom: spacing(2) },
  hash: { ...mono, fontSize: 11 },
  actions: { flexDirection: 'row' },
});

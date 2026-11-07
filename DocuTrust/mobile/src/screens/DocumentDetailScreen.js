import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { mono, SERIF, type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { DocumentDetailPresenter } from '../microservices/documents/presenters';
import { docTypeLabel } from '../microservices/documents/model';
import { formatBytes, formatDate, daysUntil } from '../core/utils/formatters';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import StampBadge from '../components/StampBadge';
import ListItem from '../components/ListItem';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';

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
    const showReviewBadge = doc && doc.reviewStatus === 'pending_review' && doc.status !== 'pending_review';

    return (
        <Screen title={doc ? doc.title : 'Document'} eyebrow={doc ? docTypeLabel(doc.docType) : ''} onBack={() => navigation.goBack()}>
            {doc ? (
                <View style={styles.content}>
                    <AppCard style={styles.documentCard}>
                        <View style={styles.cardTop}>
                            <Text style={styles.typeEyebrow}>{docTypeLabel(doc.docType)}</Text>
                            <Text style={styles.fileTitle}>{doc.title}</Text>
                        </View>
                        <View style={styles.stampRow}>
                            <StampBadge status={doc.status} />
                            {showReviewBadge ? <StampBadge status="pending_review" style={styles.reviewBadgeSpacer} /> : null}
                        </View>
                        {doc.expiresAt ? (
                            <Text style={styles.expiryNote}>
                                {left !== null && left <= 0 ? 'Expired' : `Expires ${formatDate(doc.expiresAt)} — ${left} day${left === 1 ? '' : 's'}`}
                            </Text>
                        ) : (
                            <Text style={styles.expiryNote}>No expiry recorded for this document.</Text>
                        )}
                    </AppCard>

                    <AppCard style={styles.metaCard}>
                        <ListItem title="Size" value right={<Text style={type.caption}>{formatBytes(doc.fileSize)}</Text>} />
                        <ListItem title="Folder" value right={<Text style={type.caption}>{doc.folderId ? 'Assigned' : 'Loose'}</Text>} />
                        <ListItem title="Uploaded" value right={<Text style={type.caption}>{formatDate(doc.createdAt)}</Text>} />
                        <ListItem title="Current version" value right={<Text style={type.caption}>{`v${doc.currentVersion || 1}`}</Text>} last />
                    </AppCard>

                    <AppCard style={styles.fingerprintCard}>
                        <Text style={styles.eyebrow}>SHA-256 fingerprint</Text>
                        <Text style={styles.hash} numberOfLines={2}>{doc.sha256 || '—'}</Text>
                        <AppButton label="Copy fingerprint" variant="ghost" small onPress={() => presenter.copyHash()} style={styles.copyButton} />
                    </AppCard>

                    {/* Primary Actions */}
                    <View style={styles.actions}>
                        <AppButton label="Share" variant="amber" small onPress={() => navigation.navigate('CreateShare', { documentId: doc.id })} style={styles.actionButton} />
                        <AppButton label="Verify" variant="solid" small onPress={() => navigation.navigate('CreateVerification', { documentId: doc.id })} style={styles.actionButton} />
                        <AppButton label="Save" variant="ghost" small loading={state.working} onPress={() => presenter.download()} style={styles.actionButton} />
                    </View>

                    {/* Secondary Actions */}
                    <View style={styles.actions}>
                        <AppButton label="Versions" variant="ghost" small onPress={() => navigation.navigate('Versions', { id: doc.id })} style={styles.actionButton} />
                        <AppButton label="History" variant="ghost" small onPress={() => navigation.navigate('History', { id: doc.id })} style={styles.actionButton} />
                        <AppButton label="Edit" variant="ghost" small onPress={() => navigation.navigate('EditDocument', { id: doc.id })} style={styles.actionButton} />
                    </View>

                    <AppButton label="Move to trash" variant="coral" small onPress={() => setConfirmTrash(true)} style={styles.trashButton} />
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
    content: { paddingBottom: spacing(20) },
    cardTop: { flexDirection: 'column', alignItems: 'flex-start' },
    typeEyebrow: { ...type.micro, marginBottom: spacing(1) },
    fileTitle: { fontFamily: SERIF, fontSize: 20, fontWeight: '700', color: palette.ink },
    stampRow: { flexDirection: 'row', marginTop: spacing(3) },
    expiryNote: { ...type.caption, marginTop: spacing(3) },
    documentCard: { overflow: 'hidden', borderRadius: 18 },
    metaCard: { marginTop: spacing(3), padding: 0 },
    fingerprintCard: { marginTop: spacing(3) },
    eyebrow: { ...type.micro, marginBottom: spacing(1.5) },
    hash: { ...mono, backgroundColor: palette.cream, borderRadius: 8, padding: spacing(2.5), marginBottom: spacing(2.5) },
    copyButton: { alignSelf: 'flex-start' },

    // FIXED BUTTON SPACING
    actions: {
        flexDirection: 'row',
        marginTop: spacing(3),
        gap: spacing(2), // Replaces manual margin spacers for perfect alignment
    },
    actionButton: { flex: 1 },
    trashButton: { marginTop: spacing(5), marginBottom: spacing(3) },
    reviewBadgeSpacer: { marginLeft: spacing(2) },
});
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { TrashPresenter } from '../microservices/documents/presenters';
import { usePullRefresh } from '../core/utils/usePullRefresh';
import Screen from '../components/Screen';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import FileTabCard from '../components/FileTabCard';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';

// Soft-deleted documents with restore / permanent-delete decisions. Destroying is step-up
// gated: the server answers 403 STEP_UP_REQUIRED until an emailed OTP confirms the purge.
export default function TrashScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new TrashPresenter(navigation));
  const { refreshing, onRefresh } = usePullRefresh(() => presenter.load());
  const [pending, setPending] = useState(null); // { kind: 'restore'|'destroy', doc }
  const [otp, setOtp] = useState('');
  const items = (state.data && state.data.items) || [];
  const stepUpRequired = !!(state.data && state.data.stepUpRequired);

  useEffect(() => {
    presenter.load();
  }, [presenter]);

  const confirm = () => {
    if (!pending) return;
    const { kind, doc } = pending;
    setPending(null);
    if (kind === 'restore') presenter.restore(doc.id);
    else presenter.destroy(doc.id);
  };

  return (
    <Screen
      title="Trash"
      eyebrow="Deleted documents linger here"
      onBack={() => navigation.goBack()}
      loading={state.status === 'loading' && !items.length}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {stepUpRequired ? (
        <View>
          <Text style={[type.body, { lineHeight: 24, marginBottom: spacing(4) }]}>
            One last check before the bytes are gone for good: enter the 6-digit code we just emailed you.
          </Text>
          <TextInput
            value={otp}
            onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            style={styles.otpInput}
          />
          <AppButton
            label="Destroy permanently"
            variant="coral"
            loading={state.status === 'loading'}
            onPress={() => presenter.confirmDestroyOtp(otp)}
          />
          <AppButton
            label="Cancel"
            variant="ghost"
            onPress={() => { setOtp(''); presenter.cancelDestroyOtp(); }}
            style={{ marginTop: spacing(2.5) }}
          />
        </View>
      ) : state.status === 'empty' ? (
        <EmptyState variant="vault" title="Trash is empty" message="Deleted documents rest here until you restore or destroy them." />
      ) : (
        <View>
          <Text style={[type.caption, { marginBottom: spacing(3) }]}>Restoring returns a document to your active vault. Destroying removes its encrypted bytes for good.</Text>
          {items.map((doc) => (
            <View key={String(doc.id)}>
              <FileTabCard doc={doc} meta="Soft-deleted" onPress={null} />
              <View style={styles.row}>
                <AppButton label="Restore" variant="ghost" small onPress={() => setPending({ kind: 'restore', doc })} style={{ flex: 1 }} />
                <AppButton label="Delete forever" variant="coral" small onPress={() => setPending({ kind: 'destroy', doc })} style={{ flex: 1, marginLeft: spacing(2.5) }} />
              </View>
            </View>
          ))}
        </View>
      )}

      <ConfirmDialog
        visible={!!pending}
        title={pending && pending.kind === 'restore' ? 'Restore document?' : 'Destroy permanently?'}
        message={
          pending && pending.kind === 'restore'
            ? 'The document returns to your vault exactly as it was.'
            : 'Encrypted bytes are erased from the vault. Shares and verification links die with it.'
        }
        confirmLabel={pending && pending.kind === 'restore' ? 'Restore' : 'Destroy'}
        danger={!!pending && pending.kind === 'destroy'}
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: spacing(3.5), paddingHorizontal: spacing(1) },
  otpInput: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    padding: spacing(3),
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: spacing(4),
    color: palette.ink,
  },
});

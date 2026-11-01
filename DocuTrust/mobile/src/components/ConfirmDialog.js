import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { radius } from '../core/theme/radius';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import AppButton from './AppButton';

// Destructive / irreversible actions always go through this modal first.
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  extra,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {extra}
          <View style={styles.row}>
            <AppButton label={cancelLabel} variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
            <AppButton
              label={confirmLabel}
              variant={danger ? 'coral' : 'amber'}
              onPress={onConfirm}
              style={{ flex: 1, marginLeft: spacing(2.5) }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(14,27,44,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing(5) },
  sheet: {
    backgroundColor: palette.paper,
    borderRadius: radius.sheet,
    padding: spacing(5),
    width: '100%',
    maxWidth: 420,
  },
  title: { ...type.title, marginBottom: spacing(1.5) },
  message: { ...type.caption, marginBottom: spacing(2) },
  row: { flexDirection: 'row', marginTop: spacing(3) },
});

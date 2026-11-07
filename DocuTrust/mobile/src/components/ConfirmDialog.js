/*
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
            <AppButton label={cancelLabel} variant="ghost" onPress={onCancel} style={styles.buttonHalf} />
            <AppButton
              label={confirmLabel}
              variant={danger ? 'coral' : 'amber'}
              onPress={onConfirm}
              style={[styles.buttonHalf, styles.buttonSpacer]}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: palette.scrim, alignItems: 'center', justifyContent: 'center', padding: spacing(5) },
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
  buttonHalf: { flex: 1 },
  buttonSpacer: { marginLeft: spacing(2.5) },
});*/





import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { radius } from '../core/theme/radius';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';
import AppButton from './AppButton';

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
      <Modal
          transparent
          visible={visible}
          animationType="fade"
          onRequestClose={onCancel}
          statusBarTranslucent={true}
          presentationStyle="overFullScreen"
      >
        <View style={styles.scrim}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            {extra}
            <View style={styles.row}>
              <AppButton label={cancelLabel} variant="ghost" onPress={onCancel} style={styles.buttonHalf} />
              <AppButton
                  label={confirmLabel}
                  variant={danger ? 'coral' : 'amber'}
                  onPress={onConfirm}
                  style={[styles.buttonHalf, styles.buttonSpacer]}
              />
            </View>
          </View>
        </View>
      </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: palette.scrim, alignItems: 'center', justifyContent: 'center', padding: spacing(5) },
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
  buttonHalf: { flex: 1 },
  buttonSpacer: { marginLeft: spacing(2.5) },
});
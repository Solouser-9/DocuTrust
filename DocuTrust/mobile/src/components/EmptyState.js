import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { SERIF, type } from '../core/theme/typography';
import AppButton from './AppButton';

// Line-art empty states drawn with plain Views (no images): vault, folder,
// bell, search, share and check variants.
function Art({ variant }) {
  const line = palette.slate;
  if (variant === 'vault') {
    return (
      <View style={styles.artBox}>
        <View style={[styles.vaultDoor, { borderColor: line }]}>
          <View style={[styles.vaultDial, { borderColor: line }]} />
          <View style={[styles.vaultSpoke, { backgroundColor: line }]} />
          <View style={[styles.vaultSpoke, { backgroundColor: line, transform: [{ rotate: '90deg' }] }]} />
        </View>
      </View>
    );
  }
  if (variant === 'folder') {
    return (
      <View style={styles.artBox}>
        <View style={[styles.folderTab, { backgroundColor: line }]} />
        <View style={[styles.folderBody, { borderColor: line }]} />
      </View>
    );
  }
  if (variant === 'bell') {
    return (
      <View style={styles.artBox}>
        <View style={[styles.bellDome, { borderColor: line }]} />
        <View style={[styles.bellBase, { backgroundColor: line }]} />
        <View style={[styles.bellClapper, { backgroundColor: line }]} />
      </View>
    );
  }
  if (variant === 'search') {
    return (
      <View style={styles.artBox}>
        <View style={[styles.lens, { borderColor: line }]} />
        <View style={[styles.handle, { backgroundColor: line }]} />
      </View>
    );
  }
  if (variant === 'share') {
    return (
      <View style={styles.artBox}>
        <View style={[styles.chainLink, { borderColor: line }]} />
        <View style={[styles.chainLink, { borderColor: line, left: 26 }]} />
      </View>
    );
  }
  return (
    <View style={styles.artBox}>
      <View style={[styles.checkCircle, { borderColor: line }]} />
      <View style={[styles.checkA, { backgroundColor: line }]} />
      <View style={[styles.checkB, { backgroundColor: line }]} />
    </View>
  );
}

export default function EmptyState({ variant = 'vault', title, message, actionLabel, onAction, style }) {
  return (
    <View style={[styles.wrap, style]}>
      <Art variant={variant} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <AppButton label={actionLabel} variant="amber" small onPress={onAction} style={{ marginTop: spacing(4) }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing(10), paddingHorizontal: spacing(4) },
  artBox: { height: 64, width: 72, marginBottom: spacing(3), alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: SERIF, fontSize: 17, fontWeight: '700', color: palette.ink, textAlign: 'center' },
  message: { ...type.caption, textAlign: 'center', marginTop: spacing(1), maxWidth: 280 },

  vaultDoor: { width: 56, height: 56, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  vaultDial: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  vaultSpoke: { position: 'absolute', width: 2, height: 10 },

  folderTab: { position: 'absolute', top: 4, left: 8, width: 20, height: 6, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  folderBody: { position: 'absolute', top: 9, width: 56, height: 40, borderWidth: 2, borderRadius: 6 },

  bellDome: {
    width: 36, height: 30, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderWidth: 2, borderBottomWidth: 0,
  },
  bellBase: { width: 44, height: 3, borderRadius: 2, marginTop: 0 },
  bellClapper: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },

  lens: { position: 'absolute', left: 6, top: 2, width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
  handle: { position: 'absolute', right: 6, bottom: 6, width: 22, height: 3, borderRadius: 2, transform: [{ rotate: '45deg' }] },

  chainLink: { position: 'absolute', left: 2, top: 14, width: 28, height: 18, borderWidth: 2, borderRadius: 9 },
  chainLink2: {},

  checkCircle: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  checkA: { position: 'absolute', width: 3, height: 10, borderRadius: 2, transform: [{ rotate: '-45deg' }], left: 24, top: 26 },
  checkB: { position: 'absolute', width: 3, height: 18, borderRadius: 2, transform: [{ rotate: '40deg' }], left: 32, top: 19 },
});

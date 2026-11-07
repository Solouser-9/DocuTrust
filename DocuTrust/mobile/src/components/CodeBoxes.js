import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';

export default function CodeBoxes({
                                    code = '',
                                    onChangeText,
                                    onSubmitEditing,
                                    inputRef,
                                    accessibilityLabel = '6-digit code',
                                  }) {
  const internalInputRef = useRef(null);
  const resolvedInputRef = inputRef || internalInputRef;

  return (
      <Pressable style={styles.container} onPress={() => resolvedInputRef.current?.focus()}>
        <View style={styles.boxes}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={[styles.box, code.length === i && styles.boxActive]}>
                <Text style={styles.digit}>{code[i] || ''}</Text>
              </View>
          ))}
        </View>
        <TextInput
            ref={resolvedInputRef}
            style={styles.input}
            value={code}
            onChangeText={(value) => onChangeText(value.replace(/\D/g, '').slice(0, 6))}
            onSubmitEditing={onSubmitEditing}
            keyboardType="number-pad"
            editable={true}
            autoFocus={false}
            maxLength={6}
            caretHidden
            selectionColor="transparent"
            accessibilityLabel={accessibilityLabel}
        />
      </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing(2),
  },
  boxes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  box: {
    width: 48,           // FIXED WIDTH: prevents squishing
    height: 56,          // FIXED HEIGHT
    flexShrink: 0,       // CRITICAL: tells React Native to NEVER shrink this box
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    borderColor: palette.amber,
  },
  digit: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.ink,
  },
  input: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
    color: 'transparent',
    backgroundColor: 'transparent',
  },
});
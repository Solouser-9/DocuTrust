import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { palette } from '../core/theme/palette';
import { radius } from '../core/theme/radius';
import { spacing } from '../core/theme/spacing';
import { type } from '../core/theme/typography';

export default function AppInput({
  label,
  value,
  onChangeText,
  error,
  hint,
  secure,
  multiline,
  placeholder,
  keyboardType,
  autoCapitalize = 'none',
  style,
}) {
  const [hidden, setHidden] = useState(!!secure);
  const inputRef = useRef(null);
  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable accessible={false} onPress={() => inputRef.current?.focus()}>
        <View style={[styles.field, !!error && styles.fieldError, multiline && styles.multiline]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={palette.slate}
            secureTextEntry={hidden}
            multiline={multiline}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            autoFocus={false}
            editable={true}
          />
          {secure ? (
            <TouchableOpacity onPress={() => setHidden((h) => !h)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.toggle}>{hidden ? 'Show' : 'Hide'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing(4) },
  label: { ...type.micro, marginBottom: spacing(1.5) },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderWidth: 1.5,
    borderColor: palette.line,
    borderRadius: radius.input,
    paddingHorizontal: spacing(3),
  },
  fieldError: { borderColor: palette.coral },
  multiline: { paddingVertical: spacing(2), minHeight: 88, alignItems: 'flex-start' },
  input: { flex: 1, fontSize: 15, color: palette.ink, paddingVertical: spacing(3), minHeight: 24 },
  toggle: { color: palette.amberText, fontWeight: '600', fontSize: 13, marginLeft: spacing(2) },
  error: { color: palette.coralText, fontSize: 12.5, marginTop: spacing(1) },
  hint: { color: palette.slate, fontSize: 12.5, marginTop: spacing(1) },
});
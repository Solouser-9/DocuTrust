import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { SERIF, type } from '../core/theme/typography';
import { usePresenter } from '../mvp/usePresenter';
import { LoginPresenter } from '../microservices/auth/presenters';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';

export default function LoginScreen({ navigation }) {
  const [state, presenter] = usePresenter(() => new LoginPresenter(navigation));
  const [form, setForm] = useState({ email: '', password: '' });

  const change = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    presenter.setField(key, value);
  };

  const submit = () => {
    presenter.form = { ...form };
    presenter.submit();
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>DocuTrust</Text>
        <Text style={styles.title}>Open the vault</Text>
      </View>

      <View style={styles.form}>
        <AppInput
          label="Email"
          value={form.email}
          onChangeText={change('email')}
          placeholder="you@example.com"
          keyboardType="email-address"
          error={state.fieldErrors.email}
        />
        <AppInput
          label="Password"
          value={form.password}
          onChangeText={change('password')}
          secure
          error={state.fieldErrors.password}
        />
        <TouchableOpacity
          onPress={() => navigation.navigate('ForgotPassword')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.forgotRow}
        >
          <Text style={styles.forgot}>Forgot password?</Text>
        </TouchableOpacity>
        {state.status === 'error' ? <Text style={styles.apiError}>{state.error}</Text> : null}
        <AppButton
          label="Sign in"
          variant="solid"
          loading={state.status === 'loading'}
          onPress={submit}
          style={{ marginTop: spacing(2) }}
        />
        <View style={styles.registerRow}>
          <Text style={type.caption}>New to DocuTrust? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.link}>Create an account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.parchment, justifyContent: 'center', paddingHorizontal: spacing(5) },
  hero: { marginBottom: spacing(7) },
  eyebrow: { ...type.micro, color: palette.amber, marginBottom: spacing(1.5) },
  title: { fontFamily: SERIF, fontSize: 30, fontWeight: '700', color: palette.ink },
  form: {},
  forgotRow: { alignSelf: 'flex-end', marginTop: -spacing(2), marginBottom: spacing(3) },
  forgot: { color: palette.amber, fontWeight: '600', fontSize: 13 },
  apiError: { color: palette.coral, fontSize: 13, marginBottom: spacing(2), textAlign: 'center' },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing(5) },
  link: { color: palette.amber, fontWeight: '700', fontSize: 14 },
});

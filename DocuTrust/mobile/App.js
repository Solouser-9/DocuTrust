import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import Toast from './src/components/Toast';
import { AuthStore } from './src/core/store/AuthStore';
import { palette } from './src/core/theme/palette';

export default function App() {
  useEffect(() => {
    AuthStore.hydrate();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={palette.parchment} />
      <RootNavigator />
      <Toast />
    </SafeAreaProvider>
  );
}

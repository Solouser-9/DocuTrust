import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import RootNavigator from './src/navigation/RootNavigator';
import Toast from './src/components/Toast';
import { AuthStore } from './src/core/store/AuthStore';
import { palette } from './src/core/theme/palette';

// Keep the native splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
    useEffect(() => {
        async function prepare() {
            try {
                await AuthStore.hydrate();
            } catch (error) {
                console.error(`Unable to restore the saved session: ${error}`);
            } finally {
                setTimeout(() => {
                    SplashScreen.hideAsync();
                }, 500);
            }
        }

        // The 'void' keyword tells the IDE to stop complaining about the promise
        void prepare();
    }, []);

    return (
        <SafeAreaProvider>
            <StatusBar style="dark" backgroundColor={palette.parchment} />
            <RootNavigator />
            <Toast />
        </SafeAreaProvider>
    );
}
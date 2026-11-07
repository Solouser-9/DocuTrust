import React, { useSyncExternalStore } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '../core/theme/palette';
import { spacing } from '../core/theme/spacing';
import { AuthStore } from '../core/store/AuthStore';
import { SCREEN_REGISTRY } from '../screens';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const navTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: palette.parchment,
        primary: palette.ink,
        card: palette.paper,
        border: palette.line,
        text: palette.ink,
        notification: palette.amber,
    },
};

const linking = {
    prefixes: ['docutrust://'],
    config: {
        screens: {
            PublicVerify: 'verify/:token',
        },
    },
};

const screenOptions = { headerShown: false, contentStyle: { backgroundColor: palette.parchment } };

function TabGlyph({ variant, focused }) {
    const c = focused ? palette.ink : palette.slate;
    if (variant === 'vault') {
        return (
            <View style={[styles.glyphBox, { borderColor: c }]}>
                <View style={[styles.glyphDial, { borderColor: c }]} />
            </View>
        );
    }
    if (variant === 'shares') {
        return (
            <View style={styles.glyphRow}>
                <View style={[styles.glyphRing, { borderColor: c }]} />
                <View style={[styles.glyphRing, styles.glyphRingOffset, { borderColor: c }]} />
            </View>
        );
    }
    if (variant === 'alerts') {
        return (
            <View style={{ alignItems: 'center' }}>
                <View style={[styles.glyphBell, { borderColor: c }]} />
                <View style={[styles.glyphBellBase, { backgroundColor: c }]} />
                <View style={[styles.glyphBellClapper, { backgroundColor: c }]} />
            </View>
        );
    }
    return (
        <View style={{ alignItems: 'center' }}>
            <View style={[styles.glyphHead, { borderColor: c }]} />
            <View style={[styles.glyphShoulders, { borderColor: c }]} />
        </View>
    );
}

function VaultStack() {
    return (
        <Stack.Navigator initialRouteName="Dashboard" screenOptions={screenOptions}>
            <Stack.Screen name="Dashboard" component={SCREEN_REGISTRY.Dashboard.component} />
            <Stack.Screen name="Documents" component={SCREEN_REGISTRY.Documents.component} />
            <Stack.Screen name="Folders" component={SCREEN_REGISTRY.Folders.component} />
            <Stack.Screen name="Expiring" component={SCREEN_REGISTRY.Expiring.component} />
            <Stack.Screen name="Trash" component={SCREEN_REGISTRY.Trash.component} />
        </Stack.Navigator>
    );
}

function SharesStack() {
    return (
        <Stack.Navigator initialRouteName="SharesMain" screenOptions={screenOptions}>
            <Stack.Screen name="SharesMain" component={SCREEN_REGISTRY.Shares.component} />
            <Stack.Screen name="CreateShare" component={SCREEN_REGISTRY.CreateShare.component} />
            <Stack.Screen name="ShareDetail" component={SCREEN_REGISTRY.ShareDetail.component} />
        </Stack.Navigator>
    );
}

function AlertsStack() {
    return (
        <Stack.Navigator initialRouteName="Notifications" screenOptions={screenOptions}>
            <Stack.Screen name="Notifications" component={SCREEN_REGISTRY.Notifications.component} />
            <Stack.Screen name="NotificationPrefs" component={SCREEN_REGISTRY.NotificationPrefs.component} />
        </Stack.Navigator>
    );
}

function ProfileStack() {
    return (
        <Stack.Navigator initialRouteName="ProfileMain" screenOptions={screenOptions}>
            <Stack.Screen name="ProfileMain" component={SCREEN_REGISTRY.Profile.component} />
            <Stack.Screen name="EditProfile" component={SCREEN_REGISTRY.EditProfile.component} />
            <Stack.Screen name="ChangePassword" component={SCREEN_REGISTRY.ChangePassword.component} />
            <Stack.Screen name="Security" component={SCREEN_REGISTRY.Security.component} />
            <Stack.Screen name="Help" component={SCREEN_REGISTRY.Help.component} />
        </Stack.Navigator>
    );
}

function MainTabs() {
    const insets = useSafeAreaInsets();

    return (
        <Tabs.Navigator
            initialRouteName="Vault"
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: palette.ink,
                tabBarInactiveTintColor: palette.slate,
                // This removes the shadow/ripple animation on tap
                tabBarButton: (props) => (
                    <TouchableOpacity {...props} activeOpacity={1} style={props.style} />
                ),
                tabBarStyle: {
                    backgroundColor: palette.paper,
                    borderTopColor: palette.line,
                    height: 64 + insets.bottom,
                    paddingTop: 8,
                    paddingBottom: Math.max(insets.bottom, 8),
                    borderTopWidth: 1,
                    elevation: 0,
                    shadowOpacity: 0,
                },
                tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600', letterSpacing: 0.3, marginTop: 4 },
            }}
        >
            <Tabs.Screen
                name="Vault"
                component={VaultStack}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <View style={[styles.tabIconContainer, focused && styles.tabIconFocused]}>
                            <TabGlyph variant="vault" focused={focused} />
                        </View>
                    )
                }}
            />
            <Tabs.Screen
                name="Shares"
                component={SharesStack}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <View style={[styles.tabIconContainer, focused && styles.tabIconFocused]}>
                            <TabGlyph variant="shares" focused={focused} />
                        </View>
                    )
                }}
            />
            <Tabs.Screen
                name="Alerts"
                component={AlertsStack}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <View style={[styles.tabIconContainer, focused && styles.tabIconFocused]}>
                            <TabGlyph variant="alerts" focused={focused} />
                        </View>
                    )
                }}
            />
            <Tabs.Screen
                name="Profile"
                component={ProfileStack}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <View style={[styles.tabIconContainer, focused && styles.tabIconFocused]}>
                            <TabGlyph variant="profile" focused={focused} />
                        </View>
                    )
                }}
            />
        </Tabs.Navigator>
    );
}

function AdminStack() {
    return (
        <Stack.Navigator initialRouteName="AdminDashboard" screenOptions={screenOptions}>
            <Stack.Screen name="AdminDashboard" component={SCREEN_REGISTRY.AdminDashboard.component} />
            <Stack.Screen name="AdminReviewQueue" component={SCREEN_REGISTRY.AdminReviewQueue.component} />
            <Stack.Screen name="AdminReviewDetail" component={SCREEN_REGISTRY.AdminReviewDetail.component} />
            <Stack.Screen name="AdminUsers" component={SCREEN_REGISTRY.AdminUsers.component} />
            <Stack.Screen name="AdminUserDetail" component={SCREEN_REGISTRY.AdminUserDetail.component} />
            <Stack.Screen name="AdminAuditLogs" component={SCREEN_REGISTRY.AdminAuditLogs.component} />
            <Stack.Screen name="AdminDocuments" component={SCREEN_REGISTRY.AdminDocuments.component} />
        </Stack.Navigator>
    );
}

function OrgStack() {
    return (
        <Stack.Navigator initialRouteName="Org" screenOptions={screenOptions}>
            <Stack.Screen name="Org" component={SCREEN_REGISTRY.Org.component} />
            <Stack.Screen name="TeamMembers" component={SCREEN_REGISTRY.TeamMembers.component} />
            <Stack.Screen name="InviteMember" component={SCREEN_REGISTRY.InviteMember.component} />
        </Stack.Navigator>
    );
}

function AuthStack() {
    return (
        <Stack.Navigator initialRouteName="Onboarding" screenOptions={screenOptions}>
            <Stack.Screen name="Onboarding" component={SCREEN_REGISTRY.Onboarding.component} />
            <Stack.Screen name="Login" component={SCREEN_REGISTRY.Login.component} />
            <Stack.Screen name="Register" component={SCREEN_REGISTRY.Register.component} />
            <Stack.Screen name="VerifyOtp" component={SCREEN_REGISTRY.VerifyOtp.component} />
            <Stack.Screen name="VerifyEmail" component={SCREEN_REGISTRY.VerifyEmail.component} />
            <Stack.Screen name="ForgotPassword" component={SCREEN_REGISTRY.ForgotPassword.component} />
            <Stack.Screen name="ResetPassword" component={SCREEN_REGISTRY.ResetPassword.component} />
            <Stack.Screen name="Mfa" component={SCREEN_REGISTRY.Mfa.component} />
        </Stack.Navigator>
    );
}

const MODAL_SCREENS = [
    'UploadDocument',
    'EditDocument',
    'Versions',
    'History',
    'Search',
    'CreateVerification',
    'NotificationPrefs',
];

const PLAIN_SCREENS = [
    'DocumentDetail',
    'FolderDetail',
    'VerificationDetail',
    'CreateShare',
    'ShareDetail',
    'AdminReviewDetail',
    'VerificationRequests',
    'PublicVerify',
    'PublicVerifyResult',
];

function MainStack({ isAdmin, isManager }) {
    return (
        <Stack.Navigator initialRouteName="Tabs" screenOptions={screenOptions}>
            <Stack.Screen name="Tabs" component={MainTabs} />
            {MODAL_SCREENS.map((name) => (
                <Stack.Screen key={`modal-${name}`} name={name} component={SCREEN_REGISTRY[name].component} options={{ presentation: 'modal' }} />
            ))}
            {PLAIN_SCREENS.map((name) => (
                <Stack.Screen key={name} name={name} component={SCREEN_REGISTRY[name].component} />
            ))}
            {isAdmin ? <Stack.Screen name="AdminStack" component={AdminStack} /> : null}
            {isManager ? <Stack.Screen name="OrgStack" component={OrgStack} /> : null}
        </Stack.Navigator>
    );
}

function useAuthSession() {
    return useSyncExternalStore(AuthStore.subscribe, AuthStore.getState, AuthStore.getState);
}

export default function RootNavigator() {
    const { hydrated, user } = useAuthSession();
    const SplashScreen = SCREEN_REGISTRY.Splash.component;
    const isAdmin = !!(user && user.role === 'admin');
    const isManager = !!(user && (user.role === 'admin' || user.role === 'org_manager'));

    if (!hydrated) return <SplashScreen />;

    return (
        <NavigationContainer theme={navTheme} linking={linking}>
            {user ? <MainStack isAdmin={isAdmin} isManager={isManager} /> : <AuthStack />}
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    glyphBox: { width: 21, height: 21, borderWidth: 2, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    glyphDial: { width: 9, height: 9, borderWidth: 2, borderRadius: 999, borderStyle: 'solid' },
    glyphRow: { flexDirection: 'row', alignItems: 'center' },
    glyphRing: { width: 9, height: 9, borderWidth: 2, borderRadius: 999 },
    glyphRingOffset: { marginLeft: 5 },
    glyphBell: { width: 17, height: 11, borderWidth: 2, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
    glyphBellBase: { width: 12, height: 2, borderRadius: 2, marginTop: 2 },
    glyphBellClapper: { width: 3, height: 3, borderRadius: 2, marginTop: 2 },
    glyphHead: { width: 15, height: 13, borderWidth: 2, borderRadius: 7, marginBottom: 2 },
    glyphShoulders: { width: 18, height: 6, borderWidth: 2, borderRadius: 6 },

    // Fixed dimensions guarantee all pills are identically sized
    tabIconContainer: {
        width: 64,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabIconFocused: {
        backgroundColor: palette.cream,
    },
});
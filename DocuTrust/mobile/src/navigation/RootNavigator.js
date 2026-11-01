import React, { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { palette } from '../core/theme/palette';
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

// docutrust://verify/:token opens the public verification flow without a session.
const linking = {
  prefixes: ['docutrust://'],
  config: {
    screens: {
      PublicVerify: 'verify/:token',
    },
  },
};

const screenOptions = { headerShown: false, contentStyle: { backgroundColor: palette.parchment } };

// ---------------------------------------------------------------------------
// Line-art tab glyphs drawn with plain Views (the vault ships no icon font).
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
        <View style={[styles.glyphRing, { borderColor: c, marginLeft: -7 }]} />
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

// ---------------------------------------------------------------------------
// Tab clusters. Each tab is its own stack so pushes stay inside the tab.
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
    <Stack.Navigator initialRouteName="Shares" screenOptions={screenOptions}>
      <Stack.Screen name="Shares" component={SCREEN_REGISTRY.Shares.component} />
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
    <Stack.Navigator initialRouteName="Profile" screenOptions={screenOptions}>
      <Stack.Screen name="Profile" component={SCREEN_REGISTRY.Profile.component} />
      <Stack.Screen name="EditProfile" component={SCREEN_REGISTRY.EditProfile.component} />
      <Stack.Screen name="ChangePassword" component={SCREEN_REGISTRY.ChangePassword.component} />
      <Stack.Screen name="Security" component={SCREEN_REGISTRY.Security.component} />
      <Stack.Screen name="Help" component={SCREEN_REGISTRY.Help.component} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      initialRouteName="Vault"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.ink,
        tabBarInactiveTintColor: palette.slate,
        tabBarStyle: { backgroundColor: palette.paper, borderTopColor: palette.line, height: 62, paddingTop: 6, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600', letterSpacing: 0.3 },
      }}
    >
      <Tabs.Screen name="Vault" component={VaultStack} options={{ tabBarIcon: ({ focused }) => <TabGlyph variant="vault" focused={focused} /> }} />
      <Tabs.Screen name="Shares" component={SharesStack} options={{ tabBarIcon: ({ focused }) => <TabGlyph variant="shares" focused={focused} /> }} />
      <Tabs.Screen name="Alerts" component={AlertsStack} options={{ tabBarIcon: ({ focused }) => <TabGlyph variant="alerts" focused={focused} /> }} />
      <Tabs.Screen name="Profile" component={ProfileStack} options={{ tabBarIcon: ({ focused }) => <TabGlyph variant="profile" focused={focused} /> }} />
    </Tabs.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Role-gated nested stacks, reachable by name from Profile quick links.
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

// ---------------------------------------------------------------------------
// Auth gate stack: shown while no session token is held.
function AuthStack() {
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={screenOptions}>
      <Stack.Screen name="Splash" component={SCREEN_REGISTRY.Splash.component} />
      <Stack.Screen name="Onboarding" component={SCREEN_REGISTRY.Onboarding.component} />
      <Stack.Screen name="Login" component={SCREEN_REGISTRY.Login.component} />
      <Stack.Screen name="Register" component={SCREEN_REGISTRY.Register.component} />
      <Stack.Screen name="VerifyEmail" component={SCREEN_REGISTRY.VerifyEmail.component} />
      <Stack.Screen name="ForgotPassword" component={SCREEN_REGISTRY.ForgotPassword.component} />
      <Stack.Screen name="ResetPassword" component={SCREEN_REGISTRY.ResetPassword.component} />
      <Stack.Screen name="Mfa" component={SCREEN_REGISTRY.Mfa.component} />
    </Stack.Navigator>
  );
}

// Detail + modal screens on the root stack. Bare-name navigation bubbles UP in
// react-navigation, so every screen targeted from a root-level or sibling-tab
// view must exist here: UploadDocument/EditDocument/Versions/History/Search/
// FolderDetail/CreateVerification/VerificationDetail/PublicVerify(+
// Result)/VerificationRequests, plus root copies of CreateShare/ShareDetail/
// AdminReviewDetail/NotificationPrefs that are pushed from outside their home
// clusters (DocumentDetail, notification deep links, Profile).
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

// AuthStore is a tiny external store; subscribe the router gate to it.
function useAuthSession() {
  return useSyncExternalStore(AuthStore.subscribe, AuthStore.getState, AuthStore.getState);
}

export default function RootNavigator() {
  const session = useAuthSession();
  const authed = !!session.accessToken;
  const isAdmin = !!(session.user && session.user.role === 'admin');
  const isManager = !!(session.user && (session.user.role === 'admin' || session.user.role === 'org_manager'));

  return (
    <NavigationContainer theme={navTheme} linking={linking}>
      {authed ? <MainStack isAdmin={isAdmin} isManager={isManager} /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  glyphBox: { width: 21, height: 21, borderWidth: 2, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  glyphDial: { width: 8, height: 8, borderRadius: 4, borderWidth: 2 },
  glyphRow: { flexDirection: 'row', alignItems: 'center' },
  glyphRing: { width: 16, height: 11, borderWidth: 2, borderRadius: 6 },
  glyphBell: { width: 15, height: 12, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 2, borderBottomWidth: 0 },
  glyphBellBase: { width: 19, height: 2, borderRadius: 1 },
  glyphBellClapper: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  glyphHead: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  glyphShoulders: { width: 17, height: 7, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderWidth: 2, borderBottomWidth: 0, marginTop: 1 },
});

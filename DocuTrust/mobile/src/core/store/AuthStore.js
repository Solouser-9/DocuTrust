import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'docutrust.session.v1';
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const EMPTY = { user: null, accessToken: null, refreshToken: null };

let state = { ...EMPTY, hydrated: false };
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener(state));
}

function commit(next) {
  state = { ...state, ...next };
  emit();
}

export const AuthStore = {
  async hydrate() {
    let saved = null;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      saved = raw ? JSON.parse(raw) : null;
      const savedSession = saved && typeof saved === 'object' ? saved : null;

      let accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      let refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

      // Upgrade existing sessions once, then remove the plaintext token copies.
      if (!accessToken && savedSession && savedSession.accessToken) {
        accessToken = savedSession.accessToken;
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      }
      if (!refreshToken && savedSession && savedSession.refreshToken) {
        refreshToken = savedSession.refreshToken;
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      }

      const user = savedSession && savedSession.user ? savedSession.user : null;
      if (savedSession && ('accessToken' in savedSession || 'refreshToken' in savedSession)) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ user }));
      }

      state = { ...state, user, accessToken, refreshToken, hydrated: true };
      emit();
    } catch (e) {
      const user = saved && typeof saved === 'object' && saved.user ? saved.user : null;
      state = { ...state, user, hydrated: true };
      emit();
      throw e;
    }
    return state;
  },

  getState: () => state,
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async setSession(user, accessToken, refreshToken) {
    await Promise.all([
      accessToken
        ? SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken)
        : SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      refreshToken
        ? SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken)
        : SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ user })),
    ]);
    commit({ user, accessToken, refreshToken });
  },
  async setTokens(accessToken, refreshToken) {
    await Promise.all([
      accessToken
        ? SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken)
        : SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      refreshToken
        ? SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken)
        : SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
    commit({ accessToken, refreshToken });
  },
  async setUser(user) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ user }));
    commit({ user });
  },

  async logout() {
    state = { ...EMPTY, hydrated: true };
    emit();
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      AsyncStorage.removeItem(STORAGE_KEY),
    ]);
  },

  isAdmin: () => !!(state.user && state.user.role === 'admin'),
  isManager: () => !!(state.user && (state.user.role === 'admin' || state.user.role === 'org_manager')),

  // Test hook: clears in-memory state without touching storage.
  reset() {
    state = { ...EMPTY, hydrated: false };
    emit();
  },
};

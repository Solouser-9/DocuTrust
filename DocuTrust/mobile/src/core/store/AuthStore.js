import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'docutrust.session.v1';
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
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        state = {
          user: saved.user || null,
          accessToken: saved.accessToken || null,
          refreshToken: saved.refreshToken || null,
          hydrated: true
        };
      } else {
        state = { ...EMPTY, hydrated: true };
      }
      emit();
    } catch (e) {
      state = { ...EMPTY, hydrated: true };
      emit();
    }
    return state;
  },

  getState: () => state,

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async setSession(user, accessToken, refreshToken) {
    const session = { user, accessToken, refreshToken };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    commit(session);
  },

  async setTokens(accessToken, refreshToken) {
    const session = { ...state, accessToken, refreshToken };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    commit({ accessToken, refreshToken });
  },

  async setUser(user) {
    const session = { ...state, user };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    commit({ user });
  },

  async logout() {
    state = { ...EMPTY, hydrated: true };
    emit();
    await AsyncStorage.removeItem(STORAGE_KEY);
  },

  isAdmin: () => !!(state.user && state.user.role === 'admin'),
  isManager: () => !!(state.user && (state.user.role === 'admin' || state.user.role === 'org_manager')),

  reset() {
    state = { ...EMPTY, hydrated: false };
    emit();
  },
};
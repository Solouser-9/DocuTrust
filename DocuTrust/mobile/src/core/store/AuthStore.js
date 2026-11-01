import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'docutrust.session.v1';
const EMPTY = { user: null, accessToken: null, refreshToken: null };

let state = { ...EMPTY, hydrated: false };
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener(state));
}

function commit(next, persist) {
  state = { ...state, ...next };
  if (persist) {
    const snapshot = { user: state.user, accessToken: state.accessToken, refreshToken: state.refreshToken };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)).catch(() => {});
  }
  emit();
}

export const AuthStore = {
  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        state = { ...state, ...saved, hydrated: true };
      } else {
        state = { ...state, hydrated: true };
      }
    } catch (e) {
      state = { ...state, hydrated: true };
    }
    emit();
    return state;
  },

  getState: () => state,
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setSession(user, accessToken, refreshToken) {
    commit({ user, accessToken, refreshToken }, true);
  },
  setTokens(accessToken, refreshToken) {
    commit({ accessToken, refreshToken }, true);
  },
  setUser(user) {
    commit({ user }, true);
  },

  async logout() {
    state = { ...EMPTY, hydrated: true };
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // storage already clean
    }
    emit();
  },

  isAdmin: () => !!(state.user && state.user.role === 'admin'),
  isManager: () => !!(state.user && (state.user.role === 'admin' || state.user.role === 'org_manager')),

  // Test hook: clears in-memory state without touching storage.
  reset() {
    state = { ...EMPTY, hydrated: false };
    emit();
  },
};

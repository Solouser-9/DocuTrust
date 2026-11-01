// Self-contained AsyncStorage mock backed by a plain object, so hydrate /
// persist round-trips are testable without native modules.
jest.mock('@react-native-async-storage/async-storage', () => {
  const state = { map: {} };
  return {
    __esModule: true,
    default: {
      __state: state,
      getItem: jest.fn(async (k) => (k in state.map ? state.map[k] : null)),
      setItem: jest.fn(async (k, v) => {
        state.map[k] = String(v);
      }),
      removeItem: jest.fn(async (k) => {
        delete state.map[k];
      }),
    },
  };
});

const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const { AuthStore } = require('../src/core/store/AuthStore');

const SESSION_KEY = 'docutrust.session.v1';
const USER = { id: 'u1', email: 'ada@example.com', fullName: 'Ada Lovelace', role: 'member' };

beforeEach(() => {
  AsyncStorage.__state.map = {};
  AsyncStorage.getItem.mockClear();
  AsyncStorage.setItem.mockClear();
  AsyncStorage.removeItem.mockClear();
  AuthStore.reset();
});

describe('AuthStore session state', () => {
  test('starts empty and unhydrated after reset', () => {
    const s = AuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.hydrated).toBe(false);
  });

  test('setSession stores user and tokens', () => {
    AuthStore.setSession(USER, 'tok-A', 'ref-A');
    const s = AuthStore.getState();
    expect(s.user).toEqual(USER);
    expect(s.accessToken).toBe('tok-A');
    expect(s.refreshToken).toBe('ref-A');
  });

  test('setTokens rotates tokens without touching the user', () => {
    AuthStore.setSession(USER, 'tok-A', 'ref-A');
    AuthStore.setTokens('tok-B', 'ref-B');
    const s = AuthStore.getState();
    expect(s.user).toEqual(USER);
    expect(s.accessToken).toBe('tok-B');
    expect(s.refreshToken).toBe('ref-B');
  });

  test('setUser swaps just the profile', () => {
    AuthStore.setSession(USER, 'tok-A', 'ref-A');
    AuthStore.setUser({ ...USER, role: 'admin' });
    expect(AuthStore.getState().user.role).toBe('admin');
    expect(AuthStore.getState().accessToken).toBe('tok-A');
  });
});

describe('AuthStore persistence', () => {
  test('setSession writes a session snapshot to AsyncStorage', async () => {
    AuthStore.setSession(USER, 'tok-A', 'ref-A');
    await Promise.resolve(); // let the fire-and-forget write settle
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(SESSION_KEY, expect.any(String));
    const saved = JSON.parse(AsyncStorage.__state.map[SESSION_KEY]);
    expect(saved).toEqual({ user: USER, accessToken: 'tok-A', refreshToken: 'ref-A' });
  });

  test('logout removes the persisted snapshot', async () => {
    AuthStore.setSession(USER, 'tok-A', 'ref-A');
    await AuthStore.logout();
    expect(AuthStore.getState().accessToken).toBeNull();
    expect(AuthStore.getState().user).toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(SESSION_KEY);
  });
});

describe('AuthStore hydration', () => {
  test('restores a persisted session and flags hydrated', async () => {
    AsyncStorage.__state.map[SESSION_KEY] = JSON.stringify({ user: USER, accessToken: 'tok-A', refreshToken: 'ref-A' });
    const s = await AuthStore.hydrate();
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(SESSION_KEY);
    expect(s.hydrated).toBe(true);
    expect(s.accessToken).toBe('tok-A');
    expect(s.user).toEqual(USER);
  });

  test('with empty storage it still reports hydrated and stays signed out', async () => {
    const s = await AuthStore.hydrate();
    expect(s.hydrated).toBe(true);
    expect(s.accessToken).toBeNull();
  });

  test('corrupt storage never breaks hydration', async () => {
    AsyncStorage.__state.map[SESSION_KEY] = '{not json';
    const s = await AuthStore.hydrate();
    expect(s.hydrated).toBe(true);
    expect(s.user).toBeNull();
  });
});

describe('AuthStore subscriptions', () => {
  test('listeners fire on commit and stop after unsubscribe', () => {
    const listener = jest.fn();
    const unsub = AuthStore.subscribe(listener);
    AuthStore.setSession(USER, 'tok-A', 'ref-A');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].accessToken).toBe('tok-A');

    unsub();
    AuthStore.setTokens('tok-B', 'ref-B');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('AuthStore role helpers', () => {
  test('isAdmin only for admins', () => {
    AuthStore.setSession({ ...USER, role: 'admin' }, 't', 'r');
    expect(AuthStore.isAdmin()).toBe(true);
    expect(AuthStore.isManager()).toBe(true);

    AuthStore.setSession({ ...USER, role: 'org_manager' }, 't', 'r');
    expect(AuthStore.isAdmin()).toBe(false);
    expect(AuthStore.isManager()).toBe(true);

    AuthStore.setSession({ ...USER, role: 'member' }, 't', 'r');
    expect(AuthStore.isAdmin()).toBe(false);
    expect(AuthStore.isManager()).toBe(false);
  });

  test('helpers are false when signed out', () => {
    expect(AuthStore.isAdmin()).toBe(false);
    expect(AuthStore.isManager()).toBe(false);
  });
});

// LoginPresenter behaviours: validation gate, loading -> success, the
// MFA_REQUIRED branch, and error mapping. Auth API + AuthStore are mocked.
jest.mock('../src/microservices/auth/api', () => ({
  authApi: {
    login: jest.fn(),
    register: jest.fn(),
    verifyEmail: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    me: jest.fn(),
    changePassword: jest.fn(),
    mfaSetup: jest.fn(),
    mfaEnable: jest.fn(),
    mfaDisable: jest.fn(),
    logout: jest.fn(),
  },
}));

jest.mock('../src/core/store/AuthStore', () => ({
  AuthStore: {
    getState: jest.fn(() => ({ user: null, accessToken: null, refreshToken: null, hydrated: true })),
    setSession: jest.fn(),
    setTokens: jest.fn(),
    setUser: jest.fn(),
    logout: jest.fn(async () => {}),
    subscribe: jest.fn(() => () => {}),
  },
}));

const { authApi } = require('../src/microservices/auth/api');
const { AuthStore } = require('../src/core/store/AuthStore');
const { LoginPresenter } = require('../src/microservices/auth/presenters');
const { userFromApi } = require('../src/microservices/auth/model');
const { ApiError } = require('../src/core/api/ApiClient');

const RAW_USER = { id: 'u1', email: 'ada@example.com', fullName: 'Ada Lovelace', role: 'member' };
// The presenter stores the mapped model, not the raw API payload.
const MAPPED_USER = userFromApi(RAW_USER);

function makePresenter() {
  const nav = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() };
  const presenter = new LoginPresenter(nav);
  return { nav, presenter };
}

beforeEach(() => {
  authApi.login.mockReset();
  AuthStore.setSession.mockClear();
});

describe('LoginPresenter validation', () => {
  test('blocks submission before touching the API', async () => {
    const { presenter } = makePresenter();
    presenter.form = { email: 'not-an-email', password: '' };
    await presenter.submit();

    expect(authApi.login).not.toHaveBeenCalled();
    expect(presenter.state.status).toBe('idle');
    expect(presenter.state.fieldErrors.email).toBe('Enter a valid email address.');
    expect(presenter.state.fieldErrors.password).toBe('Enter your password.');
  });
});

describe('LoginPresenter success path', () => {
  test('loading -> success stores the session and clears errors', async () => {
    const { presenter } = makePresenter();
    authApi.login.mockResolvedValueOnce({ user: RAW_USER, accessToken: 'tok-A', refreshToken: 'ref-A' });
    presenter.form = { email: 'Ada@Example.com', password: 'vault2024' };

    await presenter.submit();

    // Email is normalised before the request leaves the client.
    expect(authApi.login).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'vault2024' });
    expect(AuthStore.setSession).toHaveBeenCalledWith(MAPPED_USER, 'tok-A', 'ref-A');
    expect(presenter.state.status).toBe('success');
    expect(presenter.state.data).toEqual(RAW_USER);
    expect(presenter.state.error).toBeNull();
  });
});

describe('LoginPresenter MFA branch', () => {
  test('a 440 MFA_REQUIRED hands off to the Mfa screen with pending credentials', async () => {
    const { nav, presenter } = makePresenter();
    authApi.login.mockRejectedValueOnce(new ApiError(440, 'MFA_REQUIRED', 'Enter your authenticator code'));
    presenter.form = { email: 'ada@example.com', password: 'vault2024' };

    await presenter.submit();

    expect(AuthStore.setSession).not.toHaveBeenCalled();
    expect(nav.navigate).toHaveBeenCalledWith('Mfa', { email: 'ada@example.com', password: 'vault2024' });
    // The challenge screen takes over; login state itself stays clean.
    expect(presenter.state.status).toBe('success');
    expect(presenter.state.error).toBeNull();
  });
});

describe('LoginPresenter error mapping', () => {
  test('maps error codes to the friendly message and status error', async () => {
    const { presenter } = makePresenter();
    authApi.login.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'Bad credentials'));
    presenter.form = { email: 'ada@example.com', password: 'wrong' };

    await presenter.submit();

    expect(presenter.state.status).toBe('error');
    expect(presenter.state.error).toBe('Please sign in again to continue.');
    expect(AuthStore.setSession).not.toHaveBeenCalled();
  });

  test('surfaces field-level errors onto the matching input', async () => {
    const { presenter } = makePresenter();
    authApi.login.mockRejectedValueOnce(new ApiError(400, 'VALIDATION_ERROR', 'Password is incorrect', 'password'));
    presenter.form = { email: 'ada@example.com', password: 'wrong' };

    await presenter.submit();

    expect(presenter.state.fieldErrors.password).toBe('Some details need attention. Check the highlighted fields.');
    expect(presenter.state.status).toBe('error');
  });

  test('network failures still land on the error state', async () => {
    const { presenter } = makePresenter();
    authApi.login.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'offline'));
    presenter.form = { email: 'ada@example.com', password: 'vault2024' };

    await presenter.submit();

    expect(presenter.state.status).toBe('error');
    expect(presenter.state.error).toBe('Cannot reach the vault. Check your connection and try again.');
  });
});

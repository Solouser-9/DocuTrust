// Mock the transport layer and the session store so the client is tested in
// isolation: envelope unwrapping, silent refresh + retry, and reuse logout.
jest.mock('../src/core/config/env', () => ({
  API_URL: 'http://vault.test',
  APP_NAME: 'DocuTrust',
  MAX_FILE_BYTES: 1024,
  publicVerifyUrl: (t) => `http://vault.test/api/public/verify/${t}`,
  publicShareUrl: (t) => `http://vault.test/api/public/shares/${t}`,
}));

// The fake store models real rotation: setTokens mutates what getState returns,
// so the retried request after a refresh carries the new bearer token.
const mockSession = { value: { user: { id: 'u1' }, accessToken: 'tok-A', refreshToken: 'ref-A' } };

jest.mock('../src/core/store/AuthStore', () => ({
  AuthStore: {
    getState: jest.fn(() => ({ ...mockSession.value, hydrated: true })),
    setTokens: jest.fn((accessToken, refreshToken) => {
      mockSession.value = { ...mockSession.value, accessToken, refreshToken };
    }),
    setUser: jest.fn(),
    setSession: jest.fn(),
    logout: jest.fn(async () => {}),
    subscribe: jest.fn(() => () => {}),
  },
}));

const { ApiClient, ApiError, refreshSession } = require('../src/core/api/ApiClient');
const { AuthStore } = require('../src/core/store/AuthStore');

const ok = (data, meta) => ({ ok: true, status: 200, json: async () => ({ ok: true, data, meta: meta || null }) });
const fail = (status, code, message, field) => ({
  ok: false,
  status,
  json: async () => ({ ok: false, error: { code, message, field } }),
});

beforeEach(() => {
  global.fetch = jest.fn();
  mockSession.value = { user: { id: 'u1' }, accessToken: 'tok-A', refreshToken: 'ref-A' };
  AuthStore.getState.mockClear();
  AuthStore.setTokens.mockClear();
  AuthStore.logout.mockClear();
});

describe('ApiClient envelope handling', () => {
  test('unwraps { ok, data, meta } into { data, meta }', async () => {
    global.fetch.mockResolvedValueOnce(ok({ id: 'd1' }, { page: 1, total: 1, pages: 1 }));
    const result = await ApiClient.get('/api/documents');
    expect(global.fetch).toHaveBeenCalledWith('http://vault.test/api/documents', expect.objectContaining({ method: 'GET' }));
    expect(result).toEqual({ data: { id: 'd1' }, meta: { page: 1, total: 1, pages: 1 } });
  });

  test('sends the bearer token and JSON content type for bodies', async () => {
    global.fetch.mockResolvedValueOnce(ok({ done: true }));
    await ApiClient.post('/api/shares', { documentId: 'd1' });
    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer tok-A');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ documentId: 'd1' }));
  });

  test('returns null data for 204 responses', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, status: 204, json: async () => { throw new Error('no body'); } });
    const result = await ApiClient.del('/api/shares/s1');
    expect(result).toEqual({ data: null, meta: null });
  });

  test('throws ApiError with code and field from the error envelope', async () => {
    global.fetch.mockResolvedValueOnce(fail(400, 'VALIDATION_ERROR', 'Email is not valid', 'email'));
    await expect(ApiClient.post('/api/auth/register', { email: 'x' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'VALIDATION_ERROR',
      field: 'email',
    });
  });

  test('treats 200 bodies with ok:false as errors', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: false, error: { code: 'CONFLICT', message: 'Duplicate' } }) });
    await expect(ApiClient.get('/api/documents')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('ApiClient network errors', () => {
  test('maps transport failures to NETWORK_ERROR with status 0', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(ApiClient.get('/api/documents')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});

describe('ApiClient 401 -> refresh -> retry', () => {
  test('silently refreshes once and replays the request with the new token', async () => {
    global.fetch
      .mockImplementationOnce(() => Promise.resolve(fail(401, 'TOKEN_EXPIRED', 'Access token expired')))
      .mockImplementationOnce(() => Promise.resolve(ok({ accessToken: 'tok-B', refreshToken: 'ref-B' })))
      .mockImplementationOnce(() => Promise.resolve(ok({ id: 'd1' })));

    const result = await ApiClient.get('/api/documents/d1');

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch.mock.calls[1][0]).toBe('http://vault.test/api/auth/refresh');
    expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({ refreshToken: 'ref-A' });
    expect(AuthStore.setTokens).toHaveBeenCalledWith('tok-B', 'ref-B');
    expect(global.fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer tok-B');
    expect(result).toEqual({ data: { id: 'd1' }, meta: null });
  });

  test('concurrent 401s share a single refresh flight', async () => {
    let docCalls = 0;
    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/api/auth/refresh')) {
        return Promise.resolve(ok({ accessToken: 'tok-B', refreshToken: 'ref-B' }));
      }
      docCalls += 1;
      if (docCalls <= 2) return Promise.resolve(fail(401, 'TOKEN_EXPIRED', 'expired'));
      return Promise.resolve(ok({ fine: true }));
    });

    const [a, b] = await Promise.all([ApiClient.get('/api/documents'), ApiClient.get('/api/documents')]);

    expect(a.data).toEqual({ fine: true });
    expect(b.data).toEqual({ fine: true });
    const refreshCalls = global.fetch.mock.calls.filter(([url]) => url.endsWith('/api/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });

  test('refresh failure logs the user out and surfaces the error', async () => {
    global.fetch
      .mockImplementationOnce(() => Promise.resolve(fail(401, 'TOKEN_EXPIRED', 'expired')))
      .mockImplementationOnce(() => Promise.resolve(fail(401, 'UNAUTHORIZED', 'Session expired')));

    await expect(ApiClient.get('/api/documents')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(AuthStore.logout).toHaveBeenCalled();
  });
});

describe('ApiClient refresh-token reuse', () => {
  test('409 TOKEN_REUSE revokes the local session and throws', async () => {
    global.fetch.mockResolvedValueOnce(fail(409, 'TOKEN_REUSE', 'Refresh token reuse detected'));

    await expect(ApiClient.get('/api/documents')).rejects.toMatchObject({ status: 409, code: 'TOKEN_REUSE' });
    expect(AuthStore.logout).toHaveBeenCalledTimes(1);
  });

  test('hard 401 while signed in clears the session too', async () => {
    global.fetch.mockResolvedValueOnce(fail(401, 'UNAUTHORIZED', 'Invalid token'));
    await expect(ApiClient.get('/api/documents')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(AuthStore.logout).toHaveBeenCalledTimes(1);
  });

  test('refreshSession without a stored refresh token throws and keeps the store clean', async () => {
    AuthStore.getState.mockReturnValueOnce({ user: null, accessToken: null, refreshToken: null, hydrated: true });
    await expect(refreshSession()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

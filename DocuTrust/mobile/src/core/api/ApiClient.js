import { API_URL } from '../config/env';
import { endpoints } from './endpoints';
import { AuthStore } from '../store/AuthStore';

export class ApiError extends Error {
  constructor(status, code, message, field) {
    super(message || code || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'UNKNOWN';
    this.field = field || null;
  }
}

// Single-flight refresh: concurrent 401s share one refresh call.
let refreshFlight = null;

export function refreshSession() {
  if (!refreshFlight) {
    refreshFlight = (async () => {
      const { refreshToken } = AuthStore.getState();
      if (!refreshToken) throw new ApiError(401, 'UNAUTHORIZED', 'Not signed in');
      const res = await fetch(API_URL + endpoints.refresh(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.ok === false) {
        await AuthStore.logout();
        const err = (json && json.error) || {};
        throw new ApiError(res.status, err.code || 'UNAUTHORIZED', err.message || 'Session expired, please sign in again.');
      }
      AuthStore.setTokens(json.data.accessToken, json.data.refreshToken);
      return json.data.accessToken;
    })().finally(() => {
      refreshFlight = null;
    });
  }
  return refreshFlight;
}

function buildHeaders(body, auth, extra) {
  const h = { ...(extra || {}) };
  if (body !== undefined && !(body instanceof FormData)) h['Content-Type'] = 'application/json';
  if (auth) {
    const token = AuthStore.getState().accessToken;
    if (token) h.Authorization = `Bearer ${token}`;
  }
  return h;
}

function buildBody(body) {
  if (body === undefined) return undefined;
  if (body instanceof FormData) return body;
  return JSON.stringify(body);
}

async function request(method, path, opts = {}, retried = false) {
  const { body, auth = true, headers } = opts;
  let res;
  try {
    res = await fetch(API_URL + path, { method, headers: buildHeaders(body, auth, headers), body: buildBody(body) });
  } catch (e) {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the vault. Check your connection and try again.');
  }

  if (res.status === 204) return { data: null, meta: null };

  const json = await res.json().catch(() => null);
  const err = (json && json.error) || {};

  if (res.ok && json && json.ok !== false) {
    return { data: json.data, meta: json.meta || null };
  }

  // Silent refresh + one retry when the access token merely expired.
  if (res.status === 401 && err.code === 'TOKEN_EXPIRED' && auth && !retried) {
    await refreshSession();
    return request(method, path, opts, true);
  }

  // Refresh-token reuse or a hard 401 while signed in: the family is compromised.
  const signedIn = !!AuthStore.getState().accessToken;
  if ((res.status === 409 && err.code === 'TOKEN_REUSE') || (res.status === 401 && err.code === 'UNAUTHORIZED' && signedIn)) {
    await AuthStore.logout();
  }

  const apiError = new ApiError(res.status, err.code, err.message, err.field);
  apiError.body = json; // e.g. the MFA_EMAIL_CHALLENGE 440 payload carries the challenge token
  throw apiError;
}

export const ApiClient = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  del: (path, opts) => request('DELETE', path, opts),
};

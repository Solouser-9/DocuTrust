// BasePresenter: the M in MVP plus the state machine every screen renders.
// status: idle | loading | success | error | empty
import { ApiError } from '../core/api/ApiClient';

const FRIENDLY = {
  NETWORK_ERROR: 'Cannot reach the vault. Check your connection and try again.',
  VALIDATION_ERROR: 'Some details need attention. Check the highlighted fields.',
  UNAUTHORIZED: 'Please sign in again to continue.',
  FORBIDDEN: 'Your account does not have access to that.',
  NOT_FOUND: 'That record no longer exists.',
  CONFLICT: 'That conflicts with an existing record.',
  RATE_LIMITED: 'Too many attempts. Please wait a minute and try again.',
  FILE_TOO_LARGE: 'Files must be 25 MB or smaller.',
  UNSUPPORTED_MEDIA_TYPE: 'That file type is not supported. Use PDF, image, DOC or DOCX.',
  SHARE_PASSCODE_REQUIRED: 'This share is protected by a passcode.',
  SHARE_PASSCODE_INVALID: 'That passcode is not correct.',
  SHARE_EXPIRED: 'This share link has expired.',
  SHARE_REVOKED: 'This share link was revoked by its owner.',
  SHARE_MAX_VIEWS: 'This share link has reached its view limit.',
  GONE: 'This link is no longer available.',
  INTERNAL_ERROR: 'The vault hit an unexpected error. Try again shortly.',
};

export function friendlyError(e) {
  if (!e) return 'Something went wrong.';
  if (FRIENDLY[e.code]) return FRIENDLY[e.code];
  return e.message || 'Something went wrong.';
}

export class BasePresenter {
  constructor(nav) {
    this.nav = nav || null;
    this.state = { status: 'idle', data: null, error: null, fieldErrors: {} };
    this._alive = true;
    this._view = null;
  }

  attach(view) {
    this._alive = true;
    this._view = view;
    this._view(this.state);
  }

  detach() {
    this._view = null;
  }

  destroy() {
    this._alive = false;
    this.detach();
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    if (this._view && this._alive) this._view(this.state);
  }

  setLoading() {
    this.setState({ status: 'loading', error: null });
  }

  setSuccess(data) {
    this.setState({ status: 'success', data, error: null });
  }

  setEmpty() {
    this.setState({ status: 'empty', data: null, error: null });
  }

  setError(error) {
    this.setState({ status: 'error', error });
  }

  // Maps any thrown value to a human message, mirrors it into state, and returns it.
  handleError(e) {
    const message = friendlyError(e);
    this.setState({ error: message });
    return message;
  }

  busy() {
    return this.state.status === 'loading';
  }

  go(name, params) {
    if (this.nav && this.nav.navigate) this.nav.navigate(name, params);
  }

  goBack() {
    if (this.nav && this.nav.goBack) this.nav.goBack();
  }
}

export { ApiError };

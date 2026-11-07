import { ToastStore } from '../../core/store/ToastStore';
import { AuthStore } from '../../core/store/AuthStore';
import { BasePresenter } from '../../mvp/BasePresenter';
import { profileApi } from './api';
import { FAQ_ITEMS, accountRows } from './model';
import { authApi } from '../auth/api';
import { userFromApi } from '../auth/model';

export class ProfilePresenter extends BasePresenter {
  async load() {
    const user = AuthStore.getState().user;
    this.setSuccess({ user, rows: accountRows(user) });
    try {
      const { data: res } = await authApi.me();
      const fresh = userFromApi(res.user);
      await AuthStore.setUser(fresh);
      this.setSuccess({ user: fresh, rows: accountRows(fresh) });
    } catch (e) {
      // offline-friendly: keep the cached profile
    }
  }

  async logout() {
    try {
      const { refreshToken } = AuthStore.getState();
      if (refreshToken) await authApi.logout(refreshToken);
    } catch (e) {
      // best-effort server revocation
    }
    await AuthStore.logout();
  }
}

export class EditProfilePresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    const user = AuthStore.getState().user || {};
    this.form = { fullName: user.fullName || '', phone: user.phone || '' };
  }

  setField(key, value) {
    this.form[key] = value;
    this.setState({ data: { form: this.form }, fieldErrors: { ...this.state.fieldErrors, [key]: null } });
  }

  async submit() {
    if (!this.form.fullName.trim()) {
      this.setState({ fieldErrors: { fullName: 'Your name is required.' } });
      return;
    }
    this.setLoading();
    try {
      const res = await profileApi.updateMe({
        fullName: this.form.fullName.trim(),
        phone: this.form.phone.trim() || undefined,
      });
      await AuthStore.setUser(userFromApi(res.user));
      ToastStore.success('Profile saved.');
      this.goBack();
    } catch (e) {
      const message = this.handleError(e);
      this.setState({ fieldErrors: e.field ? { [e.field]: message } : {} });
    }
  }
}

export { ChangePasswordPresenter } from '../auth/presenters';

export class SecurityPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.secret = null;
    this.otpauthUrl = null;
  }

  async load() {
    const user = AuthStore.getState().user || {};
    this.setSuccess({ user, mfaEnabled: !!user.mfaEnabled, sessions: [], sessionsLoading: true });
    await this.loadSessions();
  }

  async loadSessions() {
    this.setState({
      data: { ...(this.state.data || {}), sessionsLoading: true, sessionsError: null },
    });
    try {
      const { data: sessions } = await profileApi.getSessions();
      this.setState({
        data: { ...(this.state.data || {}), sessions: sessions || [], sessionsLoading: false },
      });
    } catch (e) {
      const message = this.handleError(e);
      this.setState({
        error: message,
        data: { ...(this.state.data || {}), sessions: [], sessionsLoading: false, sessionsError: message },
      });
    }
  }

  async revokeSession(id) {
    this.setState({ revokingSessionId: id });
    try {
      const { data } = await profileApi.revokeSession(id);
      if (data && data.revoked) ToastStore.success('Session revoked.');
      else ToastStore.info('Session is no longer active.');
      await this.loadSessions();
    } catch (e) {
      ToastStore.error(this.handleError(e));
    } finally {
      this.setState({ revokingSessionId: null });
    }
  }

  async startSetup() {
    this.setLoading();
    try {
      const res = await profileApi.mfaSetup();
      const { secret, otpauthUrl } = res.data;
      this.secret = secret;
      this.otpauthUrl = otpauthUrl;
      this.setState({ status: 'success', data: { ...(this.state.data || {}), setup: true, secret, otpauthUrl } });
    } catch (e) {
      ToastStore.error(this.handleError(e));
      await this.load();
    }
  }

  async confirmSetup(code) {
    console.log('Submitting MFA confirmation (code length):', typeof code === 'string' ? code.length : 0);
    if (!this.secret || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      ToastStore.error('Enter the six-digit code.');
      return;
    }
    this.setLoading();
    try {
      const { data: result } = await authApi.mfaEnable(this.secret, code);
      this.secret = null;
      this.otpauthUrl = null;
      const user = AuthStore.getState().user || {};
      await AuthStore.setUser({ ...user, mfaEnabled: !!result.mfaEnabled });
      ToastStore.success('MFA enabled.');
      await this.load();
    } catch (e) {
      console.error(e);
      const message = e && e.message ? e.message : this.handleError(e);
      this.setState({ error: message });
      if (e && e.field === 'code') {
        this.setState({ fieldErrors: { ...this.state.fieldErrors, code: message } });
      } else {
        ToastStore.error(message);
      }
    } finally {
      this.setLoading(false);
    }
  }

  async disable(code) {
    this.setLoading();
    try {
      await profileApi.mfaDisable(code);
      const me = await profileApi.me();
      await AuthStore.setUser(userFromApi(me.user));
      ToastStore.info('MFA disabled.');
      await this.load();
    } catch (e) {
      const message = this.handleError(e);
      if (e && e.field === 'code') {
        this.setState({ fieldErrors: { ...this.state.fieldErrors, code: e.message || message } });
      } else {
        ToastStore.error(message);
      }
      this.setState({ status: 'success' });
    }
  }
}

export class HelpPresenter extends BasePresenter {
  async load() {
    this.setSuccess({ faq: FAQ_ITEMS, openIndex: -1 });
    try {
      const res = await profileApi.meta();
      this.setState({ data: { ...(this.state.data || {}), meta: res.data } });
    } catch (e) {
      // meta is decorative
    }
  }

  toggle(index) {
    const current = this.state.data || {};
    this.setState({ data: { ...current, openIndex: current.openIndex === index ? -1 : index } });
  }
}

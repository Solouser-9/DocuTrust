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
      const res = await profileApi.me();
      const fresh = userFromApi(res.user);
      AuthStore.setUser(fresh);
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
      AuthStore.setUser(userFromApi(res.user));
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
    this.setSuccess({ user, mfaEnabled: !!user.mfaEnabled, sessions: [{ id: 'current', device: 'This device', current: true }] });
  }

  async startSetup() {
    this.setLoading();
    try {
      const res = await profileApi.mfaSetup();
      this.secret = res.secret;
      this.otpauthUrl = res.otpauthUrl;
      this.setState({ status: 'success', data: { ...(this.state.data || {}), setup: true, secret: res.secret, otpauthUrl: res.otpauthUrl } });
    } catch (e) {
      ToastStore.error(this.handleError(e));
      await this.load();
    }
  }

  async confirmSetup(code) {
    if (!this.secret || !code || code.length !== 6) {
      ToastStore.error('Enter the six-digit code.');
      return;
    }
    this.setLoading();
    try {
      await profileApi.mfaEnable(this.secret, code);
      this.secret = null;
      this.otpauthUrl = null;
      const me = await profileApi.me();
      AuthStore.setUser(userFromApi(me.user));
      ToastStore.success('MFA enabled.');
      await this.load();
    } catch (e) {
      ToastStore.error(this.handleError(e));
      this.setState({ status: 'success' });
    }
  }

  async disable(code) {
    this.setLoading();
    try {
      await profileApi.mfaDisable(code);
      const me = await profileApi.me();
      AuthStore.setUser(userFromApi(me.user));
      ToastStore.info('MFA disabled.');
      await this.load();
    } catch (e) {
      ToastStore.error(this.handleError(e));
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

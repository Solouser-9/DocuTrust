import { AuthStore } from '../../core/store/AuthStore';
import { ToastStore } from '../../core/store/ToastStore';
import { BasePresenter } from '../../mvp/BasePresenter';
import { validateChangePassword, validateLogin, validateRegister, validateReset } from '../../core/utils/validators';
import { authApi } from './api';
import { userFromApi } from './model';

const hasErrors = (errors) => Object.values(errors).some(Boolean);

export class SplashPresenter extends BasePresenter {
  bootstrap() {
    setTimeout(() => {
      const { user, accessToken } = AuthStore.getState();
      if (user && accessToken) {
        if (this.nav && this.nav.replace) this.nav.replace('Dashboard');
      } else if (this.nav && this.nav.replace) {
        this.nav.replace('Onboarding');
      }
    }, 850);
  }
}

const ONBOARDING_PAGES = [
  {
    eyebrow: 'The Vault',
    quote: 'Paper fades, cupboards flood, drawers stick. Your records deserve a locked room that never closes.',
    detail: 'Encrypted at rest with AES-256-GCM. Keys never leave the server environment.',
  },
  {
    eyebrow: 'The Seal',
    quote: 'Every document is fingerprinted the moment it arrives — and the fingerprint never changes silently.',
    detail: 'SHA-256 is recomputed on every read. Tampering announces itself.',
  },
  {
    eyebrow: 'The Proof',
    quote: 'When someone asks "is this real?", send a sealed link — not the file itself.',
    detail: 'Verification links prove integrity without ever releasing the bytes.',
  },
];

export class OnboardingPresenter extends BasePresenter {
  pages() {
    return ONBOARDING_PAGES;
  }
  complete() {
    if (this.nav) this.nav.replace('Login');
  }
}

export class LoginPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.form = { email: '', password: '' };
  }

  setField(key, value) {
    this.form[key] = value;
    this.setState({ fieldErrors: { ...this.state.fieldErrors, [key]: null } });
  }

  async submit() {
    const errors = validateLogin(this.form);
    if (hasErrors(errors)) {
      this.setState({ fieldErrors: errors });
      return;
    }
    this.setLoading();
    try {
      const res = await authApi.login({ email: this.form.email.trim().toLowerCase(), password: this.form.password });
      AuthStore.setSession(userFromApi(res.user), res.accessToken, res.refreshToken);
      this.setSuccess(res.user);
      // Root gate switches to the main stack once the session lands.
    } catch (e) {
      if (e.code === 'MFA_REQUIRED') {
        this.setSuccess(null);
        this.go('Mfa', { email: this.form.email.trim().toLowerCase(), password: this.form.password });
        return;
      }
      const message = this.handleError(e);
      this.setError(message);
      const fieldErrors = e.field ? { [e.field]: message } : {};
      this.setState({ fieldErrors });
    }
  }
}

export class RegisterPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.form = { accountType: 'personal', fullName: '', email: '', phone: '', password: '', orgName: '' };
  }

  setAccountType(value) {
    this.form.accountType = value;
    this.setState({ data: { accountType: value }, fieldErrors: {} });
  }

  setField(key, value) {
    this.form[key] = value;
    this.setState({ fieldErrors: { ...this.state.fieldErrors, [key]: null } });
  }

  async submit() {
    const errors = validateRegister(this.form);
    if (hasErrors(errors)) {
      this.setState({ fieldErrors: errors });
      return;
    }
    this.setLoading();
    try {
      const payload = {
        email: this.form.email.trim().toLowerCase(),
        password: this.form.password,
        fullName: this.form.fullName.trim(),
        phone: this.form.phone.trim() || undefined,
        orgName: this.form.accountType === 'org' ? this.form.orgName.trim() : undefined,
      };
      const res = await authApi.register(payload);
      AuthStore.setSession(userFromApi(res.user), res.accessToken, res.refreshToken);
      this.setSuccess(res.user);
      ToastStore.info('Check your inbox to verify your email.');
    } catch (e) {
      const message = this.handleError(e);
      this.setError(message);
      this.setState({ fieldErrors: e.field ? { [e.field]: message } : {} });
    }
  }
}

export class VerifyEmailPresenter extends BasePresenter {
  async check(token) {
    if (!token) {
      this.setState({ status: 'idle' });
      return;
    }
    this.setLoading();
    try {
      await authApi.verifyEmail(token);
      if (AuthStore.getState().user) AuthStore.setUser({ ...AuthStore.getState().user, emailVerified: true });
      this.setSuccess({ verified: true });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }
}

export class ForgotPasswordPresenter extends BasePresenter {
  async submit(email) {
    if (!email || !email.includes('@')) {
      this.setState({ fieldErrors: { email: 'Enter a valid email address.' } });
      return;
    }
    this.setLoading();
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      // The endpoint never reveals whether the account exists.
      this.setSuccess({ sent: true, email });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }
}

export class ResetPasswordPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.form = { email: '', code: '', newPassword: '', confirmPassword: '' };
  }

  setField(key, value) {
    this.form[key] = value;
    this.setState({ fieldErrors: { ...this.state.fieldErrors, [key]: null } });
  }

  /** Prefill from the forgot-password screen (route params). */
  configure(email) {
    if (email) {
      this.form.email = email;
      this.setState({ data: { email } });
    }
  }

  async submit() {
    const errors = validateReset(this.form);
    if (!this.form.email || !this.form.email.includes('@')) errors.email = 'Enter the email the code was sent to.';
    if (this.form.confirmPassword !== this.form.newPassword) errors.confirmPassword = 'Passwords do not match.';
    if (hasErrors(errors)) {
      this.setState({ fieldErrors: errors });
      return;
    }
    this.setLoading();
    try {
      await authApi.resetPasswordOtp(this.form.email.trim().toLowerCase(), this.form.code.trim(), this.form.newPassword);
      this.setSuccess({ reset: true });
    } catch (e) {
      const message = this.handleError(e);
      this.setError(message);
      this.setState({ fieldErrors: e.field ? { [e.field]: message } : {} });
    }
  }
}

// Pure login-challenge presenter: receives the pending credentials from
// LoginPresenter after a 440 MFA_REQUIRED and finishes the handshake - either with the
// authenticator (TOTP) or, as the fallback, with a 6-digit code emailed to the account.
export class MfaPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.email = '';
    this.password = '';
    this.code = '';
    this.challenge = null; // set once the email-MFA challenge has been issued
  }

  configure(email, password) {
    this.email = email || '';
    this.password = password || '';
  }

  setCode(code) {
    this.code = String(code || '').replace(/\D/g, '').slice(0, 6);
    this.setState({ data: { code: this.code, mode: this.challenge ? 'email' : 'totp' }, fieldErrors: {} });
  }

  get mode() {
    return this.challenge ? 'email' : 'totp';
  }

  /** "Email me a code instead": password was already accepted, so this re-runs login with useEmailMfa. */
  async sendEmailCode() {
    this.setLoading();
    try {
      const res = await authApi.login({ email: this.email, password: this.password, useEmailMfa: true });
      // Only reachable if MFA was disabled in the meantime - a plain 200 means we are in.
      AuthStore.setSession(userFromApi(res.user), res.accessToken, res.refreshToken);
      this.setSuccess(res.user);
    } catch (e) {
      if (e.code === 'MFA_EMAIL_CHALLENGE' && e.body && e.body.challenge) {
        this.challenge = e.body.challenge;
        this.code = '';
        this.setState({ status: 'idle', data: { code: '', mode: 'email' }, fieldErrors: {}, error: null });
        ToastStore.info(`Code sent to ${e.body.email || 'your email'}.`);
        return;
      }
      this.setError(this.handleError(e));
    }
  }

  async submit() {
    if (this.code.length !== 6) {
      this.setState({ fieldErrors: { code: 'Enter all six digits.' } });
      return;
    }
    this.setLoading();
    try {
      if (this.challenge) {
        // Email-MFA path: exchange challenge + emailed OTP for the real session tokens.
        const res = await authApi.verifyOtp(this.challenge, this.code);
        AuthStore.setSession(userFromApi(res.user), res.accessToken, res.refreshToken);
        this.setSuccess(res.user);
        return;
      }
      const res = await authApi.login({ email: this.email, password: this.password, mfaCode: this.code });
      AuthStore.setSession(userFromApi(res.user), res.accessToken, res.refreshToken);
      this.setSuccess(res.user);
    } catch (e) {
      const message = this.handleError(e);
      this.setError(message);
      this.setState({ fieldErrors: e.code ? { code: message } : {} });
    }
  }
}

export class ChangePasswordPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.form = { currentPassword: '', newPassword: '', confirmPassword: '' };
    this.stepUpToken = null; // short-lived second-factor token from verify-step-up
  }

  setField(key, value) {
    this.form[key] = value;
    this.setState({ fieldErrors: { ...this.state.fieldErrors, [key]: null } });
  }

  async submit() {
    const errors = validateChangePassword(this.form);
    if (hasErrors(errors)) {
      this.setState({ fieldErrors: errors });
      return;
    }
    this.setLoading();
    try {
      await authApi.changePassword(this.form.currentPassword, this.form.newPassword, this.stepUpToken);
      this.setSuccess({ changed: true });
      ToastStore.success('Password updated.');
      this.goBack();
    } catch (e) {
      if (e.code === 'STEP_UP_REQUIRED') {
        // Sensitive action: the server demands a fresh emailed code before it will touch the password.
        try {
          await authApi.requestStepUp();
          this.stepUpToken = null;
          this.setState({ status: 'idle', data: { stepUpRequired: true }, fieldErrors: {}, error: null });
          ToastStore.info('We emailed you a 6-digit code to confirm this change.');
        } catch (e2) {
          this.setError(this.handleError(e2));
        }
        return;
      }
      const message = this.handleError(e);
      this.setError(message);
      this.setState({ fieldErrors: e.field ? { [e.field]: message } : {} });
    }
  }

  /** Second phase: the user typed the emailed code -> trade it for a step-up token and retry. */
  async confirmStepUp(code) {
    this.setLoading();
    try {
      const res = await authApi.verifyStepUp(code);
      this.stepUpToken = res.stepUpToken;
      await authApi.changePassword(this.form.currentPassword, this.form.newPassword, this.stepUpToken);
      this.setSuccess({ changed: true });
      ToastStore.success('Password updated.');
      this.goBack();
    } catch (e) {
      const message = this.handleError(e);
      this.setError(message);
      this.setState({ fieldErrors: e.code ? { code: message } : {} });
    }
  }
}

export class SecurityMfaPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.secret = null;
    this.otpauthUrl = null;
  }

  async load() {
    const { user } = AuthStore.getState();
    this.setSuccess({ mfaEnabled: !!(user && user.mfaEnabled) });
  }

  async startSetup() {
    this.setLoading();
    try {
      const res = await authApi.mfaSetup();
      this.secret = res.secret;
      this.otpauthUrl = res.otpauthUrl;
      this.setState({ status: 'success', data: { mfaEnabled: false, setup: true, secret: res.secret, otpauthUrl: res.otpauthUrl } });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  async confirm(code) {
    if (!this.secret) return;
    this.setLoading();
    try {
      await authApi.mfaEnable(this.secret, code);
      this.secret = null;
      this.otpauthUrl = null;
      const me = await authApi.me();
      AuthStore.setUser(userFromApi(me.user));
      this.setSuccess({ mfaEnabled: true });
      ToastStore.success('MFA enabled for this account.');
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  async disable(code) {
    this.setLoading();
    try {
      await authApi.mfaDisable(code);
      const me = await authApi.me();
      AuthStore.setUser(userFromApi(me.user));
      this.setSuccess({ mfaEnabled: false });
      ToastStore.info('MFA disabled.');
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }
}

export class LogoutPresenter extends BasePresenter {
  async logout() {
    try {
      const { refreshToken } = AuthStore.getState();
      if (refreshToken) await authApi.logout(refreshToken);
    } catch (e) {
      // Server-side revocation is best-effort; the local session always dies.
    }
    await AuthStore.logout();
  }
}

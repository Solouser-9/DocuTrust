import { AuthStore } from '../../core/store/AuthStore';
import { ToastStore } from '../../core/store/ToastStore';
import { BasePresenter } from '../../mvp/BasePresenter';
import { validateChangePassword, validateLogin, validateRegister, validateReset } from '../../core/utils/validators';
import { authApi } from './api';
import { userFromApi } from './model';

const hasErrors = (errors) => Object.values(errors).some(Boolean);

export class SplashPresenter extends BasePresenter {
  bootstrap() {
    if (AuthStore.getState().hydrated) return;
    return new Promise((resolve) => {
      const unsubscribe = AuthStore.subscribe(() => { if (AuthStore.getState().hydrated) { unsubscribe(); resolve(); } });
    });
  }
}

const ONBOARDING_PAGES = [
  { eyebrow: 'The Vault', quote: 'Paper fades, cupboards flood, drawers stick. Your records deserve a locked room that never closes.', detail: 'Encrypted at rest with AES-256-GCM. Keys never leave the server environment.' },
  { eyebrow: 'The Seal', quote: 'Every document is fingerprinted the moment it arrives — and the fingerprint never changes silently.', detail: 'SHA-256 is recomputed on every read. Tampering announces itself.' },
  { eyebrow: 'The Proof', quote: 'When someone asks "is this real?", send a sealed link — not the file itself.', detail: 'Verification links prove integrity without ever releasing the bytes.' },
];

export class OnboardingPresenter extends BasePresenter {
  pages() { return ONBOARDING_PAGES; }
  complete() { if (this.nav) this.nav.replace('Login'); }
}

export class LoginPresenter extends BasePresenter {
  constructor(nav) { super(nav); this.form = { email: '', password: '' }; }
  setField(key, value) { this.form[key] = value; this.setState({ fieldErrors: { ...this.state.fieldErrors, [key]: null } }); }

  async submit() {
    if (this.state.status === 'loading') return;
    const errors = validateLogin(this.form);
    if (hasErrors(errors)) { this.setState({ fieldErrors: errors }); return; }
    this.setLoading();
    try {
      const { data: res } = await authApi.login({ email: this.form.email.trim().toLowerCase(), password: this.form.password });
      this.setSuccess(res.user);
      await AuthStore.setSession(userFromApi(res.user), res.accessToken, res.refreshToken);
    } catch (e) {
      if (e.code === 'MFA_REQUIRED') { this.setSuccess(null); this.go('Mfa', { email: this.form.email.trim().toLowerCase(), password: this.form.password }); return; }
      if (e.code === 'EMAIL_NOT_VERIFIED' || (e.message && e.message.toLowerCase().includes('verify your email'))) { this.setSuccess(null); ToastStore.info('Please verify your email. We sent you a new code.'); this.go('VerifyOtp', { email: this.form.email.trim().toLowerCase() }); return; }
      const message = this.handleError(e); this.setError(message); this.setState({ fieldErrors: e.field ? { [e.field]: message } : {} });
    }
  }
}

export class RegisterPresenter extends BasePresenter {
  constructor(nav) { super(nav); this.form = { accountType: 'personal', fullName: '', email: '', phone: '', password: '', orgName: '' }; }
  setAccountType(value) { this.form.accountType = value; this.setState({ data: { accountType: value }, fieldErrors: {} }); }
  setField(key, value) { this.form[key] = value; this.setState({ fieldErrors: { ...this.state.fieldErrors, [key]: null } }); }

  async submit() {
    if (this.state.status === 'loading') return;
    const errors = validateRegister(this.form);
    if (hasErrors(errors)) { this.setState({ status: 'idle', error: null, fieldErrors: errors }); return; }
    this.setLoading();
    try {
      const payload = { email: this.form.email.trim().toLowerCase(), password: this.form.password, fullName: this.form.fullName.trim(), phone: this.form.phone.trim() || undefined, orgName: this.form.accountType === 'org' ? this.form.orgName.trim() : undefined };
      const { data: res } = await authApi.register(payload);
      this.setSuccess(res.user); this.go('VerifyOtp', { email: payload.email }); ToastStore.info('Enter the 6-digit code we emailed you.');
    } catch (e) { const message = this.handleError(e); this.setError(message); this.setState({ fieldErrors: e.field ? { [e.field]: message } : {} }); }
  }
}

export class VerifyOtpPresenter extends BasePresenter {
  constructor(nav) { super(nav); this.email = ''; this.code = ''; }
  configure(email) { this.email = email || ''; this.setState({ data: { email: this.email, code: this.code } }); }
  setCode(code) { this.code = String(code || '').replace(/\D/g, '').slice(0, 6); this.setState({ data: { email: this.email, code: this.code }, fieldErrors: {} }); }

  async submit() {
    if (this.state.status === 'loading') return;
    if (this.code.length !== 6) { this.setState({ fieldErrors: { code: 'Enter all six digits.' } }); return; }
    this.setLoading();
    try {
      const { data: res } = await authApi.verifyOtp({ email: this.email.trim().toLowerCase(), otp: this.code });
      this.setSuccess(res.user); await AuthStore.setSession(userFromApi(res.user), res.accessToken, res.refreshToken);
    } catch (e) { const message = this.handleError(e); this.setError(message); this.setState({ fieldErrors: { code: message } }); }
  }

  async resend() {
    if (this.state.status === 'loading') return;
    this.setLoading();
    try { await authApi.resendOtp(this.email.trim().toLowerCase()); ToastStore.info('A new code has been sent to your email.'); this.setState({ status: 'idle', error: null, fieldErrors: {} }); }
    catch (e) { this.setError(this.handleError(e)); }
  }
}

export class VerifyEmailPresenter extends BasePresenter {
  async check(token) {
    if (!token) { this.setState({ status: 'idle' }); return; }
    if (this.state.status === 'loading') return;
    this.setLoading();
    try { await authApi.verifyEmail(token); if (AuthStore.getState().user) await AuthStore.setUser({ ...AuthStore.getState().user, emailVerified: true }); this.setSuccess({ verified: true }); }
    catch (e) { this.setError(this.handleError(e)); }
  }
}

export class ForgotPasswordPresenter extends BasePresenter {
  async submit(email) {
    if (this.state.status === 'loading') return;
    if (!email || !email.includes('@')) { this.setState({ fieldErrors: { email: 'Enter a valid email address.' } }); return; }
    this.setLoading();
    try { await authApi.forgotPassword(email.trim().toLowerCase()); this.setSuccess({ sent: true, email }); }
    catch (e) { this.setError(this.handleError(e)); }
  }
}

export class ResetPasswordPresenter extends BasePresenter {
  constructor(nav) { super(nav); this.form = { email: '', code: '', newPassword: '', confirmPassword: '' }; }
  setField(key, value) { this.form[key] = value; this.setState({ fieldErrors: { ...this.state.fieldErrors, [key]: null } }); }
  configure(email) { if (email) { this.form.email = email; this.setState({ data: { email } }); } }

  async submit() {
    if (this.state.status === 'loading') return;
    const errors = validateReset(this.form);
    if (!this.form.email || !this.form.email.includes('@')) errors.email = 'Enter the email the code was sent to.';
    if (this.form.confirmPassword !== this.form.newPassword) errors.confirmPassword = 'Passwords do not match.';
    if (hasErrors(errors)) { this.setState({ fieldErrors: errors }); return; }
    this.setLoading();
    try { await authApi.resetPasswordOtp(this.form.email.trim().toLowerCase(), this.form.code.trim(), this.form.newPassword); this.setSuccess({ reset: true }); }
    catch (e) { const message = this.handleError(e); this.setError(message); this.setState({ fieldErrors: e.field ? { [e.field]: message } : {} }); }
  }

  async resend() {
    if (this.state.status === 'loading') return;
    this.setLoading();
    try { await authApi.resendOtp(this.form.email.trim().toLowerCase()); ToastStore.info('A new reset code has been sent to your email.'); this.setState({ status: 'idle', error: null, fieldErrors: {} }); }
    catch (e) { this.setError(this.handleError(e)); }
  }
}

export class MfaPresenter extends BasePresenter {
  constructor(nav) { super(nav); this.email = ''; this.password = ''; this.code = ''; this.challenge = null; }
  configure(email, password) { this.email = email || ''; this.password = password || ''; }
  setCode(code) { this.code = String(code || '').replace(/\D/g, '').slice(0, 6); this.setState({ data: { code: this.code, mode: this.challenge ? 'email' : 'totp' }, fieldErrors: {} }); }
  get mode() { return this.challenge ? 'email' : 'totp'; }

  async sendEmailCode() {
    if (this.state.status === 'loading') return;
    this.setLoading();
    try {
      const { data: res } = await authApi.login({ email: this.email, password: this.password, useEmailMfa: true });
      this.setSuccess(res.user); await AuthStore.setSession(userFromApi(res.user), res.accessToken, res.refreshToken);
    } catch (e) {
      if (e.code === 'MFA_EMAIL_CHALLENGE' && e.body && e.body.challenge) {
        this.challenge = e.body.challenge; this.code = '';
        this.setState({ status: 'idle', data: { code: '', mode: 'email' }, fieldErrors: {}, error: null });
        ToastStore.info(`Code sent to ${e.body.email || 'your email'}.`); return;
      }
      this.setError(this.handleError(e));
    }
  }

  async submit() {
    if (this.state.status === 'loading') return;
    if (this.code.length !== 6) { this.setState({ fieldErrors: { code: 'Enter all six digits.' } }); return; }
    this.setLoading();
    try {
      if (this.challenge) {
        const { data: res } = await authApi.verifyOtp({ challenge: this.challenge, code: this.code });
        this.setSuccess(res.user); await AuthStore.setSession(userFromApi(res.user), res.accessToken, res.refreshToken); return;
      }
      const { data: res } = await authApi.login({ email: this.email, password: this.password, mfaCode: this.code });
      this.setSuccess(res.user); await AuthStore.setSession(userFromApi(res.user), res.accessToken, res.refreshToken);
    } catch (e) { const message = this.handleError(e); this.setError(message); this.setState({ fieldErrors: e.code ? { code: message } : {} }); }
  }
}

export class ChangePasswordPresenter extends BasePresenter {
  constructor(nav) { super(nav); this.form = { currentPassword: '', newPassword: '', confirmPassword: '' }; this.stepUpToken = null; }
  setField(key, value) { this.form[key] = value; this.setState({ fieldErrors: { ...this.state.fieldErrors, [key]: null } }); }

  validateForm() {
    const errors = validateChangePassword(this.form);
    if (this.form.newPassword && this.form.newPassword === this.form.currentPassword) errors.newPassword = 'New password must be different from the old password.';
    if (this.form.newPassword !== this.form.confirmPassword) errors.confirmPassword = 'New passwords do not match.';
    return errors;
  }

  async submit() {
    if (this.state.status === 'loading') return;
    const errors = this.validateForm();
    if (hasErrors(errors)) { this.setState({ fieldErrors: errors }); return; }
    this.setLoading();
    try {
      await authApi.changePassword(this.form.currentPassword, this.form.newPassword, this.stepUpToken);
      this.setSuccess({ changed: true }); ToastStore.success('Password updated.'); this.goBack();
    } catch (e) {
      if (e.code === 'STEP_UP_REQUIRED') {
        try { await authApi.requestStepUp(); this.stepUpToken = null; this.setState({ status: 'idle', data: { stepUpRequired: true }, fieldErrors: {}, error: null }); ToastStore.info('We emailed you a 6-digit code to confirm this change.'); }
        catch (e2) { this.setError(this.handleError(e2)); }
        return;
      }
      const message = this.handleError(e); this.setError(message); this.setState({ fieldErrors: e.field ? { [e.field]: message } : {} });
    }
  }

  async confirmStepUp(code) {
    if (this.state.status === 'loading') return;
    const errors = this.validateForm();
    if (hasErrors(errors)) { this.setState({ fieldErrors: errors }); return; }
    this.setLoading();
    try {
      const res = await authApi.verifyStepUp(code);
      this.stepUpToken = res.data.stepUpToken;
      await authApi.changePassword(this.form.currentPassword, this.form.newPassword, this.stepUpToken);
      this.setSuccess({ changed: true }); ToastStore.success('Password updated.'); this.goBack();
    } catch (e) { const message = this.handleError(e); this.setError(message); this.setState({ fieldErrors: e.code ? { code: message } : {} }); }
  }

  async resendStepUp() {
    if (this.state.status === 'loading') return;
    this.setLoading();
    try {
      await authApi.requestStepUp();
      this.setState({ status: 'idle', error: null, fieldErrors: {} });
      ToastStore.info('A fresh 6-digit code has been sent to your email.');
    } catch (e) { this.setError(this.handleError(e)); }
  }
}

export class SecurityMfaPresenter extends BasePresenter {
  constructor(nav) { super(nav); this.secret = null; this.otpauthUrl = null; }
  async load() { const { user } = AuthStore.getState(); this.setSuccess({ mfaEnabled: !!(user && user.mfaEnabled) }); }

  async startSetup() {
    if (this.state.status === 'loading') return;
    this.setLoading();
    try { const res = await authApi.mfaSetup(); const { secret, otpauthUrl } = res.data; this.secret = secret; this.otpauthUrl = otpauthUrl; this.setState({ status: 'success', data: { mfaEnabled: false, setup: true, secret, otpauthUrl } }); }
    catch (e) { this.setError(this.handleError(e)); }
  }

  async confirm(code) {
    if (!this.secret || this.state.status === 'loading') return;
    this.setLoading();
    try { await authApi.mfaEnable(this.secret, code); this.secret = null; this.otpauthUrl = null; const me = await authApi.me(); await AuthStore.setUser(userFromApi(me.user)); this.setSuccess({ mfaEnabled: true }); ToastStore.success('MFA enabled for this account.'); }
    catch (e) { this.setError(this.handleError(e)); }
  }

  async disable(code) {
    if (this.state.status === 'loading') return;
    this.setLoading();
    try { await authApi.mfaDisable(code); const me = await authApi.me(); await AuthStore.setUser(userFromApi(me.user)); this.setSuccess({ mfaEnabled: false }); ToastStore.info('MFA disabled.'); }
    catch (e) { this.setError(this.handleError(e)); }
  }
}

export class LogoutPresenter extends BasePresenter {
  async logout() {
    try { const { refreshToken } = AuthStore.getState(); if (refreshToken) await authApi.logout(refreshToken); }
    catch (e) { /* best-effort */ }
    await AuthStore.logout();
  }
}
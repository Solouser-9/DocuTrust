import { Clipboard } from 'react-native';
import { ToastStore } from '../../core/store/ToastStore';
import { BasePresenter } from '../../mvp/BasePresenter';
import { verificationApi } from './api';
import { requestFromApi } from './model';
import { documentsApi } from '../documents/api';
import { docFromApi } from '../documents/model';
import { publicVerifyUrl } from '../../core/config/env';

const hasErrors = (errors) => Object.values(errors).some(Boolean);

export class VerificationListPresenter extends BasePresenter {
  async load() {
    this.setLoading();
    try {
      const res = await verificationApi.list({ page: 1, limit: 50 });
      this.setSuccess({ items: (res.data || []).map(requestFromApi) });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }
}

export class VerificationCreatePresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.form = { documentId: '', verifierName: '', verifierOrg: '', purpose: '', expiresInDays: 30 };
    this.docs = [];
  }

  async load(preselectedId) {
    this.setSuccess({});
    this.form.documentId = preselectedId || '';
    try {
      const res = await documentsApi.list({ page: 1, limit: 50, status: 'active' });
      this.docs = (res.data || []).map(docFromApi);
      this.setState({ data: { docs: this.docs, form: this.form } });
    } catch (e) {
      this.setState({ data: { docs: this.docs, form: this.form } });
    }
  }

  setField(key, value) {
    this.form[key] = value;
    this.setState({ data: { ...(this.state.data || {}), form: this.form }, fieldErrors: { ...this.state.fieldErrors, [key]: null } });
  }

  async submit() {
    const errors = {};
    if (!this.form.documentId) errors.documentId = 'Choose a document.';
    if (!this.form.verifierName.trim()) errors.verifierName = 'Who is verifying?';
    if (!this.form.purpose.trim()) errors.purpose = 'State the purpose.';
    if (hasErrors(errors)) {
      this.setState({ fieldErrors: errors });
      return;
    }
    this.setLoading();
    try {
      const res = await verificationApi.create({
        documentId: this.form.documentId,
        verifierName: this.form.verifierName.trim(),
        verifierOrg: this.form.verifierOrg.trim() || undefined,
        purpose: this.form.purpose.trim(),
        expiresInDays: Number(this.form.expiresInDays) || 30,
      });
      ToastStore.success('Verification request created.');
      if (this.nav && this.nav.replace) this.nav.replace('VerificationDetail', { id: res.data.id });
    } catch (e) {
      const message = this.handleError(e);
      this.setError(message);
      this.setState({ fieldErrors: e.field ? { [e.field]: message } : {} });
    }
  }
}

export class VerificationDetailPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.id = null;
  }

  async load(id) {
    this.id = id;
    this.setLoading();
    try {
      const res = await verificationApi.detail(id);
      const request = requestFromApi(res.data);
      this.setSuccess({ request, link: request.token ? publicVerifyUrl(request.token) : null });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  copyLink() {
    const link = this.state.data && this.state.data.link;
    if (!link) return;
    Clipboard.setString(link);
    ToastStore.success('Verification link copied.');
  }

  async decide(decision) {
    try {
      if (decision === 'approved') await verificationApi.approve(this.id);
      else await verificationApi.reject(this.id);
      ToastStore.success(decision === 'approved' ? 'Seal approved — link is live.' : 'Request rejected.');
      await this.load(this.id);
    } catch (e) {
      ToastStore.error(this.handleError(e));
    }
  }
}

export class PublicVerifyPresenter extends BasePresenter {
  check(token) {
    const clean = String(token || '').trim();
    if (!clean) {
      this.setState({ fieldErrors: { token: 'Paste a verification token.' } });
      return;
    }
    this.setLoading();
    verificationApi
      .publicVerify(clean)
      .then((res) => {
        this.setSuccess({ checked: true });
        this.go('PublicVerifyResult', { token: clean, result: res.data });
      })
      .catch((e) => {
        const message = this.handleError(e);
        // Dead tokens still deserve a verdict card, not just an error line.
        const status = e.code === 'GONE' ? 'expired' : 'invalid';
        this.go('PublicVerifyResult', { token: clean, result: { status, proof: null, note: message } });
      });
  }
}

export class PublicVerifyResultPresenter extends BasePresenter {
  configure(params) {
    if (params && params.result) {
      this.setSuccess({ result: params.result, token: params.token || null });
    } else if (params && params.token) {
      this.load(params.token);
    } else {
      this.setEmpty();
    }
  }

  async load(token) {
    this.setLoading();
    try {
      const res = await verificationApi.publicVerify(token);
      this.setSuccess({ result: res.data, token });
    } catch (e) {
      const message = this.handleError(e);
      const status = e.code === 'GONE' ? 'expired' : 'invalid';
      this.setSuccess({ result: { status, proof: null, note: message }, token });
    }
  }

  copyHash(hash) {
    if (!hash) return;
    Clipboard.setString(hash);
    ToastStore.success('SHA-256 copied.');
  }
}

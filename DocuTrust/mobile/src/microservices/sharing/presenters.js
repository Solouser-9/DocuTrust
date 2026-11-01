import { Clipboard } from 'react-native';
import { ToastStore } from '../../core/store/ToastStore';
import { BasePresenter } from '../../mvp/BasePresenter';
import { sharingApi } from './api';
import { shareFromApi, shareStatus } from './model';
import { documentsApi } from '../documents/api';
import { docFromApi } from '../documents/model';
import { orgApi } from '../org/api';

const HOURS_CHOICES = [1, 6, 24, 72, 168];

export class SharesPresenter extends BasePresenter {
  async load(tab = 'mine') {
    this.setLoading();
    try {
      if (tab === 'incoming') {
        const res = await sharingApi.incoming({ page: 1, limit: 50 });
        this.setSuccess({ tab, incoming: res.data || [], items: [] });
      } else {
        const res = await sharingApi.mine({ page: 1, limit: 50 });
        const rows = (res.data || []).map(shareFromApi);
        this.setSuccess({ tab, items: rows, incoming: [] });
      }
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  open(share) {
    this.go('ShareDetail', { id: share.id });
  }
}

export class ShareCreatePresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.mode = 'link';
    this.form = {
      documentId: '',
      permission: 'view',
      expiresInHours: 24,
      maxViews: 0,
      passcode: '',
      sharedWithUserId: '',
    };
    this.docs = [];
    this.members = [];
  }

  async load(preselectedId) {
    this.setSuccess({});
    this.form.documentId = preselectedId || '';
    try {
      const [docs, members] = await Promise.all([
        documentsApi.list({ page: 1, limit: 50, status: 'active' }),
        orgApi.members().catch(() => ({ data: [] })),
      ]);
      this.docs = (docs.data || []).map(docFromApi);
      this.members = (members.data || []).filter((m) => m.status === 'active');
      this.setState({ data: { docs: this.docs, members: this.members, form: this.form, mode: this.mode } });
    } catch (e) {
      this.setState({ data: { docs: this.docs, members: this.members, form: this.form, mode: this.mode } });
    }
  }

  setMode(mode) {
    this.mode = mode;
    this.setState({ data: { ...(this.state.data || {}), mode } });
  }

  setField(key, value) {
    this.form[key] = value;
    this.setState({ data: { ...(this.state.data || {}), form: this.form }, fieldErrors: { ...this.state.fieldErrors, [key]: null } });
  }

  cycleHours(step) {
    const idx = HOURS_CHOICES.indexOf(this.form.expiresInHours);
    const next = HOURS_CHOICES[Math.min(HOURS_CHOICES.length - 1, Math.max(0, (idx === -1 ? 2 : idx) + step))];
    this.setField('expiresInHours', next);
  }

  cycleMaxViews(step) {
    const next = Math.min(50, Math.max(0, (this.form.maxViews || 0) + step));
    this.setField('maxViews', next);
  }

  validate() {
    const errors = {};
    if (!this.form.documentId) errors.documentId = 'Choose a document to share.';
    if (this.mode === 'member' && !this.form.sharedWithUserId) errors.sharedWithUserId = 'Choose a member.';
    if (this.mode === 'link' && this.form.passcode && this.form.passcode.length < 4) {
      errors.passcode = 'Use at least 4 characters.';
    }
    return errors;
  }

  async submit() {
    const errors = this.validate();
    if (Object.values(errors).some(Boolean)) {
      this.setState({ fieldErrors: errors });
      return;
    }
    this.setLoading();
    try {
      const payload = {
        documentId: this.form.documentId,
        permission: this.form.permission,
        expiresInHours: this.form.expiresInHours,
      };
      if (this.mode === 'link') {
        if (this.form.maxViews > 0) payload.maxViews = this.form.maxViews;
        if (this.form.passcode) payload.passcode = this.form.passcode;
      } else {
        payload.sharedWithUserId = this.form.sharedWithUserId;
      }
      const res = await sharingApi.create(payload);
      ToastStore.success(this.mode === 'link' ? 'Sealed link created.' : 'Document shared with member.');
      if (this.nav) {
        if (this.nav.replace) this.nav.replace('ShareDetail', { id: res.data.id });
        else this.goBack();
      }
    } catch (e) {
      const message = this.handleError(e);
      this.setError(message);
      this.setState({ fieldErrors: e.field ? { [e.field]: message } : {} });
    }
  }
}

export class ShareDetailPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.id = null;
  }

  async load(id) {
    this.id = id;
    this.setLoading();
    try {
      const mine = await sharingApi.mine({ page: 1, limit: 50 });
      const share = (mine.data || []).map(shareFromApi).find((s) => String(s.id) === String(id)) || null;
      if (!share) {
        this.setEmpty();
        return;
      }
      let stats = { viewCount: share.viewCount || 0 };
      try {
        const statsRes = await sharingApi.stats(id);
        stats = statsRes.data || stats;
      } catch (e) {
        // stats endpoint is supplementary
      }
      this.setSuccess({ share, stats, status: shareStatus(share) });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  copyLink(share) {
    // H-3: the server emits the link share's secret as linkToken (Share.toMap)
    if (!share || !share.linkToken) return;
    Clipboard.setString(`${share.linkToken}`);
    ToastStore.success('Share token copied. Prefix with your vault URL when sending.');
  }

  async revoke() {
    try {
      await sharingApi.revoke(this.id);
      ToastStore.info('Share revoked.');
      await this.load(this.id);
    } catch (e) {
      ToastStore.error(this.handleError(e));
    }
  }

  async remove() {
    try {
      await sharingApi.remove(this.id);
      ToastStore.info('Share record deleted.');
      this.goBack();
    } catch (e) {
      ToastStore.error(this.handleError(e));
    }
  }
}

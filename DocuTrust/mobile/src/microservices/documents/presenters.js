import { Clipboard, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ToastStore } from '../../core/store/ToastStore';
import { BasePresenter } from '../../mvp/BasePresenter';
import { documentsApi } from './api';
import { ALLOWED_MIME, docFromApi, historyFromApi } from './model';
import { foldersApi } from '../folders/api';
import { authApi } from '../auth/api';

const PAGE_SIZE = 12;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const hasErrors = (errors) => Object.values(errors).some(Boolean);

export class DashboardPresenter extends BasePresenter {
  async load() {
    this.setLoading();
    try {
      const [docs, expiring, shares] = await Promise.all([
        documentsApi.list({ page: 1, limit: 4, sort: 'created_at', order: 'desc' }),
        documentsApi.expiring(30),
        documentsApi.list({ page: 1, limit: 1 }),
      ]);
      // Shared-link count comes from the shares module lazily to keep this screen snappy.
      const shareCount = await this.sharedCount();
      this.setSuccess({
        recent: (docs.data || []).map(docFromApi),
        total: docs.meta ? docs.meta.total : (docs.data || []).length,
        expiring: (expiring.data || []).map(docFromApi),
        sharedCount: shareCount.count,
      });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  async sharedCount() {
    try {
      const res = await documentsApi.list({ page: 1, limit: 1 });
      return { count: res.meta ? res.meta.total : 0 };
    } catch (e) {
      return { count: 0 };
    }
  }
}

export class DocumentsListPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.filters = { search: '', status: '', type: '', folder: '' };
    this.page = 1;
    this.pages = 1;
    this.total = 0;
    this.items = [];
    this.folders = [];
  }

  async load() {
    this.setLoading();
    this.loadFolders();
    await this.fetch();
  }

  async fetch() {
    try {
      const res = await documentsApi.list({ ...this.filters, page: this.page, limit: PAGE_SIZE, sort: 'created_at', order: 'desc' });
      const rows = (res.data || []).map(docFromApi);
      this.items = this.page === 1 ? rows : [...this.items, ...rows];
      this.total = res.meta ? res.meta.total : this.items.length;
      this.pages = res.meta ? res.meta.pages || 1 : 1;
      this.setState({
        status: this.items.length ? 'success' : 'empty',
        data: { items: this.items, total: this.total, hasMore: this.page < this.pages, folders: this.folders },
      });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  async loadFolders() {
    try {
      const res = await foldersApi.list();
      this.folders = res.data || [];
      this.setState({ data: { ...(this.state.data || { items: [] }), folders: this.folders } });
    } catch (e) {
      // Folders are an optional filter axis; swallow failures here.
    }
  }

  setFilter(key, value) {
    this.filters[key] = value;
    this.page = 1;
    return this.fetch();
  }

  async loadMore() {
    if (this.page >= this.pages || this.state.status === 'loading') return;
    this.page += 1;
    await this.fetch();
  }

  async refresh() {
    this.page = 1;
    await this.fetch();
  }

  openDetail(id) {
    this.go('DocumentDetail', { id });
  }
}

export class DocumentDetailPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.id = null;
  }

  async load(id) {
    this.id = id;
    this.setLoading();
    try {
      const res = await documentsApi.detail(id);
      this.setSuccess(docFromApi(res.data));
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  async download() {
    const doc = this.state.data;
    if (!doc) return;
    this.setState({ working: true });
    try {
      const uri = await documentsApi.download(documentsApi.downloadUrl(doc.id), doc.title.replace(/[^\w.-]+/g, '_'));
      this.setState({ working: false });
      await Share.share({
        title: doc.title,
        url: uri,
        message: uri,
      });
    } catch (e) {
      this.setState({ working: false });
      if (e && !e.message) return; // share sheet cancelled
      ToastStore.error(this.handleError(e));
    }
  }

  async copyHash() {
    const doc = this.state.data;
    if (!doc || !doc.sha256) return;
    Clipboard.setString(doc.sha256);
    ToastStore.success('SHA-256 copied.');
  }

  async trash() {
    try {
      await documentsApi.remove(this.id);
      ToastStore.info('Moved to trash.');
      this.goBack();
    } catch (e) {
      ToastStore.error(this.handleError(e));
    }
  }
}

export class UploadDocumentPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.file = null;
    this.form = { title: '', docType: 'other', description: '', folderId: '', expiresAt: '', reminderDays: 30 };
    this.folders = [];
  }

  async load() {
    this.setSuccess({});
    try {
      const res = await foldersApi.list();
      this.folders = res.data || [];
      this.setState({ data: { folders: this.folders } });
    } catch (e) {
      // folder axis optional
    }
  }

  pick(pickerResult) {
    if (!pickerResult || pickerResult.canceled || !pickerResult.assets || !pickerResult.assets.length) return;
    const asset = pickerResult.assets[0];
    if (asset.size && asset.size > MAX_FILE_BYTES) {
      this.setState({ fieldErrors: { file: 'That file is larger than 25 MB. Compress it first.' } });
      return;
    }
    if (asset.mimeType && !ALLOWED_MIME.includes(asset.mimeType)) {
      this.setState({ fieldErrors: { file: 'Unsupported type. Use PDF, PNG, JPEG, WEBP, DOC or DOCX.' } });
      return;
    }
    this.file = asset;
    this.form.title = (asset.name || 'Document').replace(/\.[^.]+$/, '');
    this.setState({ fieldErrors: {}, data: { ...(this.state.data || {}), file: asset, title: this.form.title } });
  }

  setField(key, value) {
    this.form[key] = value;
    this.setState({ data: { ...(this.state.data || {}), [key]: value }, fieldErrors: { ...this.state.fieldErrors, [key]: null } });
  }

  validate() {
    const errors = {};
    if (!this.file) errors.file = 'Choose a file to seal.';
    if (!this.form.title.trim()) errors.title = 'Give the document a title.';
    if (this.form.expiresAt && Number.isNaN(new Date(this.form.expiresAt).getTime())) errors.expiresAt = 'Use YYYY-MM-DD.';
    return errors;
  }

  async submit() {
    const errors = this.validate();
    if (hasErrors(errors)) {
      this.setState({ fieldErrors: errors });
      return;
    }
    this.setLoading();
    try {
      const res = await documentsApi.upload({
        uri: this.file.uri,
        mimeType: this.file.mimeType,
        fields: this.form,
        onProgress: (p) => this.setState({ progress: p }),
      });
      this.setSuccess({ document: res.data });
      ToastStore.success('Sealed in the vault.');
      if (this.nav && this.nav.replace) this.nav.replace('DocumentDetail', { id: res.data.id });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }
}

export class EditDocumentPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.id = null;
    this.form = { title: '', description: '', docType: 'other', folderId: '', expiresAt: '', reminderDays: 30 };
    this.folders = [];
  }

  async load(id) {
    this.id = id;
    this.setLoading();
    try {
      const [docRes, folderRes] = await Promise.all([documentsApi.detail(id), foldersApi.list().catch(() => ({ data: [] }))]);
      const doc = docFromApi(docRes.data);
      this.folders = folderRes.data || [];
      this.form = {
        title: doc.title || '',
        description: doc.description || '',
        docType: doc.docType || 'other',
        folderId: doc.folderId ? String(doc.folderId) : '',
        expiresAt: doc.expiresAt ? String(doc.expiresAt).slice(0, 10) : '',
        reminderDays: doc.reminderDays || 30,
      };
      this.setSuccess({ doc, folders: this.folders, form: this.form });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  setField(key, value) {
    this.form[key] = value;
    this.setState({ data: { ...(this.state.data || {}), form: this.form }, fieldErrors: { ...this.state.fieldErrors, [key]: null } });
  }

  async submit() {
    if (!this.form.title.trim()) {
      this.setState({ fieldErrors: { title: 'Give the document a title.' } });
      return;
    }
    this.setLoading();
    try {
      await documentsApi.update(this.id, {
        title: this.form.title.trim(),
        description: this.form.description.trim() || undefined,
        docType: this.form.docType,
        folderId: this.form.folderId || undefined,
        expiresAt: this.form.expiresAt || undefined,
        reminderDays: Number(this.form.reminderDays) || undefined,
      });
      ToastStore.success('Details saved.');
      this.goBack();
    } catch (e) {
      const message = this.handleError(e);
      this.setError(message);
      this.setState({ fieldErrors: e.field ? { [e.field]: message } : {} });
    }
  }
}

export class VersionsPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.id = null;
  }

  async load(id) {
    this.id = id;
    this.setLoading();
    try {
      const [versions, docRes] = await Promise.all([documentsApi.versions(id), documentsApi.detail(id)]);
      const rows = (versions.data || []).slice().sort((a, b) => (b.versionNumber || b.version || 0) - (a.versionNumber || a.version || 0));
      this.setSuccess({ doc: docFromApi(docRes.data), versions: rows });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  num(v) {
    return v.versionNumber || v.version || 0;
  }

  async uploadVersion(pickerResult) {
    if (!pickerResult || pickerResult.canceled || !pickerResult.assets || !pickerResult.assets.length) return;
    const asset = pickerResult.assets[0];
    if (asset.size && asset.size > MAX_FILE_BYTES) {
      ToastStore.error('That file is larger than 25 MB.');
      return;
    }
    this.setLoading();
    try {
      await documentsApi.uploadVersion(this.id, { uri: asset.uri, mimeType: asset.mimeType, fields: {} });
      ToastStore.success('New version sealed.');
      await this.load(this.id);
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  async downloadVersion(v) {
    this.setState({ workingId: v.id });
    try {
      const uri = await documentsApi.download(documentsApi.versionDownloadUrl(this.id, this.num(v)), `version-${this.num(v)}`);
      this.setState({ workingId: null });
      await Share.share({ title: `Version ${this.num(v)}`, url: uri, message: uri });
    } catch (e) {
      this.setState({ workingId: null });
      ToastStore.error(this.handleError(e));
    }
  }
}

export class HistoryPresenter extends BasePresenter {
  async load(id) {
    this.setLoading();
    try {
      const res = await documentsApi.history(id);
      this.setSuccess({ items: historyFromApi(res.data) });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }
}

const RECENT_KEY = 'docutrust.recent-searches';

export class SearchPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.term = '';
    this.timer = null;
  }

  async loadRecent() {
    let recent = [];
    try {
      const raw = await AsyncStorage.getItem(RECENT_KEY);
      recent = raw ? JSON.parse(raw) : [];
    } catch (e) {
      recent = [];
    }
    this.setState({ data: { ...(this.state.data || {}), recent } });
  }

  onTerm(term) {
    this.term = term;
    this.setState({ data: { ...(this.state.data || {}), term } });
    clearTimeout(this.timer);
    if (!term.trim()) {
      this.setState({ status: 'idle', data: { ...(this.state.data || {}), term, items: [] } });
      return;
    }
    this.timer = setTimeout(() => this.search(), 350);
  }

  async search() {
    this.setLoading();
    try {
      const res = await documentsApi.list({ search: this.term.trim(), page: 1, limit: 20 });
      const items = (res.data || []).map(docFromApi);
      await this.saveRecent(this.term.trim());
      this.setState({
        status: items.length ? 'success' : 'empty',
        data: { ...(this.state.data || {}), items },
      });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  async saveRecent(term) {
    if (!term) return;
    let recent = [];
    try {
      const raw = await AsyncStorage.getItem(RECENT_KEY);
      recent = raw ? JSON.parse(raw) : [];
    } catch (e) {
      recent = [];
    }
    recent = [term, ...recent.filter((t) => t !== term)].slice(0, 6);
    try {
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch (e) {
      // recents are a nice-to-have
    }
    this.setState({ data: { ...(this.state.data || {}), recent } });
  }
}

export class TrashPresenter extends BasePresenter {
  async load() {
    this.setLoading();
    try {
      const res = await documentsApi.list({ status: 'deleted', page: 1, limit: 50 });
      this.setSuccess({ items: (res.data || []).map(docFromApi) });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  async restore(id) {
    try {
      await documentsApi.restore(id);
      ToastStore.success('Restored to the vault.');
      await this.load();
    } catch (e) {
      ToastStore.error(this.handleError(e));
    }
  }

  async destroy(id) {
    try {
      await documentsApi.removePermanent(id);
      ToastStore.info('Removed permanently.');
      await this.load();
    } catch (e) {
      if (e.code === 'STEP_UP_REQUIRED') {
        // Destructive action: prove a second factor before the vault lets go of the bytes.
        try {
          await authApi.requestStepUp();
          this.pendingDestroyId = id;
          this.setState({ status: 'idle', data: { stepUpRequired: true, items: (this.state.data && this.state.data.items) || [] } });
          ToastStore.info('We emailed you a 6-digit code to confirm this deletion.');
        } catch (e2) {
          ToastStore.error(this.handleError(e2));
        }
        return;
      }
      ToastStore.error(this.handleError(e));
    }
  }

  /** Second phase of the destroy flow: trade the emailed OTP for a step-up token and retry. */
  async confirmDestroyOtp(code) {
    this.setLoading();
    try {
      const res = await authApi.verifyStepUp(code);
      await documentsApi.removePermanent(this.pendingDestroyId, res.stepUpToken);
      this.pendingDestroyId = null;
      ToastStore.info('Removed permanently.');
      await this.load();
    } catch (e) {
      ToastStore.error(this.handleError(e));
    }
  }

  cancelDestroyOtp() {
    this.pendingDestroyId = null;
    this.setState({ status: 'idle', data: { items: (this.state.data && this.state.data.items) || [] } });
  }
}

export class ExpiringPresenter extends BasePresenter {
  async load(days = 30) {
    this.setLoading();
    try {
      const res = await documentsApi.expiring(days);
      const rows = (res.data || []).map(docFromApi);
      this.setSuccess({ items: rows, horizon: days });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }
}

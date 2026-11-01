import { ToastStore } from '../../core/store/ToastStore';
import { BasePresenter } from '../../mvp/BasePresenter';
import { foldersApi } from './api';
import { folderFromApi } from './model';
import { documentsApi } from '../documents/api';
import { docFromApi } from '../documents/model';

const PAGE_SIZE = 20;

export class FoldersPresenter extends BasePresenter {
  async load() {
    this.setLoading();
    try {
      const res = await foldersApi.list();
      this.setSuccess({ items: (res.data || []).map(folderFromApi) });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  async create(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      this.setState({ fieldErrors: { name: 'Name the folder.' } });
      return false;
    }
    this.setLoading();
    try {
      await foldersApi.create(trimmed);
      ToastStore.success('Folder created.');
      await this.load();
      return true;
    } catch (e) {
      const message = this.handleError(e);
      this.setState({ fieldErrors: { name: message } });
      return false;
    }
  }
}

export class FolderDetailPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.id = null;
    this.page = 1;
    this.items = [];
  }

  async load(id) {
    this.id = id;
    this.page = 1;
    this.setLoading();
    try {
      const [folderRes, docRes] = await Promise.all([
        foldersApi.list().then((r) => (r.data || []).map(folderFromApi)).catch(() => []),
        foldersApi.documents(id, { page: 1, limit: PAGE_SIZE }),
      ]);
      this.items = (docRes.data || []).map(docFromApi);
      const folder = folderRes.find((f) => String(f.id) === String(id)) || null;
      this.setState({
        status: 'success',
        data: { folder, items: this.items },
      });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  async rename(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return false;
    try {
      await foldersApi.update(this.id, trimmed);
      ToastStore.success('Folder renamed.');
      await this.load(this.id);
      return true;
    } catch (e) {
      ToastStore.error(this.handleError(e));
      return false;
    }
  }

  async remove() {
    try {
      await foldersApi.remove(this.id);
      ToastStore.info('Folder deleted. Documents were kept.');
      this.goBack();
    } catch (e) {
      ToastStore.error(this.handleError(e));
    }
  }
}

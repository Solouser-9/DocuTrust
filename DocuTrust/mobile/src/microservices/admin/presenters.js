import { ToastStore } from '../../core/store/ToastStore';
import { AuthStore } from '../../core/store/AuthStore';
import { BasePresenter } from '../../mvp/BasePresenter';
import { adminApi } from './api';
import { logFromApi, reviewFromApi, statsTiles, userFromApi } from './model';
import { docFromApi } from '../documents/model';

export class AdminDashboardPresenter extends BasePresenter {
  async load() {
    this.setLoading();
    try {
      const res = await adminApi.stats();
      this.setSuccess({ tiles: statsTiles(res.data), raw: res.data });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }
}

export class AdminQueuePresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.status = 'pending';
  }

  async load() {
    this.setLoading();
    try {
      const res = await adminApi.reviewQueue({ status: this.status, page: 1, limit: 50 });
      this.setSuccess({ items: (res.data || []).map(reviewFromApi), status: this.status });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  async setStatus(status) {
    this.status = status;
    await this.load();
  }

  open(item) {
    this.go('AdminReviewDetail', { id: item.id });
  }
}

export class AdminReviewDetailPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.id = null;
  }

  async load(id) {
    this.id = id;
    this.setLoading();
    try {
      const res = await adminApi.reviewQueue({ page: 1, limit: 100 });
      const review = (res.data || []).map(reviewFromApi).find((r) => String(r.id) === String(id)) || null;
      if (!review) {
        this.setEmpty();
        return;
      }
      this.setSuccess({ review });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  // Optimistic: stamp the decision locally, then confirm with the server.
  async decide(decision, note) {
    const review = this.state.data && this.state.data.review;
    if (review) this.setSuccess({ review: { ...review, status: decision } });
    try {
      await adminApi.decide(this.id, { status: decision, note: note || undefined });
      ToastStore.success(`Review ${decision}.`);
      this.goBack();
    } catch (e) {
      ToastStore.error(this.handleError(e));
      await this.load(this.id);
    }
  }
}

export class AdminUsersPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.filters = { search: '', role: '', status: '' };
    this.page = 1;
    this.pages = 1;
    this.items = [];
  }

  async load() {
    this.page = 1;
    this.setLoading();
    await this.fetch();
  }

  async fetch() {
    try {
      const res = await adminApi.users({ ...this.filters, page: this.page, limit: 20 });
      const rows = (res.data || []).map(userFromApi);
      this.items = this.page === 1 ? rows : [...this.items, ...rows];
      this.pages = res.meta ? res.meta.pages || 1 : 1;
      this.setState({
        status: this.items.length ? 'success' : 'empty',
        data: { items: this.items, hasMore: this.page < this.pages },
      });
    } catch (e) {
      this.setError(this.handleError(e));
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

  open(user) {
    this.go('AdminUserDetail', { id: user.id });
  }
}

export class AdminUserDetailPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.id = null;
  }

  async load(id) {
    this.id = id;
    this.setLoading();
    try {
      const res = await adminApi.users({ page: 1, limit: 100 });
      const user = (res.data || []).map(userFromApi).find((u) => String(u.id) === String(id)) || null;
      if (!user) {
        this.setEmpty();
        return;
      }
      this.setSuccess({ user, isSelf: String(user.id) === String((AuthStore.getState().user || {}).id) });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  async setStatus(status) {
    try {
      await adminApi.setUserStatus(this.id, status);
      ToastStore.success(`Account ${status === 'suspended' ? 'suspended' : status}.`);
      await this.load(this.id);
    } catch (e) {
      ToastStore.error(this.handleError(e));
    }
  }
}

export class AdminAuditPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.action = '';
    this.page = 1;
    this.pages = 1;
    this.items = [];
  }

  async load() {
    this.page = 1;
    this.setLoading();
    await this.fetch();
  }

  async fetch() {
    try {
      const res = await adminApi.auditLogs({ action: this.action, page: this.page, limit: 20 });
      const rows = logFromApi(res.data);
      this.items = this.page === 1 ? rows : [...this.items, ...rows];
      this.pages = res.meta ? res.meta.pages || 1 : 1;
      this.setState({
        status: this.items.length ? 'success' : 'empty',
        data: { items: this.items, hasMore: this.page < this.pages },
      });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  async setAction(action) {
    this.action = action;
    await this.load();
  }

  async loadMore() {
    if (this.page >= this.pages || this.state.status === 'loading') return;
    this.page += 1;
    await this.fetch();
  }
}

export class AdminDocumentsPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.search = '';
    this.page = 1;
    this.pages = 1;
    this.items = [];
  }

  async load() {
    this.page = 1;
    this.setLoading();
    await this.fetch();
  }

  async fetch() {
    try {
      const res = await adminApi.documents({ search: this.search, page: this.page, limit: 20 });
      const rows = (res.data || []).map(docFromApi);
      this.items = this.page === 1 ? rows : [...this.items, ...rows];
      this.pages = res.meta ? res.meta.pages || 1 : 1;
      this.setState({
        status: this.items.length ? 'success' : 'empty',
        data: { items: this.items, hasMore: this.page < this.pages },
      });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  setSearch(term) {
    this.search = term;
    this.page = 1;
    return this.fetch();
  }

  async loadMore() {
    if (this.page >= this.pages || this.state.status === 'loading') return;
    this.page += 1;
    await this.fetch();
  }
}

import { ToastStore } from '../../core/store/ToastStore';
import { BasePresenter } from '../../mvp/BasePresenter';
import { notificationsApi } from './api';
import { deepLinkTarget, notifFromApi, settingsFromApi } from './model';

const PAGE_SIZE = 20;

export class NotificationsPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.page = 1;
    this.pages = 1;
    this.items = [];
    this.unread = 0;
  }

  async load() {
    this.page = 1;
    this.setLoading();
    await this.fetch();
  }

  async fetch() {
    try {
      const res = await notificationsApi.list({ page: this.page, limit: PAGE_SIZE });
      const rows = (res.data || []).map(notifFromApi);
      this.items = this.page === 1 ? rows : [...this.items, ...rows];
      this.pages = res.meta ? res.meta.pages || 1 : 1;
      // H-3: the server puts the unread count in meta.unreadCount (not meta.unread)
      this.unread = res.meta && res.meta.unreadCount !== undefined ? res.meta.unreadCount : 0;
      this.setState({
        status: this.items.length ? 'success' : 'empty',
        data: { items: this.items, unread: this.unread, hasMore: this.page < this.pages },
      });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  async loadMore() {
    if (this.page >= this.pages || this.state.status === 'loading') return;
    this.page += 1;
    await this.fetch();
  }

  async markAll() {
    try {
      await notificationsApi.markAllRead();
      ToastStore.success('All caught up.');
      await this.load();
    } catch (e) {
      ToastStore.error(this.handleError(e));
    }
  }

  async open(item) {
    if (!item.read) {
      try {
        await notificationsApi.markRead(item.id);
      } catch (e) {
        // mark-read is best effort; navigation still proceeds
      }
    }
    const target = deepLinkTarget(item.type, item.entityId);
    if (target && target.route) {
      this.go(target.route, target.params);
    } else {
      ToastStore.info('No linked record for this alert.');
    }
  }
}

export class NotificationPrefsPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.settings = null;
  }

  async load() {
    this.setLoading();
    try {
      const res = await notificationsApi.getSettings();
      this.settings = settingsFromApi(res.data);
      this.setSuccess({ settings: this.settings });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  toggle(key) {
    if (!this.settings) return;
    this.settings = { ...this.settings, [key]: !this.settings[key] };
    this.setState({ data: { settings: this.settings } });
  }

  cycleOffset(step) {
    if (!this.settings) return;
    const next = Math.min(90, Math.max(1, this.settings.reminderOffsetDays + step));
    this.settings = { ...this.settings, reminderOffsetDays: next };
    this.setState({ data: { settings: this.settings } });
  }

  async save() {
    if (!this.settings) return;
    this.setLoading();
    try {
      await notificationsApi.saveSettings(this.settings);
      ToastStore.success('Preferences saved.');
      this.setSuccess({ settings: this.settings });
    } catch (e) {
      ToastStore.error(this.handleError(e));
      this.setSuccess({ settings: this.settings });
    }
  }
}

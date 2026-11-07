import { ToastStore } from '../../core/store/ToastStore';
import { AuthStore } from '../../core/store/AuthStore';
import { BasePresenter } from '../../mvp/BasePresenter';
import { orgApi } from './api';
import { memberFromApi } from './model';
import { isEmail } from '../../core/utils/validators';

export class OrgPresenter extends BasePresenter {
  async load() {
    this.setLoading();
    try {
      const [stats, members] = await Promise.all([
        orgApi.stats().catch(() => ({})),
        orgApi.members().catch(() => ({ data: [] })),
      ]);
      this.setSuccess({ stats: stats.data || {}, members: (members.data || []).map(memberFromApi) });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }
}

export class TeamMembersPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.meId = (AuthStore.getState().user || {}).id;
  }

  async load() {
    this.setLoading();
    try {
      const res = await orgApi.members();
      const all = (res.data || []).map(memberFromApi);
      this.setSuccess({
        active: all.filter((m) => m.status !== 'pending'),
        pending: all.filter((m) => m.status === 'pending'),
        meId: this.meId,
      });
    } catch (e) {
      this.setError(this.handleError(e));
    }
  }

  async setRole(id, role) {
    if (String(id) === String(this.meId)) {
      ToastStore.error('You cannot change your own role.');
      return;
    }
    try {
      await orgApi.setRole(id, role);
      ToastStore.success('Role updated.');
      await this.load();
    } catch (e) {
      ToastStore.error(this.handleError(e));
    }
  }

  async remove(id) {
    if (String(id) === String(this.meId)) {
      ToastStore.error('You cannot remove yourself.');
      return;
    }
    try {
      await orgApi.remove(id);
      ToastStore.info('Member removed.');
      await this.load();
    } catch (e) {
      ToastStore.error(this.handleError(e));
    }
  }
}

export class InviteMemberPresenter extends BasePresenter {
  constructor(nav) {
    super(nav);
    this.form = { email: '', role: 'member' };
  }

  setField(key, value) {
    this.form[key] = value;
    this.setState({ fieldErrors: { ...this.state.fieldErrors, [key]: null } });
  }

  async submit() {
    if (!isEmail(this.form.email)) {
      this.setState({ fieldErrors: { email: 'Enter a valid email address.' } });
      return;
    }
    this.setLoading();
    try {
      await orgApi.invite(this.form.email.trim().toLowerCase(), this.form.role);
      ToastStore.success('Invitation sent.');
      this.goBack();
    } catch (e) {
      const message = this.handleError(e);
      this.setError(message);
      this.setState({ fieldErrors: e.field ? { [e.field]: message } : {} });
    }
  }
}

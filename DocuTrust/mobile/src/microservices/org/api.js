import { ApiClient } from '../../core/api/ApiClient';
import { endpoints } from '../../core/api/endpoints';

export const orgApi = {
  members: () => ApiClient.get(endpoints.orgMembers()),
  invite: (email, role) => ApiClient.post(endpoints.orgInvite(), { email, role }),
  setRole: (id, role) => ApiClient.patch(endpoints.orgMemberRole(id), { role }),
  remove: (id) => ApiClient.del(endpoints.orgMember(id)),
  stats: () => ApiClient.get(endpoints.orgStats()),
};

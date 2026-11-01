import { ApiClient } from '../../core/api/ApiClient';
import { endpoints, qs } from '../../core/api/endpoints';

export const sharingApi = {
  mine: (params) => ApiClient.get(endpoints.shares() + qs(params)),
  incoming: (params) => ApiClient.get(endpoints.sharesIncoming() + qs(params)),
  create: (payload) => ApiClient.post(endpoints.shares(), payload),
  revoke: (id) => ApiClient.post(endpoints.shareRevoke(id)),
  remove: (id) => ApiClient.del(endpoints.share(id)),
  stats: (id) => ApiClient.get(endpoints.shareStats(id)),
  publicMeta: (token) => ApiClient.get(endpoints.publicShare(token), { auth: false }),
  publicOpen: (token, passcode) => ApiClient.post(endpoints.publicShareOpen(token), passcode ? { passcode } : {}, { auth: false }),
};

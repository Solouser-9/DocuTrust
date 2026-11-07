import { ApiClient } from '../../core/api/ApiClient';
import { endpoints, qs } from '../../core/api/endpoints';

export const verificationApi = {
  list: (params) => ApiClient.get(endpoints.verificationRequests() + qs(params)),
  detail: (id) => ApiClient.get(endpoints.verificationRequest(id)),
  create: (payload) => ApiClient.post(endpoints.verificationRequests(), payload),
  approve: (id) => ApiClient.post(endpoints.verificationApprove(id)),
  reject: (id) => ApiClient.post(endpoints.verificationReject(id)),
  // JSON mode: same token as the SEO HTML page, content-negotiated by Accept.
  publicVerify: (token) => ApiClient.get(endpoints.publicVerify(token), { auth: false, headers: { Accept: 'application/json' } }),
};

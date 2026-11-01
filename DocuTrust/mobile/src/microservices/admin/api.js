import { ApiClient } from '../../core/api/ApiClient';
import { endpoints, qs } from '../../core/api/endpoints';

export const adminApi = {
  stats: () => ApiClient.get(endpoints.adminStats()),
  reviewQueue: (params) => ApiClient.get(endpoints.adminReviewQueue() + qs(params)),
  decide: (id, payload) => ApiClient.post(endpoints.adminReviewDecision(id), payload),
  users: (params) => ApiClient.get(endpoints.adminUsers() + qs(params)),
  setUserStatus: (id, status) => ApiClient.patch(endpoints.adminUserStatus(id), { status }),
  documents: (params) => ApiClient.get(endpoints.adminDocuments() + qs(params)),
  auditLogs: (params) => ApiClient.get(endpoints.adminAuditLogs() + qs(params)),
};

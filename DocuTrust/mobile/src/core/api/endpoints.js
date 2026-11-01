// Single source of truth for every REST path the app talks to. Mirrors docs/API_CONTRACTS.md.
export const endpoints = {
  health: () => '/api/health',
  meta: () => '/api/meta',

  register: () => '/api/auth/register',
  login: () => '/api/auth/login',
  refresh: () => '/api/auth/refresh',
  logout: () => '/api/auth/logout',
  forgotPassword: () => '/api/auth/forgot-password',
  resetPasswordOtp: () => '/api/auth/reset-password-otp',
  verifyOtp: () => '/api/auth/verify-otp',
  acceptInvite: () => '/api/auth/accept-invite',
  requestStepUp: () => '/api/auth/request-step-up',
  verifyStepUp: () => '/api/auth/verify-step-up',
  verifyEmail: (token) => `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
  me: () => '/api/auth/me',
  changePassword: () => '/api/auth/change-password',
  mfaSetup: () => '/api/auth/mfa/setup',
  mfaEnable: () => '/api/auth/mfa/enable',
  mfaDisable: () => '/api/auth/mfa/disable',

  documents: () => '/api/documents',
  document: (id) => `/api/documents/${id}`,
  documentRestore: (id) => `/api/documents/${id}/restore`,
  documentPermanent: (id) => `/api/documents/${id}/permanent`,
  documentVersions: (id) => `/api/documents/${id}/versions`,
  documentVersion: (id, v) => `/api/documents/${id}/versions/${v}`,
  documentDownload: (id) => `/api/documents/${id}/download`,
  documentVersionDownload: (id, v) => `/api/documents/${id}/versions/${v}/download`,
  documentHistory: (id) => `/api/documents/${id}/history`,
  documentsExpiring: (days) => `/api/documents/expiring?days=${days}`,

  folders: () => '/api/folders',
  folder: (id) => `/api/folders/${id}`,
  folderDocuments: (id) => `/api/folders/${id}/documents`,

  shares: () => '/api/shares',
  share: (id) => `/api/shares/${id}`,
  shareRevoke: (id) => `/api/shares/${id}/revoke`,
  shareStats: (id) => `/api/shares/${id}/stats`,
  sharesIncoming: () => '/api/shares/incoming',
  publicShare: (token) => `/api/public/shares/${token}`,
  publicShareOpen: (token) => `/api/public/shares/${token}/open`,
  publicDownload: (ticket) => `/api/public/download/${ticket}`,

  verificationRequests: () => '/api/verification-requests',
  verificationRequest: (id) => `/api/verification-requests/${id}`,
  verificationApprove: (id) => `/api/verification-requests/${id}/approve`,
  verificationReject: (id) => `/api/verification-requests/${id}/reject`,
  publicVerify: (token) => `/api/public/verify/${token}`,

  notifications: () => '/api/notifications',
  notificationRead: (id) => `/api/notifications/${id}/read`,
  notificationsReadAll: () => '/api/notifications/read-all',
  notificationSettings: () => '/api/settings/notifications',

  adminStats: () => '/api/admin/stats',
  adminReviewQueue: () => '/api/admin/review-queue',
  adminReviewDecision: (id) => `/api/admin/reviews/${id}/decision`,
  adminUsers: () => '/api/admin/users',
  adminUserStatus: (id) => `/api/admin/users/${id}/status`,
  adminDocuments: () => '/api/admin/documents',
  adminAuditLogs: () => '/api/admin/audit-logs',

  orgMembers: () => '/api/org/members',
  orgMember: (id) => `/api/org/members/${id}`,
  orgMemberRole: (id) => `/api/org/members/${id}/role`,
  orgInvite: () => '/api/org/invite',
  orgStats: () => '/api/org/stats',
};

// Builds "?a=1&b=2" from a params object, skipping empty values.
export function qs(params) {
  const parts = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

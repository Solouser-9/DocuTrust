export function notifFromApi(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    type: raw.type || 'info',
    title: raw.title || raw.subject || 'Notification',
    body: raw.body || raw.message || '',
    entityId: raw.entityId || raw.entity_id || null,
    read: !!raw.readAt || !!raw.read,
    createdAt: raw.createdAt,
  };
}

// Notification tap → route. Unknown types fall through to a no-op toast.
export function deepLinkTarget(type, entityId) {
  switch (type) {
    case 'document_expiry':
    case 'document_reminder':
    case 'document_review':
    case 'admin_decision':
      return { route: 'DocumentDetail', params: { id: entityId } };
    case 'share_opened':
    case 'share_created':
      return { route: 'ShareDetail', params: { id: entityId } };
    case 'verification_approved':
    case 'verification_rejected':
    case 'verification_checked':
      return { route: 'VerificationDetail', params: { id: entityId } };
    case 'review_pending':
      return { route: 'AdminReviewDetail', params: { id: entityId } };
    default:
      return null;
  }
}

export const PREF_TOGGLES = [
  { key: 'expiryAlerts', label: 'Expiry warnings', detail: 'Lead-time alerts as documents approach their expiry date.' },
  { key: 'shareAlerts', label: 'Share activity', detail: 'Know the moment a sealed link is opened.' },
  { key: 'verificationAlerts', label: 'Verification activity', detail: 'Approvals, rejections and verifier checks.' },
  { key: 'adminAlerts', label: 'Platform decisions', detail: 'Outcomes of admin reviews on your documents.' },
];

export function settingsFromApi(raw) {
  return {
    expiryAlerts: raw ? raw.expiryAlerts !== false : true,
    shareAlerts: raw ? raw.shareAlerts !== false : true,
    verificationAlerts: raw ? raw.verificationAlerts !== false : true,
    adminAlerts: raw ? raw.adminAlerts !== false : true,
    reminderOffsetDays: raw && raw.reminderOffsetDays !== undefined ? raw.reminderOffsetDays : 14,
  };
}

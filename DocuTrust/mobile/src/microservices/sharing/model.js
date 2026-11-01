export const PERMISSIONS = [
  { value: 'view', label: 'View only' },
  { value: 'download', label: 'View + download' },
];

export function shareFromApi(raw) {
  if (!raw) return null;
  return {
    ...raw,
    viewCount: raw.viewCount || 0,
    maxViews: raw.maxViews || null,
  };
}

// Client mirror of the server's link-state rules (FT-091).
export function shareStatus(share) {
  if (!share) return 'active';
  if (share.revokedAt) return 'revoked';
  if (share.maxViews && (share.viewCount || 0) >= share.maxViews) return 'exhausted';
  if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) return 'expired';
  return 'active';
}

export function incomingFromApi(raw) {
  return raw || null;
}

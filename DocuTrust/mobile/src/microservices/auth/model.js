export function userFromApi(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    email: raw.email,
    fullName: raw.fullName,
    phone: raw.phone || '',
    role: raw.role || 'member',
    orgId: raw.orgId || null,
    orgName: raw.orgName || null,
    status: raw.status || 'active',
    mfaEnabled: !!raw.mfaEnabled,
    emailVerified: !!raw.emailVerified,
    createdAt: raw.createdAt,
  };
}

export const ROLE_LABELS = {
  admin: 'Registrar',
  org_manager: 'Custodian',
  member: 'Member',
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || 'Member';
}

export function roleTone(role) {
  if (role === 'admin') return 'amber';
  if (role === 'org_manager') return 'sage';
  return 'slate';
}

export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0][0].toUpperCase();
}

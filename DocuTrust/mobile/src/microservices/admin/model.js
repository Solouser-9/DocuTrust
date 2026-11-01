export const QUEUE_FILTERS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'escalated', label: 'Escalated' },
];

export const USER_ROLES = [
  { value: '', label: 'All roles' },
  { value: 'member', label: 'Member' },
  { value: 'org_manager', label: 'Custodian' },
  { value: 'admin', label: 'Registrar' },
];

export const USER_STATUSES = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'pending', label: 'Pending' },
];

export const AUDIT_ACTIONS = [
  { value: '', label: 'All actions' },
  { value: 'auth', label: 'Auth' },
  { value: 'document', label: 'Documents' },
  { value: 'share', label: 'Shares' },
  { value: 'verification', label: 'Verification' },
  { value: 'admin', label: 'Admin' },
];

// v_admin_stats row → ordered tiles. Keys are aliased defensively since the
// view is owned by the database layer. H-3: primary keys now match the
// server's AdminService.stats() output (queueDocuments, pendingVerifications,
// totalOrgs) - the old aliases (pendingReviews, totalVerifications,
// totalOrganisations) never existed server-side, so those tiles were dropped.
export function statsTiles(stats) {
  const pick = (...keys) => {
    for (const key of keys) {
      if (stats && stats[key] !== undefined && stats[key] !== null) return stats[key];
    }
    return null;
  };
  return [
    { key: 'users', label: 'Users', value: pick('totalUsers', 'users'), tone: 'ink' },
    { key: 'documents', label: 'Documents', value: pick('totalDocuments', 'documents'), tone: 'ink' },
    { key: 'pending', label: 'Pending reviews', value: pick('queueDocuments', 'pendingReviews'), tone: 'amber' },
    { key: 'shares', label: 'Active shares', value: pick('activeShares', 'shares'), tone: 'ink' },
    { key: 'verifications', label: 'Verifications', value: pick('pendingVerifications', 'totalVerifications'), tone: 'ink' },
    { key: 'orgs', label: 'Organisations', value: pick('totalOrgs', 'totalOrganisations'), tone: 'ink' },
  ].filter((tile) => tile.value !== null && tile.value !== undefined);
}

export function reviewFromApi(raw) {
  return raw || null;
}

export function userFromApi(raw) {
  return raw || null;
}

// H-3: AuditLog rows carry {actorId, ip, meta{}} - the old actorName/actorEmail/
// summary keys never existed server-side. meta is rendered as "key: value" pairs.
export function logFromApi(rows) {
  return (rows || []).map((row) => {
    const metaText = row.meta && typeof row.meta === 'object'
      ? Object.entries(row.meta)
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => `${k}: ${v}`)
          .join(' · ')
      : '';
    return {
      date: row.createdAt,
      title: String(row.action || 'Event').replace(/_/g, ' '),
      detail: [row.actorId, row.ip, metaText].filter(Boolean).join(' · '),
    };
  });
}

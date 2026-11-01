// The ten real-world document types the vault accepts, with the muted
// strip colour each one gets on file-tab cards.
export const DOC_TYPES = [
  { value: 'passport', label: 'Passport', color: '#D9A441' },
  { value: 'national_id', label: 'National ID', color: '#0E1B2C' },
  { value: 'drivers_license', label: "Driver's licence", color: '#7A9E7E' },
  { value: 'birth_certificate', label: 'Birth certificate', color: '#8C6D46' },
  { value: 'marriage_certificate', label: 'Marriage certificate', color: '#9C6644' },
  { value: 'medical_record', label: 'Medical record', color: '#E2603F' },
  { value: 'financial_statement', label: 'Financial statement', color: '#5B7C99' },
  { value: 'insurance_policy', label: 'Insurance policy', color: '#4F772D' },
  { value: 'property_deed', label: 'Property deed', color: '#3D5A80' },
  { value: 'academic_transcript', label: 'Academic transcript', color: '#64748B' },
  { value: 'contract', label: 'Contract', color: '#0E1B2C' },
  { value: 'other', label: 'Other', color: '#64748B' },
];

export const DOC_TYPE_VALUES = DOC_TYPES.map((t) => t.value);

export function docTypeLabel(value) {
  const found = DOC_TYPES.find((t) => t.value === value);
  return found ? found.label : 'Other';
}

export function docTypeColor(value) {
  const found = DOC_TYPES.find((t) => t.value === value);
  return found ? found.color : '#64748B';
}

export const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'expiring', label: 'Expiring' },
  { value: 'expired', label: 'Expired' },
  { value: 'pending_review', label: 'In review' },
  { value: 'archived', label: 'Archived' },
];

export const REMINDER_CHOICES = [7, 14, 30, 90];

export const ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function docFromApi(raw) {
  if (!raw) return null;
  return {
    ...raw,
    expiresAt: raw.expiresAt || null,
    daysLeft: raw.expiresAt ? Math.ceil((new Date(raw.expiresAt).getTime() - Date.now()) / 86400000) : null,
  };
}

export function versionFromApi(raw) {
  return raw || null;
}

// H-3: history rows carry {id, action, actorId, detail{...}, ip, createdAt} -
// the old at/actionLabel/actor/actorName/detailSummary/summary keys never
// existed server-side. detail (JSONB) renders as "key: value" pairs.
function historyDetailText(detail) {
  if (!detail || typeof detail !== 'object') return detail || '';
  return Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
}

export function historyFromApi(rows) {
  return (rows || []).map((row) => ({
    date: row.createdAt,
    title: String(row.action || 'Updated').replace(/_/g, ' '),
    detail: [row.actorId, historyDetailText(row.detail)].filter(Boolean).join(' · '),
  }));
}

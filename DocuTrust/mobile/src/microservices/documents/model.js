import { palette } from '../../core/theme/palette';

// The ten real-world document types the vault accepts, with the muted
// strip colour each one gets on file-tab cards.
export const DOC_TYPES = [
  { value: 'passport', label: 'Passport', color: palette.documentType.passport },
  { value: 'national_id', label: 'National ID', color: palette.documentType.nationalId },
  { value: 'drivers_license', label: "Driver's licence", color: palette.documentType.driversLicense },
  { value: 'birth_certificate', label: 'Birth certificate', color: palette.documentType.birthCertificate },
  { value: 'marriage_certificate', label: 'Marriage certificate', color: palette.documentType.marriageCertificate },
  { value: 'medical_record', label: 'Medical record', color: palette.documentType.medicalRecord },
  { value: 'financial_statement', label: 'Financial statement', color: palette.documentType.financialStatement },
  { value: 'insurance_policy', label: 'Insurance policy', color: palette.documentType.insurancePolicy },
  { value: 'property_deed', label: 'Property deed', color: palette.documentType.propertyDeed },
  { value: 'academic_transcript', label: 'Academic transcript', color: palette.documentType.academicTranscript },
  { value: 'contract', label: 'Contract', color: palette.documentType.contract },
  { value: 'other', label: 'Other', color: palette.documentType.other },
];

export const DOC_TYPE_VALUES = DOC_TYPES.map((t) => t.value);

export function docTypeLabel(value) {
  const found = DOC_TYPES.find((t) => t.value === value);
  return found ? found.label : 'Other';
}

export function docTypeColor(value) {
  const found = DOC_TYPES.find((t) => t.value === value);
  return found ? found.color : palette.slate;
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

export const VERIFICATION_STATUSES = ['pending', 'approved', 'rejected', 'expired'];

export function requestFromApi(raw) {
  return raw || null;
}

export const RESULT_TONES = {
  valid: 'sage',
  invalid: 'slate',
  tampered: 'coral',
  expired: 'coral',
  revoked: 'coral',
};

export const RESULT_TITLES = {
  valid: 'Valid',
  invalid: 'Invalid',
  tampered: 'Tampered',
  expired: 'Expired',
  revoked: 'Revoked',
};

// The one-line promise printed under every proof card.
export const PROOF_NOTE = 'Document bytes never leave the vault — only this sealed proof is shown.';

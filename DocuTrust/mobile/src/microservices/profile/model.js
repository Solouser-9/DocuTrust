export function accountRows(user) {
  if (!user) return [];
  return [
    { key: 'email', label: 'Email', value: user.email },
    { key: 'phone', label: 'Phone', value: user.phone || '—' },
    { key: 'org', label: 'Organisation', value: user.orgName || 'Personal account' },
    { key: 'memberSince', label: 'Member since', value: user.createdAt },
  ];
}

export const FAQ_ITEMS = [
  {
    q: 'How safe are my files?',
    a: 'Every upload is encrypted with AES-256-GCM before a single byte touches disk, and each file gets a per-file random IV. The encryption key lives only in the server environment — never in the app, never in the database.',
  },
  {
    q: 'What is the SHA-256 shown on my documents?',
    a: 'A cryptographic fingerprint computed while your file streams in. It is recomputed on every download; if the fingerprint ever differs, the vault flags the document as tampered.',
  },
  {
    q: 'How big can uploads be?',
    a: 'Up to 25 MB per file. PDF, PNG, JPEG, WEBP, DOC and DOCX are accepted. Sensitive types such as medical or financial documents are queued for a registrar review before they become active.',
  },
  {
    q: 'What does a share link reveal?',
    a: 'Only what you allow: view-only or download, for the hours you set, with optional view limits and passcodes. Recipients never see your other documents, and revoked links stop working instantly.',
  },
  {
    q: 'How does verification work?',
    a: 'You mint a verification link for a document and approve it. Anyone with the link sees a sealed proof — title, type, owner, fingerprint, dates — but the document bytes never leave the vault.',
  },
  {
    q: 'Why do I get signed out?',
    a: 'Access tokens live 15 minutes; a rotating refresh token keeps you signed in for 7 days. If a refresh token is ever replayed, the whole token family is revoked to protect the vault — sign in again and all is well.',
  },
  {
    q: 'What is MFA and should I enable it?',
    a: 'Multi-factor authentication adds a six-digit code from an authenticator app on top of your password. Enabling it takes under a minute from the Security screen.',
  },
];

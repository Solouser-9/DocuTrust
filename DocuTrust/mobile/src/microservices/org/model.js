export const INVITE_ROLES = [
  { value: 'member', label: 'Member' },
  { value: 'org_manager', label: 'Custodian' },
];

export function memberFromApi(raw) {
  return raw || null;
}

export function isPending(member) {
  return !member || member.status === 'pending';
}

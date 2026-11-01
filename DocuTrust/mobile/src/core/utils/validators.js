export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

export function passwordError(pw) {
  if (!pw || pw.length < 8) return 'Use at least 8 characters.';
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Mix letters and numbers.';
  return null;
}

export function passwordScore(pw) {
  let score = 0;
  if (!pw) return 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-zA-Z]/.test(pw) && /[0-9]/.test(pw)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pw)) score += 1;
  return Math.min(4, score);
}

export function required(value, label) {
  return value && String(value).trim() ? null : `${label} is required.`;
}

export function validateLogin(form) {
  const errors = {};
  if (!isEmail(form.email)) errors.email = 'Enter a valid email address.';
  if (!form.password) errors.password = 'Enter your password.';
  return errors;
}

export function validateRegister(form) {
  const errors = {};
  const name = required(form.fullName, 'Full name');
  if (name) errors.fullName = name;
  if (!isEmail(form.email)) errors.email = 'Enter a valid email address.';
  const pw = passwordError(form.password);
  if (pw) errors.password = pw;
  if (form.accountType === 'org') {
    const org = required(form.orgName, 'Organisation name');
    if (org) errors.orgName = org;
  }
  return errors;
}

export function validateReset(form) {
  const errors = {};
  const code = required(form.code, 'Reset code');
  if (code) errors.code = code;
  const pw = passwordError(form.newPassword);
  if (pw) errors.newPassword = pw;
  return errors;
}

export function validateChangePassword(form) {
  const errors = {};
  const current = required(form.currentPassword, 'Current password');
  if (current) errors.currentPassword = current;
  const pw = passwordError(form.newPassword);
  if (pw) errors.newPassword = pw;
  else if (form.newPassword !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

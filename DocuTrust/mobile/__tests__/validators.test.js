const {
  isEmail,
  passwordError,
  passwordScore,
  required,
  validateLogin,
  validateRegister,
  validateReset,
  validateChangePassword,
} = require('../src/core/utils/validators');

describe('isEmail', () => {
  test('accepts ordinary addresses', () => {
    expect(isEmail('ada@example.com')).toBe(true);
    expect(isEmail('  ada.lovelace+vault@sub.example.co.uk  ')).toBe(true);
  });

  test('rejects malformed addresses', () => {
    expect(isEmail('')).toBe(false);
    expect(isEmail(null)).toBe(false);
    expect(isEmail('no-at-sign')).toBe(false);
    expect(isEmail('missing@tld')).toBe(false);
    expect(isEmail('two@at@signs.com')).toBe(false);
  });
});

describe('passwordError', () => {
  test('requires at least 8 characters', () => {
    expect(passwordError('ab1')).toBe('Use at least 8 characters.');
    expect(passwordError('')).toBe('Use at least 8 characters.');
    expect(passwordError(null)).toBe('Use at least 8 characters.');
  });

  test('requires letters and numbers', () => {
    expect(passwordError('onlyletters')).toBe('Mix letters and numbers.');
    expect(passwordError('12345678')).toBe('Mix letters and numbers.');
  });

  test('accepts mixed passwords', () => {
    expect(passwordError('vault2024')).toBeNull();
  });
});

describe('passwordScore', () => {
  test('scores from 0 to 4', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('short')).toBe(0);
    expect(passwordScore('longpassword')).toBe(2);
    expect(passwordScore('longpassword1')).toBe(3);
    expect(passwordScore('Longpassword1')).toBe(3);
    expect(passwordScore('Longpassword1!')).toBe(4);
    expect(passwordScore('a1!b2@c3#d4$e5%')).toBe(4);
  });
});

describe('required', () => {
  test('flags blank values with a label', () => {
    expect(required('', 'Code')).toBe('Code is required.');
    expect(required('   ', 'Code')).toBe('Code is required.');
    expect(required(null, 'Code')).toBe('Code is required.');
  });

  test('passes filled values', () => {
    expect(required('x', 'Code')).toBeNull();
  });
});

describe('validateLogin', () => {
  test('collects both field errors on an empty form', () => {
    const errors = validateLogin({ email: '', password: '' });
    expect(errors.email).toBe('Enter a valid email address.');
    expect(errors.password).toBe('Enter your password.');
  });

  test('passes a valid form', () => {
    expect(validateLogin({ email: 'a@b.co', password: 'x' })).toEqual({});
  });
});

describe('validateRegister', () => {
  test('requires name, email and password', () => {
    const errors = validateRegister({ fullName: '', email: 'bad', password: 'short', accountType: 'personal' });
    expect(errors.fullName).toBe('Full name is required.');
    expect(errors.email).toBe('Enter a valid email address.');
    expect(errors.password).toBe('Use at least 8 characters.');
  });

  test('org accounts also need an organisation name', () => {
    const errors = validateRegister({ fullName: 'Ada', email: 'a@b.co', password: 'vault2024', accountType: 'org', orgName: '' });
    expect(errors.orgName).toBe('Organisation name is required.');
  });

  test('org form passes with an org name', () => {
    const errors = validateRegister({ fullName: 'Ada', email: 'a@b.co', password: 'vault2024', accountType: 'org', orgName: 'Acme' });
    expect(errors).toEqual({});
  });
});

describe('validateReset', () => {
  test('requires code and a valid new password', () => {
    const errors = validateReset({ code: '', newPassword: 'short' });
    expect(errors.code).toBe('Reset code is required.');
    expect(errors.newPassword).toBe('Use at least 8 characters.');
  });

  test('passes a valid reset form', () => {
    expect(validateReset({ code: '123456', newPassword: 'vault2024' })).toEqual({});
  });
});

describe('validateChangePassword', () => {
  test('requires current password and a strong new one', () => {
    const errors = validateChangePassword({ currentPassword: '', newPassword: 'short', confirmPassword: 'short' });
    expect(errors.currentPassword).toBe('Current password is required.');
    expect(errors.newPassword).toBe('Use at least 8 characters.');
  });

  test('flags mismatched confirmation', () => {
    const errors = validateChangePassword({ currentPassword: 'old1', newPassword: 'vault2024', confirmPassword: 'vault2025' });
    expect(errors.confirmPassword).toBe('Passwords do not match.');
  });

  test('passes a matching pair', () => {
    const errors = validateChangePassword({ currentPassword: 'old1', newPassword: 'vault2024', confirmPassword: 'vault2024' });
    expect(errors).toEqual({});
  });
});

// Central runtime configuration. Override with EXPO_PUBLIC_API_URL when pointing at a
// remote vault server (e.g. emulator uses 10.0.2.2 instead of localhost).
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/+$/, '');

export const APP_NAME = 'DocuTrust';
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const publicVerifyUrl = (token) => `${API_URL}/api/public/verify/${token}`;
export const publicShareUrl = (token) => `${API_URL}/api/public/shares/${token}`;

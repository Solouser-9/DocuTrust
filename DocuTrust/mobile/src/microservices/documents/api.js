import * as FileSystem from 'expo-file-system/legacy';
import { File, Paths } from 'expo-file-system';
import { API_URL } from '../../core/config/env';
import { ApiClient, ApiError, refreshSession } from '../../core/api/ApiClient';
import { endpoints, qs } from '../../core/api/endpoints';
import { AuthStore } from '../../core/store/AuthStore';

const DOC_FIELDS = ['title', 'docType', 'description', 'folderId', 'expiresAt', 'reminderDays'];
const MIME_EXTENSIONS = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

function downloadFileName(fileName, mimeType) {
  const safeName = (fileName || `docutrust-${Date.now()}`).replace(/[\\/]/g, '_');
  if (/\.[^./\\]+$/.test(safeName)) return safeName;
  return `${safeName}${MIME_EXTENSIONS[mimeType] || ''}`;
}

// Shared multipart engine for both create-document and new-version uploads.
async function uploadTo(path, { uri, name: pickedFileName, mimeType: pickedMimeType, fields }) {
  const fileUri = uri.startsWith('file://') || uri.startsWith('content://')
    ? uri
    : `file://${uri.startsWith('/') ? '' : '/'}${uri}`;
  const fileName = pickedFileName || fileUri.split('/').pop() || 'upload.png';
  const mimeType = pickedMimeType || 'image/png';
  const params = {};
  DOC_FIELDS.forEach((key) => {
    if (fields[key] !== undefined && fields[key] !== null && fields[key] !== '') params[key] = String(fields[key]);
  });

  const send = async (accessToken) => {
    const destFile = new File(Paths.cache, `${Date.now()}-${fileName.replace(/[\\/]/g, '_')}`);
    try {
      const body = new FormData();
      const sourceFile = new File(fileUri);
      try {
        await sourceFile.copy(destFile);
        Object.defineProperties(destFile, {
          name: { value: fileName, configurable: true, writable: true },
          type: { value: mimeType, configurable: true, writable: true },
        });
        body.append('file', destFile, fileName);
      } catch (copyError) {
        console.warn('File copy failed; falling back to reading the URI as a Blob:', copyError);
        const response = await fetch(fileUri);
        const blob = await response.blob();
        body.append('file', blob, fileName);
      }

      Object.entries(params).forEach(([key, value]) => body.append(key, value));

      const headers = { Authorization: `Bearer ${accessToken}` };
      try {
        console.log('Uploading file:', { fileUri, fileName, mimeType });
        return await fetch(`${API_URL}${path}`, { method: 'POST', headers, body });
      } catch (error) {
        console.error('Upload failed:', error);
        throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the vault. Check your connection and try again.');
      }
    } finally {
      if (destFile.exists) destFile.delete();
    }
  };

  let res = await send(AuthStore.getState().accessToken);
  if (res.status === 401) {
    const accessToken = await refreshSession();
    res = await send(accessToken);
  }

  const json = await res.json().catch(() => null);
  if (res.status >= 200 && res.status < 300 && json && json.ok) {
    return { data: json.data, meta: json.meta || null };
  }
  const err = (json && json.error) || {};
  throw new ApiError(res.status, err.code || 'UPLOAD_FAILED', err.message || 'The upload could not be completed.', err.field);
}

export const documentsApi = {
  list: (params) => ApiClient.get(endpoints.documents() + qs(params)),
  detail: (id) => ApiClient.get(endpoints.document(id)),
  update: (id, patch) => ApiClient.patch(endpoints.document(id), patch),
  remove: (id) => ApiClient.del(endpoints.document(id)),
  restore: (id) => ApiClient.post(endpoints.documentRestore(id)),
  // Permanent delete is step-up gated: pass the token from verify-step-up, or the server
  // answers 403 STEP_UP_REQUIRED and the UI collects an emailed OTP first.
  removePermanent: (id, stepUpToken) =>
    ApiClient.del(endpoints.documentPermanent(id), stepUpToken ? { headers: { 'X-Step-Up-Token': stepUpToken } } : undefined),
  versions: (id) => ApiClient.get(endpoints.documentVersions(id)),
  history: (id) => ApiClient.get(endpoints.documentHistory(id)),
  expiring: (days) => ApiClient.get(endpoints.documentsExpiring(days)),

  upload: (opts) => uploadTo(endpoints.documents(), opts),
  uploadVersion: (id, opts) => uploadTo(endpoints.documentVersions(id), opts),

  downloadUrl: (id) => `${API_URL}${endpoints.documentDownload(id)}`,
  versionDownloadUrl: (id, v) => `${API_URL}${endpoints.documentVersionDownload(id, v)}`,

  // Streams the decrypted file into the cache, returns the local uri for sharing.
  async download(url, fileName, mimeType) {
    const dest = `${FileSystem.cacheDirectory}${downloadFileName(fileName, mimeType)}`;
    const res = await FileSystem.downloadAsync(url, dest, {
      headers: { Authorization: `Bearer ${AuthStore.getState().accessToken}` },
    });
    if (res.status !== 200) throw new ApiError(res.status, 'DOWNLOAD_FAILED', 'The file could not be decrypted for download.');
    return res.uri;
  },
};

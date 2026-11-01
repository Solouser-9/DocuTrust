import * as FileSystem from 'expo-file-system';
import { API_URL } from '../../core/config/env';
import { ApiClient, ApiError, refreshSession } from '../../core/api/ApiClient';
import { endpoints, qs } from '../../core/api/endpoints';
import { AuthStore } from '../../core/store/AuthStore';

const DOC_FIELDS = ['title', 'docType', 'description', 'folderId', 'expiresAt', 'reminderDays'];

// Shared multipart engine for both create-document and new-version uploads.
// Uses expo-file-system upload tasks so real progress can be surfaced, and
// falls back to a single silent token refresh on 401.
async function uploadTo(path, { uri, mimeType, fields, onProgress }) {
  const params = {};
  DOC_FIELDS.forEach((key) => {
    if (fields[key] !== undefined && fields[key] !== null && fields[key] !== '') params[key] = String(fields[key]);
  });

  const startTask = () => {
    const task = FileSystem.createUploadTask(`${API_URL}${path}`, null, {
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: mimeType || 'application/octet-stream',
      parameters: params,
      headers: { Authorization: `Bearer ${AuthStore.getState().accessToken}` },
    });
    if (onProgress) {
      task.onProgress((p) => onProgress(p.totalBytesSent / Math.max(1, p.totalBytesExpectedToSend)));
    }
    return task;
  };

  let task = startTask();
  let res = await task.uploadAsync();
  if (res.status === 401) {
    await refreshSession();
    task = startTask();
    res = await task.uploadAsync();
  }

  let json = null;
  try {
    json = JSON.parse(res.body);
  } catch (e) {
    json = null;
  }
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
  async download(url, fileName) {
    const dest = `${FileSystem.cacheDirectory}${fileName || `docutrust-${Date.now()}`}`;
    const res = await FileSystem.downloadAsync(url, dest, {
      headers: { Authorization: `Bearer ${AuthStore.getState().accessToken}` },
    });
    if (res.status !== 200) throw new ApiError(res.status, 'DOWNLOAD_FAILED', 'The file could not be decrypted for download.');
    return res.uri;
  },
};

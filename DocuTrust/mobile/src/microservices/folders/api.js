import { ApiClient } from '../../core/api/ApiClient';
import { endpoints, qs } from '../../core/api/endpoints';

export const foldersApi = {
  list: () => ApiClient.get(endpoints.folders()),
  create: (name) => ApiClient.post(endpoints.folders(), { name }),
  update: (id, name) => ApiClient.patch(endpoints.folder(id), { name }),
  remove: (id) => ApiClient.del(endpoints.folder(id)),
  documents: (id, params) => ApiClient.get(endpoints.folderDocuments(id) + qs(params)),
};

import { ApiClient } from '../../core/api/ApiClient';
import { endpoints, qs } from '../../core/api/endpoints';

export const notificationsApi = {
  list: (params) => ApiClient.get(endpoints.notifications() + qs(params)),
  markRead: (id) => ApiClient.post(endpoints.notificationRead(id)),
  markAllRead: () => ApiClient.post(endpoints.notificationsReadAll()),
  getSettings: () => ApiClient.get(endpoints.notificationSettings()),
  saveSettings: (settings) => ApiClient.put(endpoints.notificationSettings(), settings),
};

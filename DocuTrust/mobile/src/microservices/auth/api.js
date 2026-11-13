import { ApiClient } from '../../core/api/ApiClient';
import { endpoints } from '../../core/api/endpoints';

export const authApi = {
  register: (payload) => ApiClient.post(endpoints.register(), payload),
  login: (payload) => ApiClient.post(endpoints.login(), payload),
  logout: (refreshToken) => ApiClient.post(endpoints.logout(), { refreshToken }, { auth: false }),
  forgotPassword: (email) => ApiClient.post(endpoints.forgotPassword(), { email }, { auth: false }),
  resendOtp: (email) => ApiClient.post(endpoints.resendOtp(), { email }, { auth: false }), // <-- NEW
  resetPasswordOtp: (email, code, newPassword) =>
      ApiClient.post(endpoints.resetPasswordOtp(), { email, code, newPassword }, { auth: false }),
  verifyOtp: (payload) => ApiClient.post(endpoints.verifyOtp(), payload, { auth: false }),
  requestStepUp: () => ApiClient.post(endpoints.requestStepUp(), {}),
  verifyStepUp: (code) => ApiClient.post(endpoints.verifyStepUp(), { code }),
  verifyEmail: (token) => ApiClient.get(endpoints.verifyEmail(token), { auth: false }),
  me: () => ApiClient.get(endpoints.me()),
  updateMe: (patch) => ApiClient.patch(endpoints.me(), patch),
  changePassword: (currentPassword, newPassword, stepUpToken) =>
      ApiClient.post(
          endpoints.changePassword(),
          { currentPassword, newPassword },
          stepUpToken ? { headers: { 'X-Step-Up-Token': stepUpToken } } : undefined
      ),
  mfaSetup: () => ApiClient.post(endpoints.mfaSetup()),
  mfaEnable: (secret, code) => ApiClient.post(endpoints.mfaEnable(), { secret, code }),
  mfaDisable: (code) => ApiClient.post(endpoints.mfaDisable(), { code }),
};
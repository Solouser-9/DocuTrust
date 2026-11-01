import { ApiClient } from '../../core/api/ApiClient';
import { endpoints } from '../../core/api/endpoints';

// Account-surface calls (profile, security, help). Kept separate from the auth
// module so each microservice owns its own transport.
export const profileApi = {
  me: () => ApiClient.get(endpoints.me()),
  updateMe: (patch) => ApiClient.patch(endpoints.me(), patch),
  mfaSetup: () => ApiClient.post(endpoints.mfaSetup()),
  mfaEnable: (secret, code) => ApiClient.post(endpoints.mfaEnable(), { secret, code }),
  mfaDisable: (code) => ApiClient.post(endpoints.mfaDisable(), { code }),
  meta: () => ApiClient.get(endpoints.meta(), { auth: false }),
};

// frontend/src/lib/api.ts
import axios from "axios";
import { useAuthStore } from "#/hooks/useAuth";

export const api = axios.create({
  baseURL: "/api", //development: "baseURL: "/api" 
  //production: "baseURL: "https://christian-it-automation.duckdns.org/api"
  withCredentials: true, // required so the httpOnly refresh_token cookie is sent/received
  timeout: 10000,
});

// Request interceptor: attach the current access token, if we have one.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().user?.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: on a 401, attempt exactly one refresh-and-retry
// cycle per request (guarded by `_retry`), then give up.
//
// `refreshPromise` is shared across concurrent 401s so that if five
// requests fail at once because the access token just expired, they
// trigger ONE /auth/refresh call and all retry off its result, instead of
// each firing their own refresh request.
//
// ASSUMPTION (flagged, not verified): this assumes something else at app
// bootstrap already calls /auth/refresh to repopulate `user` in the store
// after a page reload — per useAuth.ts's own comment, `partialize` only
// persists `isAuthenticated`, so `user` (and therefore accessToken) is
// null immediately after reload until that bootstrap runs. If that
// bootstrap flow doesn't exist yet, the `if (currentUser)` guard below
// will silently skip persisting the refreshed token into the store (it
// still retries the one in-flight request using the fresh token, but
// won't fix subsequent requests) — that's a separate task from the scan
// feature, just flagging the dependency.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ access_token: string }>("https://christian-it-automation.duckdns.org/api/auth/refresh", null, { withCredentials: true }) 
      //development: "/api/auth/refresh"
      //production: "https://christian-it-automation.duckdns.org/api/auth/refresh"
      .then((res) => res.data.access_token)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          useAuthStore.getState().setAuth({ ...currentUser, accessToken: newToken });
        }
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh itself failed (expired/invalid refresh cookie) — the
        // session is over. Clear local auth state; ProtectedRoute is
        // responsible for redirecting to /login once isAuthenticated
        // flips false (not duplicated here — this file has no router
        // access and shouldn't need one).
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
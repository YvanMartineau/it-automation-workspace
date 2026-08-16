// frontend/src/hooks/useAuthBootstrap.ts
import { useEffect, useState } from "react";
import { api } from "#/lib/api";
import { decodeAccessToken } from "#/lib/jwt";
import { useAuthStore } from "#/hooks/useAuth";

/**
 * Runs once on app load. If `isAuthenticated` survived a reload (from
 * useAuth.ts's partialize) but `user` did not, attempts to silently
 * restore the session via POST /auth/refresh — the same httpOnly refresh
 * cookie flow /auth/login already relies on; no new endpoint needed.
 *
 * Returns `isHydrating: true` until this attempt resolves (success,
 * failure, or "nothing to do"), so callers can hold off rendering routes
 * until the access token is back in memory — otherwise a component can
 * read `user` as null and briefly misrender (this is exactly what caused
 * the AssetToolbar scan button to stay hidden) before refresh completes.
 *
 * DEPENDS ON: the /auth/refresh cookie-path issue flagged in chat. If
 * that's not resolved, this will call the endpoint, get a 401, and fall
 * through to logout() every time — behaving correctly (fails safe to
 * "not authenticated") but never actually restoring the session.
 */
export function useAuthBootstrap(): { isHydrating: boolean } {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const [isHydrating, setIsHydrating] = useState(() => isAuthenticated && user === null);

  useEffect(() => {
    if (!isAuthenticated || user !== null) {
      setIsHydrating(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await api.post<{ access_token: string }>("/auth/refresh");
        if (cancelled) return;
        const claims = decodeAccessToken(response.data.access_token);
        setAuth({
          id: claims.sub,
          email: claims.email,
          role: claims.role,
          accessToken: response.data.access_token,
        });
      } catch {
        // Refresh cookie missing/expired/invalid — the persisted
        // isAuthenticated flag was stale. Clear it so routing (whatever
        // ProtectedRoute's exact check is) sends the user to /login
        // instead of rendering a shell with no valid session.
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isHydrating };
}
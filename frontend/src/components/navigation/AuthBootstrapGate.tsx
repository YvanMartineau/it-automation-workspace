// frontend/src/components/navigation/AuthBootstrapGate.tsx
import type { ReactNode } from "react";
import { useAuthBootstrap } from "#/hooks/useAuthBootstrap";
import { PageLoader } from "#/components/PageLoader";

/**
 * Wraps the router so a reload with a stale isAuthenticated=true /
 * user=null state resolves via /auth/refresh BEFORE any route renders.
 * Sits outside ProtectedRoute entirely: this isn't a route guard, it's a
 * "is the session shell ready yet" gate every route benefits from —
 * including /login, since redirect-away-if-already-logged-in logic (if
 * ProtectedRoute or Login.tsx does that) can only run correctly once
 * `user` is actually populated, not just `isAuthenticated`.
 */
export function AuthBootstrapGate({ children }: { children: ReactNode }) {
  const { isHydrating } = useAuthBootstrap();

  if (isHydrating) {
    return <PageLoader />;
  }

  return <>{children}</>;
}
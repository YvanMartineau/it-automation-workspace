// frontend/src/hooks/useAuth.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
  id: string;
  email: string;
  role: string;
  accessToken: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  setAuth: (user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      setAuth: (user) => set({ isAuthenticated: true, user }),
      logout: () => set({ isAuthenticated: false, user: null }),
    }),
    {
      name: "it-dashboard-auth",
      // CW-6: never persist the access token to localStorage.
      // On reload, isAuthenticated flips true from disk but user/token
      // stay null until /auth/refresh repopulates them (see note below).
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated }),
    }
  )
);
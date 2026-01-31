import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, authApi, type User } from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: { displayName?: string; bio?: string }) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setToken: (token) => {
        api.setToken(token);
        set({ token });
      },

      login: async (displayName?: string) => {
        set({ isLoading: true });
        try {
          const result = await authApi.devLogin(displayName);
          api.setToken(result.token);
          set({
            user: result.user,
            token: result.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // Ignore errors on logout
        }
        api.setToken(null);
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      refreshUser: async () => {
        const { token } = get();
        if (!token) return;

        try {
          api.setToken(token);
          const user = await authApi.getMe();
          set({ user, isAuthenticated: true });
        } catch {
          // Token invalid, clear auth state
          api.setToken(null);
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      updateProfile: async (data) => {
        const user = await authApi.updateProfile(data);
        set({ user });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.setToken(state.token);
          state.refreshUser();
        }
      },
    }
  )
);

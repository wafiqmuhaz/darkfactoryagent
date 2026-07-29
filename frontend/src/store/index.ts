import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  hasCompletedOnboarding: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  completeOnboarding: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      hasCompletedOnboarding: false,
      setAuth: (user: User, token: string) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: 'auth-storage',
    }
  )
);

export interface ProjectState {
  currentProjectId: string | null;
  setCurrentProject: (id: string | null) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      currentProjectId: null,
      setCurrentProject: (id: string | null) => set({ currentProjectId: id }),
    }),
    {
      name: 'project-storage',
    }
  )
);

export type Theme = 'light' | 'dark' | 'system';

export interface UIState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ui-storage',
    }
  )
);

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  timestamp: number;
}

export interface NotificationState {
  notifications: Notification[];
  addNotification: (type: NotificationType, message: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  addNotification: (type, message) =>
    set((state) => ({
      notifications: [
        {
          id: Math.random().toString(36).substring(7),
          type,
          message,
          read: false,
          timestamp: Date.now(),
        },
        ...state.notifications,
      ].slice(0, 50), // keep only last 50
    })),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
  clearAll: () => set({ notifications: [] }),
}));

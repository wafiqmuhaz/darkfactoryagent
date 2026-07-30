import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useUIStore, useNotificationStore } from '../../store';
import type { AuthState, UIState, NotificationState } from '../../store';
import { Menu, X, Sun, Moon, Laptop, Bell, LogOut, LayoutDashboard, Columns3, Folder, Cpu, Puzzle, BarChart3, Settings, Store, Timer, DollarSign, Activity } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/kanban', label: 'Task Board', icon: Columns3 },
  { path: '/projects', label: 'Projects', icon: Folder },
  { path: '/agents', label: 'Agents', icon: Cpu },
  { path: '/skills', label: 'Skills', icon: Puzzle },
  { path: '/skills-store', label: 'Skills Store', icon: Store },
  { path: '/routines', label: 'Routines', icon: Timer },
  { path: '/costs', label: 'Costs', icon: DollarSign },
  { path: '/activity', label: 'Activity', icon: Activity },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const logout = useAuthStore((state: AuthState) => state.logout);
  const { theme, setTheme } = useUIStore((state: UIState) => state);
  const notifications = useNotificationStore((state: NotificationState) => state.notifications);
  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;
  const currentPage = navItems.find(item => item.path === location.pathname)?.label || 'Dark Factory';

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 border-r border-border bg-background lg:bg-secondary/30 p-4 flex flex-col transform transition-transform duration-200 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        aria-label="Sidebar Navigation"
      >
        <div className="flex items-center justify-between mb-8 shrink-0">
          <h1 className="text-xl font-bold">Dark Factory</h1>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md hover:bg-secondary"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setIsSidebarOpen(false);
                }}
                className={`flex items-center gap-3 w-full p-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-secondary text-primary font-medium'
                    : 'hover:bg-secondary text-foreground'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 pt-4 border-t border-border">
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-2 w-full p-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-background/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1 rounded-md hover:bg-secondary"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-medium truncate">{currentPage}</h2>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            {/* Theme Switcher */}
            <div className="flex bg-secondary rounded-lg p-1" role="group" aria-label="Theme switcher">
              <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-md transition-all ${theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                aria-label="Light theme"
                aria-pressed={theme === 'light'}
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-md transition-all ${theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                aria-label="Dark theme"
                aria-pressed={theme === 'dark'}
              >
                <Moon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`p-1.5 rounded-md transition-all ${theme === 'system' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                aria-label="System theme"
                aria-pressed={theme === 'system'}
              >
                <Laptop className="w-4 h-4" />
              </button>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2 rounded-full hover:bg-secondary transition-colors"
                aria-label="Notifications"
                aria-expanded={isNotificationsOpen}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-destructive ring-2 ring-background">
                    <span className="sr-only">{unreadCount} unread notifications</span>
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-background border border-border rounded-lg shadow-lg z-50 p-2 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between p-2 border-b border-border mb-2">
                    <h3 className="font-semibold text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No notifications yet.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {notifications.slice(0, 10).map((n) => (
                        <div key={n.id} className={`p-2 text-sm rounded-md ${n.read ? 'opacity-60' : 'bg-secondary/50 font-medium'}`}>
                          {n.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

import React from 'react';
import { useAuthStore } from '../../store';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="flex h-screen w-full bg-background">
      <aside className="w-64 border-r border-border bg-secondary/30 p-4">
        <h1 className="text-xl font-bold mb-8">Dark Factory</h1>
        <nav className="space-y-2">
          <a href="#" className="block p-2 rounded-md hover:bg-secondary">Dashboard</a>
          <a href="#" className="block p-2 rounded-md bg-secondary text-primary">Kanban Board</a>
          <a href="#" className="block p-2 rounded-md hover:bg-secondary">Projects</a>
        </nav>
        <div className="absolute bottom-4 left-4">
          <button onClick={logout} className="text-sm text-destructive hover:underline">
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <header className="h-14 border-b border-border flex items-center px-6 bg-background/95 backdrop-blur">
          <h2 className="text-lg font-medium">Kanban Board</h2>
        </header>
        <div className="p-6 h-[calc(100vh-3.5rem)]">
          {children}
        </div>
      </main>
    </div>
  );
};

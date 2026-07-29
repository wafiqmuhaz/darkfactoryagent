import { useState } from 'react';
import { useUIStore, useAuthStore } from '../store';
import type { AuthState, UIState, Theme } from '../store';
import { Button } from '../components/common/Button';
import { Sun, Moon, Laptop, Key, Save } from 'lucide-react';

export const Settings = () => {
  const theme = useUIStore((state: UIState) => state.theme);
  const setTheme = useUIStore((state: UIState) => state.setTheme);
  const user = useAuthStore((state: AuthState) => state.user);

  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveApiKey = () => {
    // In a real app, this would call the backend
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
    { value: 'system', label: 'System', icon: <Laptop className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your preferences and API keys</p>
      </div>

      {/* Profile */}
      <section className="bg-background border border-border rounded-lg p-6 shadow-sm">
        <h2 className="font-semibold mb-4">Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">Username</label>
            <div className="font-medium">{user?.username || 'User'}</div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Email</label>
            <div className="font-medium">{user?.email || 'user@example.com'}</div>
          </div>
        </div>
      </section>

      {/* Theme */}
      <section className="bg-background border border-border rounded-lg p-6 shadow-sm">
        <h2 className="font-semibold mb-4">Theme</h2>
        <div className="flex gap-2">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                theme === opt.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* API Key */}
      <section className="bg-background border border-border rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold">API Keys</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">OpenAI API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="sk-..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Default Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="claude-sonnet-4">Claude Sonnet 4</option>
              <option value="claude-haiku">Claude Haiku</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="ollama">Ollama (Local)</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSaveApiKey} disabled={!apiKey}>
              <Save className="w-4 h-4" /> Save
            </Button>
            {isSaved && <span className="text-sm text-green-500">Saved!</span>}
          </div>
        </div>
      </section>
    </div>
  );
};

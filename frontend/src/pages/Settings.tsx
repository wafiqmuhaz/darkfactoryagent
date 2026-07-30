import { useState, useEffect } from 'react';
import { useUIStore, useAuthStore } from '../store';
import type { AuthState, UIState, Theme } from '../store';
import { apiClient } from '../api/client';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { Sun, Moon, Laptop, Key, Save, Building2, Users, Shield, Mail, Plug, Eye, EyeOff, RefreshCw } from 'lucide-react';

interface CompanyInfo {
  id: string;
  name: string;
  mission: string;
  _count: { projects: number; invites: number; members: number };
}

interface CompanyMember {
  id: string;
  role: string;
  userId: string;
  company: { name: string };
}

export const Settings = () => {
  const theme = useUIStore((state: UIState) => state.theme);
  const setTheme = useUIStore((state: UIState) => state.setTheme);
  const user = useAuthStore((state: AuthState) => state.user);

  const [activeTab, setActiveTab] = useState('company');
  const [isLoading, setIsLoading] = useState(false);

  // Company state
  const [_company, setCompany] = useState<CompanyInfo | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyMission, setCompanyMission] = useState('');
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [saved, setSaved] = useState(false);

  // Secrets state
  const [secretKey, setSecretKey] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  // Adapter state
  const [adapters, setAdapters] = useState<any[]>([]);

  useEffect(() => {
    loadCompanyData();
    loadAdapters();
  }, []);

  const loadCompanyData = async () => {
    setIsLoading(true);
    try {
      const [companyRes, membersRes] = await Promise.all([
        apiClient.get('/company'),
        apiClient.get('/company/members'),
      ]);
      const c = companyRes.data.company;
      setCompany(c);
      setCompanyName(c.name);
      setCompanyMission(c.mission || '');
      setMembers(membersRes.data.members || []);
    } catch (err) {
      console.error('Failed to load company:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAdapters = async () => {
    try {
      const res = await apiClient.get('/adapters');
      setAdapters(res.data.adapters || []);
    } catch {
      setAdapters([]);
    }
  };

  const handleUpdateCompany = async () => {
    try {
      await apiClient.put('/company', { name: companyName, mission: companyMission });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error('Update company failed:', err);
    }
  };

  const handleSaveSecret = async () => {
    if (!secretKey || !secretValue) return;
    try {
      await apiClient.post('/company/secrets', { key: secretKey, value: secretValue });
      setSecretKey('');
      setSecretValue('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error('Save secret failed:', err);
    }
  };

  const handleCreateInvite = async () => {
    if (!inviteEmail) return;
    try {
      await apiClient.post('/company/invites', { email: inviteEmail, role: inviteRole });
      setInviteEmail('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error('Create invite failed:', err);
    }
  };

  const tabs = [
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'invites', label: 'Invites', icon: Mail },
    { id: 'secrets', label: 'Secrets', icon: Key },
    { id: 'instance', label: 'Instance', icon: Shield },
    { id: 'adapters', label: 'Adapters', icon: Plug },
  ];

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
    { value: 'system', label: 'System', icon: <Laptop className="w-4 h-4" /> },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'company':
        return (
          <div className="space-y-6">
            <section className="bg-background border border-border rounded-lg p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Company Profile</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Company Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Mission</label>
                  <textarea
                    value={companyMission}
                    onChange={(e) => setCompanyMission(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={handleUpdateCompany}>
                    <Save className="w-4 h-4 mr-1" /> Save
                  </Button>
                  {saved && <span className="text-sm text-green-500">Saved!</span>}
                </div>
              </div>
            </section>

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

            <section className="bg-background border border-destructive/30 rounded-lg p-6 shadow-sm">
              <h2 className="font-semibold text-destructive mb-4">Danger Zone</h2>
              <p className="text-sm text-muted-foreground mb-4">Irreversible actions for your company.</p>
              <Button variant="destructive" size="sm">Delete Company</Button>
            </section>
          </div>
        );

      case 'members':
        return (
          <section className="bg-background border border-border rounded-lg p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Team Members</h2>
            {isLoading ? (
              <Spinner size="md" />
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            ) : (
              <div className="space-y-3">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div>
                      <div className="text-sm font-medium">{m.userId}</div>
                      <div className="text-xs text-muted-foreground">{m.company.name}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                      m.role === 'owner' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
                    }`}>
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        );

      case 'invites':
        return (
          <section className="bg-background border border-border rounded-lg p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Invite Members</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <Button onClick={handleCreateInvite}>
                <Mail className="w-4 h-4 mr-1" /> Send Invite
              </Button>
              {saved && <span className="text-sm text-green-500 ml-2">Invite sent!</span>}
            </div>
          </section>
        );

      case 'secrets':
        return (
          <section className="bg-background border border-border rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-semibold">Environment Secrets</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Store API keys and sensitive configuration values securely.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Key</label>
                <input
                  type="text"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="ANTHROPIC_API_KEY"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Value</label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={secretValue}
                    onChange={(e) => setSecretValue(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 pr-10 rounded-md border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button onClick={handleSaveSecret} disabled={!secretKey || !secretValue}>
                <Save className="w-4 h-4 mr-1" /> Save Secret
              </Button>
              {saved && <span className="text-sm text-green-500 ml-2">Secret saved!</span>}
            </div>
          </section>
        );

      case 'instance':
        return (
          <div className="space-y-6">
            <section className="bg-background border border-border rounded-lg p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Instance Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Profile</label>
                  <div className="p-3 bg-secondary/30 rounded-lg">
                    <div className="text-sm">{user?.username || 'User'}</div>
                    <div className="text-xs text-muted-foreground">{user?.email || 'user@example.com'}</div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Node Environment</label>
                  <div className="text-sm text-muted-foreground">{import.meta.env.DEV ? 'Development' : 'Production'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">API URL</label>
                  <div className="text-sm text-muted-foreground font-mono">{import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}</div>
                </div>
              </div>
            </section>

            <section className="bg-background border border-border rounded-lg p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Access</h2>
              <p className="text-sm text-muted-foreground">JWT-based authentication is active.</p>
              <div className="mt-2 p-3 bg-secondary/30 rounded-lg text-sm">
                <span className="text-muted-foreground">Token expires:</span> 7 days
              </div>
            </section>
          </div>
        );

      case 'adapters':
        return (
          <section className="bg-background border border-border rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Plug className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-semibold">Adapter Configuration</h2>
              </div>
              <Button size="sm" variant="outline" onClick={loadAdapters}>
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Manage AI adapters for agent execution.</p>

            {adapters.length === 0 ? (
              <p className="text-sm text-muted-foreground">No adapters configured.</p>
            ) : (
              <div className="space-y-3">
                {adapters.map((adapter) => (
                  <div key={adapter.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div>
                      <div className="text-sm font-medium">{adapter.name}</div>
                      <div className="text-xs text-muted-foreground">{adapter.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        adapter.probeStatus === 'ready' ? 'bg-green-500/10 text-green-600' :
                        adapter.probeStatus === 'error' ? 'bg-destructive/10 text-destructive' :
                        'bg-secondary text-muted-foreground'
                      }`}>
                        {adapter.probeStatus === 'ready' ? 'Connected' :
                         adapter.probeStatus === 'error' ? 'Error' : 'Not tested'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your company, members, and configuration</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {renderTab()}
    </div>
  );
};

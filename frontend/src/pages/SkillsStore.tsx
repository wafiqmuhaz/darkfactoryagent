import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { Search, Download, Check, X, RefreshCw, Grid3X3, List, Globe, Smartphone, FileText, Database, Puzzle } from 'lucide-react';

interface StoreSkill {
  name: string;
  displayName: string;
  description: string;
  category: string;
  version: string;
  author: string;
  icon?: string;
  tags?: string;
  isInstalled: boolean;
  isEnabled: boolean;
  source: string;
}

const categoryIcons: Record<string, any> = {
  browser: Globe,
  mobile: Smartphone,
  filesystem: FileText,
  api: Database,
  custom: Puzzle,
};

export const SkillsStore = () => {
  const [skills, setSkills] = useState<StoreSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [filterMode, setFilterMode] = useState<'all' | 'installed'>('all');
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/skills');
      setSkills(res.data.skills || []);
    } catch {
      setSkills([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstall = async (skillName: string) => {
    setActivating(skillName);
    try {
      await apiClient.post('/skills/install', { skillName });
      await loadSkills();
    } catch (err: any) {
      console.error('Install failed:', err);
    } finally {
      setActivating(null);
    }
  };

  const handleUninstall = async (skillName: string) => {
    setActivating(skillName);
    try {
      await apiClient.post('/skills/uninstall', { skillName });
      await loadSkills();
    } catch (err: any) {
      console.error('Uninstall failed:', err);
    } finally {
      setActivating(null);
    }
  };

  const categories = ['all', ...new Set(skills.map(s => s.category))];

  const filtered = skills.filter(s => {
    if (filterMode === 'installed' && !s.isInstalled) return false;
    if (category !== 'all' && s.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.displayName?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q);
    }
    return true;
  });

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Skills Store</h1>
          <p className="text-muted-foreground text-sm mt-1">Browse, install, and manage agent skills</p>
        </div>
        <Button variant="outline" onClick={loadSkills}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="w-full pl-9 pr-4 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex bg-secondary rounded-lg p-1">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 text-xs rounded-md transition-all ${filterMode === 'all' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode('installed')}
              className={`px-3 py-1.5 text-xs rounded-md transition-all ${filterMode === 'installed' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
            >
              Installed
            </button>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-all capitalize ${
              category === cat ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      {/* Skills grid */}
      {filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <Puzzle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No skills found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((skill) => {
            const Icon = categoryIcons[skill.category] || Puzzle;
            const isInstalling = activating === skill.name;

            return (
              <div key={skill.name} className="bg-background border border-border rounded-lg p-4 hover:border-primary/30 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{skill.displayName || skill.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{skill.category} · v{skill.version}</div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    skill.isInstalled ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-secondary text-muted-foreground'
                  }`}>
                    {skill.isInstalled ? 'Installed' : 'Available'}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{skill.description}</p>

                {skill.tags && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {skill.tags.split(',').slice(0, 3).map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 bg-secondary text-xs rounded">{tag.trim()}</span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">{skill.author}</span>
                  {skill.isInstalled ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUninstall(skill.name)}
                        isLoading={isInstalling}
                        disabled={skill.isBuiltIn}
                      >
                        <X className="w-3 h-3 mr-1" /> Uninstall
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleInstall(skill.name)}
                      isLoading={isInstalling}
                    >
                      <Download className="w-3 h-3 mr-1" /> Install
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

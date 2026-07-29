import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { Badge } from '../components/common/Badge';
import { Spinner } from '../components/common/Spinner';
import { Puzzle, Globe, Smartphone, FileCode, GitBranch, Terminal, Wrench } from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  version: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  browser: <Globe className="w-5 h-5" />,
  mobile: <Smartphone className="w-5 h-5" />,
  filesystem: <FileCode className="w-5 h-5" />,
  api: <Globe className="w-5 h-5" />,
  git: <GitBranch className="w-5 h-5" />,
  shell: <Terminal className="w-5 h-5" />,
  custom: <Wrench className="w-5 h-5" />,
};

export const Skills = () => {
  const { data: skills, isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const res = await apiClient.get('/skills');
      return res.data as Skill[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const defaultSkills: Skill[] = skills?.length ? skills : [
    { id: 'browser-use', name: 'Browser Use', description: 'Web automation — navigate, click, extract, screenshot', category: 'browser', enabled: true, version: '1.0.0' },
    { id: 'droidmind', name: 'DroidMind', description: 'Android device automation via ADB', category: 'mobile', enabled: true, version: '1.0.0' },
    { id: 'file-system', name: 'File System', description: 'Read, write, and manage files on the local filesystem', category: 'filesystem', enabled: true, version: '1.0.0' },
    { id: 'api-integration', name: 'API Integration', description: 'HTTP requests, GraphQL, file upload/download', category: 'api', enabled: true, version: '1.0.0' },
    { id: 'git-operations', name: 'Git Operations', description: 'Clone, commit, push, branch management', category: 'git', enabled: false, version: '1.0.0' },
    { id: 'shell-executor', name: 'Shell Executor', description: 'Execute shell commands in sandboxed environment', category: 'shell', enabled: false, version: '1.0.0' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Skills</h1>
        <p className="text-muted-foreground text-sm mt-1">Browse and configure agent skills</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {defaultSkills.map((skill) => (
          <div key={skill.id} className="bg-background border border-border rounded-lg p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                {categoryIcons[skill.category] || <Puzzle className="w-5 h-5" />}
              </div>
              <Badge variant={skill.enabled ? 'success' : 'secondary'}>
                {skill.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <h3 className="font-semibold mb-1">{skill.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">{skill.description}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <Badge variant="outline">{skill.category}</Badge>
              <span>v{skill.version}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

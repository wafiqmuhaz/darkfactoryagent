import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { Badge } from '../components/common/Badge';
import { Spinner } from '../components/common/Spinner';
import {
  Puzzle, Globe, Smartphone, FileCode, GitBranch, Terminal, Wrench,
  ToggleLeft, ToggleRight, AlertTriangle, AlertCircle, Loader2,
} from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  version: string;
  enabled: boolean;
  builtIn: boolean;
  warning?: string;
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
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const res = await apiClient.get('/skills');
      return res.data as Skill[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ name, enabled }: { name: string; enabled: boolean }) => {
      const res = await apiClient.patch(`/skills/${name}/toggle`, { enabled });
      return res.data;
    },
    onMutate: ({ name }) => { setPending(name); setError(null); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills'] }),
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to change skill state'),
    onSettled: () => setPending(null),
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const enabledCount = skills.filter((s) => s.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Skills</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {enabledCount} of {skills.length} enabled. Disabled skills are refused at execution time.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline shrink-0">dismiss</button>
        </div>
      )}

      {skills.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <Puzzle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No skills registered.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => {
            const isPending = pending === skill.name;

            return (
              <div
                key={skill.id}
                className={`bg-background border rounded-lg p-5 shadow-sm transition-colors ${
                  skill.enabled ? 'border-border' : 'border-border opacity-75'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    skill.enabled ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
                  }`}>
                    {categoryIcons[skill.category] || <Puzzle className="w-5 h-5" />}
                  </div>
                  <Badge variant={skill.enabled ? 'success' : 'secondary'}>
                    {skill.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>

                <h3 className="font-semibold mb-1">{skill.displayName}</h3>
                <p className="text-sm text-muted-foreground mb-3">{skill.description}</p>

                {skill.warning && (
                  <div className="flex items-start gap-1.5 text-xs text-orange-600 dark:text-orange-400 bg-orange-500/5 border border-orange-500/20 rounded p-2 mb-3">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{skill.warning}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{skill.category}</Badge>
                    <span>v{skill.version}</span>
                  </div>

                  <button
                    onClick={() => toggle.mutate({ name: skill.name, enabled: !skill.enabled })}
                    disabled={isPending}
                    aria-pressed={skill.enabled}
                    aria-label={`${skill.enabled ? 'Disable' : 'Enable'} ${skill.displayName}`}
                    className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors disabled:opacity-50 ${
                      skill.enabled
                        ? 'text-green-600 dark:text-green-400 hover:bg-green-500/10'
                        : 'text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : skill.enabled ? (
                      <ToggleRight className="w-4 h-4" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                    {skill.enabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

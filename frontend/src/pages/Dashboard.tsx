import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useProjectStore } from '../store';
import type { ProjectState } from '../store';
import { useProjectSocket } from '../hooks/useProjectSocket';
import { StatsCards } from '../components/Dashboard/StatsCards';
import { Spinner } from '../components/common/Spinner';
import {
  ListTodo, Loader2, AlertTriangle, DollarSign, Columns3, Timer,
  Activity as ActivityIcon, Cpu, CheckCircle, XCircle, Folder,
} from 'lucide-react';
import { formatRelativeTime } from '../utils/helpers';

interface Metrics {
  tasks: { total: number; backlog: number; todo: number; inProgress: number; review: number; done: number; failed: number };
  queue: Record<string, number>;
  runs: { running: number; failed: number };
  artifacts: number;
  cost: { monthlySpend: number; budget: number | null; percentage: number };
  recentActivity: { id: string; type: string; message: string; createdAt: string }[];
}

interface AgentStatusPayload {
  adapter: { id: string; name: string; model: string; status: string; available: boolean; probeStatus: string };
  currentRun: { taskTitle: string | null; startedAt: string } | null;
  lastRun: { status: string; taskTitle: string | null; durationSec: number; error: string | null; completedAt: string } | null;
}

const LOG_DOT: Record<string, string> = {
  task_created: 'bg-blue-500',
  task_status: 'bg-slate-400',
  task_success: 'bg-green-500',
  task_failed: 'bg-red-500',
  error: 'bg-red-500',
  agent_run: 'bg-purple-500',
  adapter: 'bg-cyan-500',
  skill: 'bg-orange-500',
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentProjectId = useProjectStore((s: ProjectState) => s.currentProjectId);

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      try {
        return (await apiClient.get('/company')).data.company;
      } catch {
        return null; // onboarding may not be complete
      }
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await apiClient.get('/projects')).data as { id: string; name: string }[],
  });

  const scope = currentProjectId ?? projects[0]?.id;

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['metrics', scope],
    queryFn: async () => {
      const query = scope ? `?projectId=${scope}` : '';
      return (await apiClient.get(`/metrics${query}`)).data as Metrics;
    },
  });

  const { data: agent } = useQuery({
    queryKey: ['agent-status'],
    queryFn: async () => (await apiClient.get('/agents/status')).data as AgentStatusPayload,
  });

  // Live: any task or activity event refreshes the figures.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['metrics', scope] });
    queryClient.invalidateQueries({ queryKey: ['agent-status'] });
  };
  useProjectSocket(scope, {
    onTaskCreated: refresh,
    onTaskUpdated: refresh,
    onTaskDeleted: refresh,
    onActivityLog: refresh,
  });

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner size="lg" /></div>;
  }

  const tasks = metrics?.tasks;
  const cost = metrics?.cost;

  const stats = [
    {
      label: 'Total Tasks',
      value: tasks?.total ?? 0,
      icon: <ListTodo className="w-4 h-4" />,
      change: `${tasks?.backlog ?? 0} backlog · ${tasks?.todo ?? 0} queued`,
      trend: 'neutral' as const,
    },
    {
      label: 'In Progress',
      value: tasks?.inProgress ?? 0,
      icon: <Loader2 className={`w-4 h-4 ${(tasks?.inProgress ?? 0) > 0 ? 'animate-spin' : ''}`} />,
      change: `${metrics?.queue?.waiting ?? 0} waiting in queue`,
      trend: 'neutral' as const,
    },
    {
      label: 'Failed',
      value: tasks?.failed ?? 0,
      icon: <AlertTriangle className="w-4 h-4" />,
      change: (tasks?.failed ?? 0) > 0 ? 'Needs recovery' : 'None',
      trend: (tasks?.failed ?? 0) > 0 ? ('down' as const) : ('up' as const),
    },
    {
      label: 'Monthly Spend',
      value: `$${(cost?.monthlySpend ?? 0).toFixed(4)}`,
      icon: <DollarSign className="w-4 h-4" />,
      change: cost?.budget ? `of $${cost.budget.toFixed(2)} (${cost.percentage}%)` : 'No budget set',
      trend: (cost?.percentage ?? 0) > 80 ? ('down' as const) : ('up' as const),
    },
  ];

  const quickActions = [
    { label: 'Task Board', icon: Columns3, path: '/kanban', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Routines', icon: Timer, path: '/routines', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Costs', icon: DollarSign, path: '/costs', color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Activity', icon: ActivityIcon, path: '/activity', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{company?.name ?? 'Dashboard'}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {company?.mission || 'Overview of your development pipeline'}
        </p>
      </div>

      {projects.length === 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary/30">
          <Folder className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="flex-1 text-sm">
            No project yet — create one to start queueing tasks.
          </div>
          <button onClick={() => navigate('/projects')} className="text-sm text-primary hover:underline shrink-0">
            Go to Projects
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg hover:border-primary/50 transition-all text-left"
            >
              <div className={`w-9 h-9 rounded-lg ${action.bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${action.color}`} />
              </div>
              <span className="text-sm font-medium">{action.label}</span>
            </button>
          );
        })}
      </div>

      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent activity, straight from the Activity table */}
        <div className="bg-background border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <ActivityIcon className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">Recent Activity</h3>
          </div>
          {!metrics?.recentActivity?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {metrics.recentActivity.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${LOG_DOT[item.type] ?? 'bg-secondary'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-2">{item.message}</p>
                    <span className="text-xs text-muted-foreground">
                      {item.type.replace(/_/g, ' ')} · {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Single active adapter, not a roster of roles */}
        <div className="bg-background border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">Active Adapter</h3>
          </div>

          {!agent ? (
            <p className="text-sm text-muted-foreground text-center py-8">Adapter status unavailable.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{agent.adapter.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {agent.adapter.id} · {agent.adapter.model}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                  agent.adapter.status === 'running' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : agent.adapter.available ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-destructive/10 text-destructive'
                }`}>
                  {agent.adapter.status}
                </span>
              </div>

              {agent.currentRun && (
                <div className="p-3 rounded-md bg-blue-500/5 border border-blue-500/20 text-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    <span className="font-medium">{agent.currentRun.taskTitle ?? 'Running task'}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Started {formatRelativeTime(agent.currentRun.startedAt)}
                  </div>
                </div>
              )}

              {agent.lastRun && (
                <div className="p-3 rounded-md bg-secondary/30 text-sm">
                  <div className="flex items-center gap-2">
                    {agent.lastRun.status === 'completed'
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                    <span className="font-medium truncate">{agent.lastRun.taskTitle ?? 'Last run'}</span>
                  </div>
                  {agent.lastRun.error && (
                    <p className="text-xs text-destructive mt-1 line-clamp-2">{agent.lastRun.error}</p>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {agent.lastRun.durationSec}s · {agent.lastRun.completedAt ? formatRelativeTime(agent.lastRun.completedAt) : ''}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-border">
                <div>
                  <div className="text-lg font-semibold">{metrics?.queue?.waiting ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Waiting</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">{metrics?.queue?.active ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Active</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">{metrics?.queue?.failed ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Failed jobs</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

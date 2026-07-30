import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useProjectStore } from '../store';
import type { ProjectState } from '../store';
import { useProjectSocket } from '../hooks/useProjectSocket';
import { useAgentRoster, useCompanySeries } from '../hooks/useAgents';
import { useTasks } from '../hooks/useTasks';
import { StatsCards } from '../components/Dashboard/StatsCards';
import { Spinner } from '../components/common/Spinner';
import { BarChart } from '../components/charts/BarChart';
import { LineChart } from '../components/charts/LineChart';
import { StatusBadge } from '../components/agents/primitives';
import {
  ListTodo, Loader2, AlertTriangle, DollarSign, Columns3, Timer,
  Activity as ActivityIcon, Cpu, CheckCircle, XCircle, Folder, Bot,
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

  // Company-wide roster, daily series, and recent tasks — all real rows.
  const { data: roster = [] } = useAgentRoster();
  const { data: series } = useCompanySeries(14);
  const { tasks: recentTasks } = useTasks(scope);

  // Live: any task or activity event refreshes the figures.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['metrics', scope] });
    queryClient.invalidateQueries({ queryKey: ['agent-status'] });
    queryClient.invalidateQueries({ queryKey: ['agents'] });
    if (scope) queryClient.invalidateQueries({ queryKey: ['tasks', scope] });
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

      {/* Agent roster — one card per company agent, all real rows. */}
      {roster.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold">Agents</h3>
              <span className="text-xs text-muted-foreground">{roster.length}</span>
            </div>
            <Link to="/agents" className="text-xs text-primary hover:underline">See All →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {roster.map((a) => (
              <Link
                key={a.id}
                to={`/agents/${a.id}`}
                className="block bg-background border border-border rounded-lg p-4 hover:border-primary/50 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{a.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.title || a.role || a.type}
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>

                <div className="text-xs text-muted-foreground font-mono mt-2 truncate">
                  {a.adapter.name ?? 'no adapter'} · {a.model}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mt-3 pt-3 border-t border-border">
                  <div>
                    <div className="text-sm font-semibold">{a.runs.total}</div>
                    <div className="text-[11px] text-muted-foreground">Runs</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">
                      {a.successRate === null ? '—' : `${a.successRate}%`}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Success</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">${a.totalSpendUsd.toFixed(a.totalSpendUsd < 1 ? 4 : 2)}</div>
                    <div className="text-[11px] text-muted-foreground">Spend</div>
                  </div>
                </div>

                {a.runs.failed > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {a.runs.failed} failed {a.runs.failed === 1 ? 'run' : 'runs'} — needs recovery
                  </div>
                )}
                {a.runs.failed === 0 && a.latestRun && (
                  <div className="mt-3 text-xs text-muted-foreground truncate">
                    Last run {a.latestRun.status.replace(/_/g, ' ')} · {formatRelativeTime(a.latestRun.createdAt)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Company-wide daily series — four charts from the same 14-day window. */}
      {series && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <BarChart
            title="Run Activity"
            subtitle="Last 14 days"
            dates={series.dates}
            series={[{ key: 'runs', label: 'Runs', colorVar: '--viz-series-1', values: series.runActivity }]}
          />
          <BarChart
            title="Tasks by Priority"
            subtitle="Last 14 days"
            dates={series.dates}
            series={[
              { key: 'critical', label: 'Critical', colorVar: '--viz-ordinal-4', values: series.tasksByPriority.critical },
              { key: 'high', label: 'High', colorVar: '--viz-ordinal-3', values: series.tasksByPriority.high },
              { key: 'medium', label: 'Medium', colorVar: '--viz-ordinal-2', values: series.tasksByPriority.medium },
              { key: 'low', label: 'Low', colorVar: '--viz-ordinal-1', values: series.tasksByPriority.low },
            ]}
          />
          <BarChart
            title="Tasks by Status"
            subtitle="Last 14 days"
            dates={series.dates}
            series={[
              { key: 'in_progress', label: 'In progress', colorVar: '--viz-series-1', values: series.tasksByStatus.in_progress },
              { key: 'review', label: 'Review', colorVar: '--viz-series-4', values: series.tasksByStatus.review },
              { key: 'done', label: 'Done', colorVar: '--viz-series-3', values: series.tasksByStatus.done },
              { key: 'failed', label: 'Failed', colorVar: '--viz-series-2', values: series.tasksByStatus.failed },
            ]}
          />
          <LineChart
            title="Success Rate"
            subtitle="Last 14 days"
            dates={series.dates}
            maxValue={100}
            series={[{ key: 'rate', label: 'Success rate', colorVar: '--viz-series-3', values: series.successRate }]}
            format={(v) => `${v}%`}
          />
        </div>
      )}

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

      {/* Recent Tasks — project-scoped rows straight from the Tasks table. */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">Recent Tasks</h3>
          </div>
          <Link to="/kanban" className="text-xs text-primary hover:underline">See All →</Link>
        </div>
        {recentTasks.length === 0 ? (
          <div className="border border-border rounded-lg bg-background">
            <p className="text-sm text-muted-foreground text-center py-8">No tasks yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {recentTasks.slice(0, 8).map((task) => (
              <li key={task.id} className="flex items-center gap-3 px-4 py-2.5 bg-background">
                <span className="text-xs font-mono text-muted-foreground shrink-0">
                  {task.id.slice(0, 6).toUpperCase()}
                </span>
                <span className="text-sm truncate flex-1">{task.title}</span>
                <StatusBadge status={task.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

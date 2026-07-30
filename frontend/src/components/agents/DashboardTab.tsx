import { Link } from 'react-router-dom';
import { AlertTriangle, ListTodo } from 'lucide-react';
import { useAgentDetail, useAgentSeries, useAgentTasks } from '../../hooks/useAgents';
import { BarChart } from '../charts/BarChart';
import { LineChart } from '../charts/LineChart';
import { Spinner } from '../common/Spinner';
import { StatusBadge, StatTile, EmptyState } from './primitives';
import { formatNumber, formatRelativeTime } from '../../utils/helpers';

const usd = (v: number) => `$${v.toFixed(v < 1 ? 4 : 2)}`;

/**
 * Dashboard tab. Every number here comes from AgentRun / Task / CostLedger rows
 * attributed to this agent — nothing is synthesized client-side.
 */
export const DashboardTab = ({ agentId }: { agentId: string }) => {
  const { data: detail, isLoading } = useAgentDetail(agentId);
  const { data: series } = useAgentSeries(agentId, 14);
  const { data: tasks } = useAgentTasks(agentId, 5);

  if (isLoading || !detail) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  }

  const { latestRun, stats, costs } = detail;
  const dates = series?.dates ?? [];
  const last14 = 'Last 14 days';

  return (
    <div className="space-y-6">
      <section className="bg-background border border-border rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Latest Run</h2>
          {latestRun && (
            <Link
              to={`/agents/${agentId}?tab=runs&run=${latestRun.id}`}
              className="text-xs text-primary hover:underline"
            >
              View details →
            </Link>
          )}
        </div>

        {latestRun ? (
          <div className="flex items-start gap-3">
            <StatusBadge status={latestRun.status} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 text-sm">
                <span className="font-mono text-xs">{latestRun.id.slice(0, 8)}</span>
                <span className="text-muted-foreground capitalize">{latestRun.trigger}</span>
                <span className="text-muted-foreground text-xs">
                  {formatRelativeTime(latestRun.createdAt)}
                </span>
              </div>
              {latestRun.error && (
                <p className="text-xs text-destructive mt-1 whitespace-pre-wrap line-clamp-3">
                  {latestRun.error}
                </p>
              )}
              {latestRun.task && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {latestRun.task.title}
                </p>
              )}
            </div>
          </div>
        ) : (
          <EmptyState icon={<AlertTriangle className="w-8 h-8" />} title="No runs yet" hint="This agent has not executed a task." />
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <BarChart
          title="Run Activity"
          subtitle={last14}
          dates={dates}
          series={[
            { key: 'runs', label: 'Runs', colorVar: '--viz-series-1', values: series?.runActivity ?? [] },
          ]}
        />

        <BarChart
          title="Tasks by Priority"
          subtitle={last14}
          dates={dates}
          series={[
            { key: 'critical', label: 'Critical', colorVar: '--viz-ordinal-4', values: series?.tasksByPriority.critical ?? [] },
            { key: 'high', label: 'High', colorVar: '--viz-ordinal-3', values: series?.tasksByPriority.high ?? [] },
            { key: 'medium', label: 'Medium', colorVar: '--viz-ordinal-2', values: series?.tasksByPriority.medium ?? [] },
            { key: 'low', label: 'Low', colorVar: '--viz-ordinal-1', values: series?.tasksByPriority.low ?? [] },
          ]}
        />

        <BarChart
          title="Tasks by Status"
          subtitle={last14}
          dates={dates}
          series={[
            { key: 'in_progress', label: 'In progress', colorVar: '--viz-series-1', values: series?.tasksByStatus.in_progress ?? [] },
            { key: 'review', label: 'Review', colorVar: '--viz-series-4', values: series?.tasksByStatus.review ?? [] },
            { key: 'done', label: 'Done', colorVar: '--viz-series-3', values: series?.tasksByStatus.done ?? [] },
            { key: 'failed', label: 'Failed', colorVar: '--viz-series-2', values: series?.tasksByStatus.failed ?? [] },
          ]}
        />

        <LineChart
          title="Success Rate"
          subtitle={`${last14} · completed runs as a share of finished runs`}
          dates={dates}
          maxValue={100}
          series={[
            { key: 'rate', label: 'Success rate', colorVar: '--viz-series-3', values: series?.successRate ?? [] },
          ]}
          format={(v) => `${v}%`}
        />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Recent Tasks</h2>
          <Link to="/kanban" className="text-xs text-primary hover:underline">See All →</Link>
        </div>

        {tasks && tasks.length > 0 ? (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 px-4 py-2.5 bg-background">
                <span className="text-xs font-mono text-muted-foreground shrink-0">
                  {task.id.slice(0, 6).toUpperCase()}
                </span>
                <span className="text-sm truncate flex-1">{task.title}</span>
                <StatusBadge status={task.status} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="border border-border rounded-lg bg-background">
            <EmptyState icon={<ListTodo className="w-8 h-8" />} title="No tasks yet" />
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3">Costs</h2>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatTile label="Input tokens" value={formatNumber(costs.inputTokens)} />
          <StatTile label="Output tokens" value={formatNumber(costs.outputTokens)} />
          <StatTile label="Cached tokens" value={formatNumber(costs.cachedTokens)} />
          <StatTile
            label="Total cost"
            value={usd(costs.totalCostUsd)}
            hint={
              stats.totalRuns > 0
                ? `${stats.totalRuns} runs · ${stats.successRate ?? 0}% success`
                : 'No runs recorded'
            }
          />
        </div>
      </section>
    </div>
  );
};

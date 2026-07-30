import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { agentKeys, useAdapterStatus, useAgentRoster } from '../hooks/useAgents';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { StatusBadge } from '../components/agents/primitives';
import {
  Cpu, CheckCircle, XCircle, Loader2, Terminal, Container,
  RefreshCw, AlertCircle, ChevronRight,
} from 'lucide-react';
import { formatRelativeTime } from '../utils/helpers';

/**
 * Agents page: the company roster on top, then the single active adapter every
 * task executes through. Each roster row opens that agent's detail tabs.
 */
export const AgentStatus = () => {
  const queryClient = useQueryClient();
  const [probing, setProbing] = useState(false);
  const [probeMessage, setProbeMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading } = useAdapterStatus();
  const { data: roster, isLoading: rosterLoading } = useAgentRoster();

  const handleProbe = async () => {
    if (!data) return;
    setProbing(true);
    setProbeMessage(null);
    try {
      const res = await apiClient.post('/adapters/probe', { adapterId: data.adapter.id });
      setProbeMessage({ ok: res.data.status === 'ready', text: res.data.message });
      queryClient.invalidateQueries({ queryKey: agentKeys.adapterStatus() });
    } catch (err: any) {
      setProbeMessage({ ok: false, text: err.response?.data?.message || err.message });
    } finally {
      setProbing(false);
    }
  };

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            One adapter runs every task. Open an agent to review its runs, instructions, skills,
            configuration, and budget.
          </p>
        </div>
        {data && (
          <Button variant="outline" onClick={handleProbe} isLoading={probing}>
            <RefreshCw className="w-4 h-4 mr-1" /> Test now
          </Button>
        )}
      </div>

      {probeMessage && (
        <div className={`flex items-start gap-2 text-sm px-3 py-2 rounded-md ${
          probeMessage.ok
            ? 'text-green-700 dark:text-green-300 bg-green-500/10'
            : 'text-destructive bg-destructive/10'
        }`}>
          {probeMessage.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{probeMessage.text}</span>
        </div>
      )}

      {/* Company roster */}
      <section>
        <h2 className="text-sm font-semibold mb-2">Your agents</h2>

        {rosterLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : roster && roster.length > 0 ? (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {roster.map((agent) => (
              <li key={agent.id}>
                <Link
                  to={`/agents/${agent.id}`}
                  className="flex items-center gap-3 px-4 py-3 bg-background hover:bg-secondary/60 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Cpu className={`w-4 h-4 ${agent.status === 'running' ? 'animate-pulse' : ''}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{agent.name}</span>
                      <StatusBadge status={agent.status} />
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {agent.title ?? agent.role ?? agent.type}
                      {agent.adapter.name && ` · ${agent.adapter.name}`}
                      {` · ${agent.model}`}
                    </div>
                    {agent.latestRun?.error && (
                      <p className="text-xs text-destructive mt-0.5 line-clamp-1">
                        {agent.latestRun.error}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0 hidden sm:block">
                    <div className="text-xs tabular-nums">
                      {agent.runs.total} run{agent.runs.total === 1 ? '' : 's'}
                      {agent.successRate !== null && ` · ${agent.successRate}%`}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      ${agent.totalSpendUsd.toFixed(4)}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="border border-border rounded-lg bg-background text-center py-8 text-muted-foreground">
            <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No agents yet.</p>
            <p className="text-xs mt-1">Complete onboarding to create your team lead.</p>
          </div>
        )}
      </section>

      {data && <AdapterPanel data={data} />}
    </div>
  );
};

/** The instance-wide adapter every run goes through. */
const AdapterPanel = ({ data }: { data: NonNullable<ReturnType<typeof useAdapterStatus>['data']> }) => {
  const { adapter, currentRun, lastRun } = data;
  const RuntimeIcon = adapter.runtime === 'docker' ? Container : Terminal;

  const statusStyle =
    adapter.status === 'running' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
      : adapter.available ? 'bg-green-500/10 text-green-600 dark:text-green-400'
      : 'bg-destructive/10 text-destructive';

  return (
    <>
      <section className="bg-background border border-border rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${
              adapter.available ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
            }`}>
              <Cpu className={`w-5 h-5 ${adapter.status === 'running' ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{adapter.name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusStyle}`}>
                  {adapter.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">
                {adapter.id} · model {adapter.model}
                {adapter.version && ` · v${adapter.version}`}
              </div>
            </div>
          </div>
        </div>

        {adapter.description && (
          <p className="text-sm text-muted-foreground mb-4">{adapter.description}</p>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t border-border">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Runtime</div>
            {adapter.runtime && adapter.runtime !== 'none' ? (
              <div className="flex items-center gap-1.5">
                <RuntimeIcon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="capitalize">{adapter.runtime}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Not detected</span>
            )}
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Last checked</div>
            {adapter.lastProbeAt ? formatRelativeTime(adapter.lastProbeAt) : <span className="text-muted-foreground">Never</span>}
          </div>
        </div>

        {!adapter.available && adapter.probeError && (
          <div className="mt-4 p-3 rounded-md bg-destructive/5 border border-destructive/20 space-y-1">
            <div className="flex items-start gap-1.5 text-sm text-destructive">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="line-clamp-3">{adapter.probeError}</span>
            </div>
            {adapter.installHint && (
              <div className="text-xs text-muted-foreground font-mono pl-5">{adapter.installHint}</div>
            )}
          </div>
        )}
      </section>

      {currentRun && (
        <section className="bg-background border border-blue-500/30 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <h2 className="font-semibold">Running now</h2>
          </div>
          <div className="text-sm">{currentRun.taskTitle ?? 'Untitled task'}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Started {formatRelativeTime(currentRun.startedAt)}
          </div>
        </section>
      )}

      {lastRun && (
        <section className="bg-background border border-border rounded-lg p-6 shadow-sm">
          <h2 className="font-semibold mb-3">Last run</h2>
          <div className="flex items-start gap-2">
            {lastRun.status === 'completed'
              ? <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              : <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{lastRun.taskTitle ?? 'Untitled task'}</div>
              {lastRun.error && (
                <p className="text-xs text-destructive mt-1 whitespace-pre-wrap line-clamp-4">{lastRun.error}</p>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                {lastRun.durationSec}s · ${lastRun.costUsd.toFixed(4)}
                {lastRun.completedAt && ` · ${formatRelativeTime(lastRun.completedAt)}`}
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
};

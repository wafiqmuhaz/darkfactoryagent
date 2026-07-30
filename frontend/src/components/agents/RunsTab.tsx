import { useState } from 'react';
import { ChevronRight, PlayCircle, Terminal } from 'lucide-react';
import { useAgentRunDetail, useAgentRuns } from '../../hooks/useAgents';
import { Spinner } from '../common/Spinner';
import { Badge } from '../common/Badge';
import { EmptyState, StatusBadge } from './primitives';
import { formatDateTime, formatNumber, formatRelativeTime } from '../../utils/helpers';

const duration = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`);

/** Collapsible block for the long verbatim payloads (transcript, result JSON). */
const Disclosure = ({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/60 transition-colors"
      >
        <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="font-medium">{title}</span>
        {count !== undefined && <span className="text-xs text-muted-foreground">({count})</span>}
      </button>
      {open && <div className="border-t border-border p-3">{children}</div>}
    </div>
  );
};

const Pre = ({ children }: { children: string }) => (
  <pre className="text-xs font-mono whitespace-pre-wrap break-words max-h-72 overflow-auto text-muted-foreground">
    {children}
  </pre>
);

const RunDetail = ({ agentId, runId }: { agentId: string; runId: string }) => {
  const { data, isLoading } = useAgentRunDetail(agentId, runId);

  if (isLoading || !data) {
    return <div className="flex justify-center py-10"><Spinner /></div>;
  }

  const { run, events } = data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={run.status} />
        <Badge variant="outline">{run.trigger}</Badge>
        {run.adapter && <span className="text-xs font-mono text-muted-foreground">{run.adapter}</span>}
        {run.model && <span className="text-xs font-mono text-muted-foreground">{run.model}</span>}
      </div>

      {run.error && (
        <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3">
          <p className="text-xs text-destructive whitespace-pre-wrap">{run.error}</p>
          {(run.stopReason || run.exitCode !== null) && (
            <p className="text-xs text-muted-foreground mt-1">
              {run.stopReason && <>stop reason: {run.stopReason}</>}
              {run.stopReason && run.exitCode !== null && ' · '}
              {run.exitCode !== null && <>exit code {run.exitCode}</>}
            </p>
          )}
        </div>
      )}

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Duration</dt>
          <dd className="tabular-nums">{duration(run.duration)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Cost</dt>
          <dd className="tabular-nums">${run.cost.toFixed(4)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Tokens</dt>
          <dd className="tabular-nums">{formatNumber(run.tokensUsed)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Started</dt>
          <dd className="text-xs">{run.startedAt ? formatDateTime(run.startedAt) : '—'}</dd>
        </div>
      </dl>

      {run.project && (
        <p className="text-xs text-muted-foreground">
          Working dir: <span className="font-mono break-all">{run.project.path}</span>
        </p>
      )}

      {run.task && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Tasks touched (1)</h4>
          <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-md">
            <StatusBadge status={run.task.status} />
            <span className="text-sm truncate flex-1">{run.task.title}</span>
            <span className="text-xs font-mono text-muted-foreground">
              {run.task.id.slice(0, 6).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {run.input !== null && (
          <Disclosure title="Invocation">
            <Pre>{JSON.stringify(run.input, null, 2)}</Pre>
          </Disclosure>
        )}

        {run.output && (
          <Disclosure title="Transcript">
            <Pre>{run.output}</Pre>
          </Disclosure>
        )}

        {run.logs && (
          <Disclosure title="Full log">
            <Pre>{run.logs}</Pre>
          </Disclosure>
        )}

        {run.metadata !== null && (
          <Disclosure title="Adapter result JSON">
            <Pre>{JSON.stringify(run.metadata, null, 2)}</Pre>
          </Disclosure>
        )}

        <Disclosure title="Events" count={events.length}>
          {events.length > 0 ? (
            <ul className="space-y-2">
              {events.map((event) => (
                <li key={event.id} className="text-xs">
                  <span className="text-muted-foreground font-mono">[{event.type}]</span>{' '}
                  <span className="whitespace-pre-wrap">{event.message.slice(0, 500)}</span>
                  <span className="text-muted-foreground"> · {formatRelativeTime(event.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No events recorded for this run.</p>
          )}
        </Disclosure>

        {run.artifacts.length > 0 && (
          <Disclosure title="Artifacts" count={run.artifacts.length}>
            <ul className="space-y-1">
              {run.artifacts.map((artifact) => (
                <li key={artifact.id} className="text-xs flex items-center gap-2">
                  <Badge variant="outline">{artifact.type}</Badge>
                  <span className="truncate">{artifact.name}</span>
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
      </div>
    </div>
  );
};

/**
 * Runs tab: the run list on the left, the selected run's full record on the
 * right. Everything shown is read back from AgentRun and its Activity rows.
 */
export const RunsTab = ({
  agentId,
  selectedRunId,
  onSelectRun,
}: {
  agentId: string;
  selectedRunId: string | null;
  onSelectRun: (runId: string | null) => void;
}) => {
  const { data: runs, isLoading } = useAgentRuns(agentId, 20);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  }

  if (!runs || runs.length === 0) {
    return (
      <div className="border border-border rounded-lg bg-background">
        <EmptyState
          icon={<PlayCircle className="w-8 h-8" />}
          title="No runs yet"
          hint="Runs appear here once this agent executes a task."
        />
      </div>
    );
  }

  const active = selectedRunId ?? runs[0]!.id;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr] items-start">
      <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
        {runs.map((run) => (
          <li key={run.id}>
            <button
              type="button"
              onClick={() => onSelectRun(run.id)}
              aria-current={run.id === active}
              className={`w-full text-left px-3 py-2.5 transition-colors ${
                run.id === active ? 'bg-secondary' : 'bg-background hover:bg-secondary/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono">{run.id.slice(0, 8)}</span>
                <StatusBadge status={run.status} />
              </div>
              <div className="text-xs text-muted-foreground mt-1 capitalize">
                {run.trigger} · {formatRelativeTime(run.createdAt)}
              </div>
              {run.error && (
                <p className="text-xs text-destructive mt-1 line-clamp-2">{run.error}</p>
              )}
            </button>
          </li>
        ))}
      </ul>

      <section className="border border-border rounded-lg bg-background p-4">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Run {active.slice(0, 8)}</h3>
        </div>
        <RunDetail agentId={agentId} runId={active} />
      </section>
    </div>
  );
};

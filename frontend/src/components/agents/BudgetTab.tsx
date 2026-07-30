import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useAgentBudget, useAgentSeries, useSaveBudget } from '../../hooks/useAgents';
import { BarChart } from '../charts/BarChart';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';
import { StatTile } from './primitives';
import { Field, NumberInput, Panel, Toggle } from './fields';
import { formatNumber } from '../../utils/helpers';

/** Health → icon + label. Status never rides on colour alone. */
const HEALTH: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  healthy: {
    label: 'Healthy',
    icon: <CheckCircle2 className="w-4 h-4" />,
    className: 'text-green-600 dark:text-green-400',
  },
  at_risk: {
    label: 'At risk',
    icon: <AlertTriangle className="w-4 h-4" />,
    className: 'text-yellow-600 dark:text-yellow-400',
  },
  exceeded: {
    label: 'Over budget',
    icon: <XCircle className="w-4 h-4" />,
    className: 'text-destructive',
  },
};

/**
 * Budget tab. Observed spend is the sum of this agent's CostLedger rows in the
 * current UTC month; the cap is its own Budget row (agentId-scoped).
 */
export const BudgetTab = ({ agentId }: { agentId: string }) => {
  const { data, isLoading } = useAgentBudget(agentId);
  const { data: series } = useAgentSeries(agentId, 14);
  const save = useSaveBudget(agentId);

  const [amount, setAmount] = useState(0);
  const [alert80, setAlert80] = useState(true);
  const [alert100, setAlert100] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (data && !loaded) {
      setAmount(data.budget?.amount ?? 0);
      setAlert80(data.budget?.alert80 ?? true);
      setAlert100(data.budget?.alert100 ?? true);
      setLoaded(true);
    }
  }, [data, loaded]);

  if (isLoading || !data) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  }

  const health = HEALTH[data.health] ?? HEALTH.healthy!;
  const dirty =
    amount !== (data.budget?.amount ?? 0) ||
    alert80 !== (data.budget?.alert80 ?? true) ||
    alert100 !== (data.budget?.alert100 ?? true);

  return (
    <div className="space-y-5 max-w-3xl">
      <section className="bg-background border border-border rounded-lg p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold">{data.period.label}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.agent.name}
              {data.agent.adapter && ` · ${data.agent.adapter}`}
            </p>
          </div>
          <span className={`flex items-center gap-1.5 text-sm ${health.className}`}>
            {health.icon}
            {health.label}
          </span>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mt-4">
          <StatTile
            label="Observed"
            value={`$${data.observedUsd.toFixed(2)}`}
            hint={data.capUsd === null ? 'No cap configured' : `of $${data.capUsd.toFixed(2)}`}
          />
          <StatTile
            label="Budget"
            value={data.capUsd === null ? 'Disabled' : `$${data.capUsd.toFixed(2)}`}
            hint={data.softAlertAt ? `Soft alert at ${data.softAlertAt}%` : 'No soft alert'}
          />
          <StatTile
            label="Remaining"
            value={data.remainingUsd === null ? 'Unlimited' : `$${data.remainingUsd.toFixed(2)}`}
            hint={data.percentage !== null ? `${data.percentage}% used` : undefined}
          />
          <StatTile label="All time" value={`$${data.allTimeUsd.toFixed(2)}`} />
        </div>

        {data.capUsd !== null && data.percentage !== null && (
          <div className="mt-4">
            {/* Meter: fill carries severity, the track is a lighter step of the same ramp. */}
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--viz-ordinal-1)' }}
              role="meter"
              aria-valuenow={data.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Budget used"
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(data.percentage, 100)}%`,
                  backgroundColor:
                    data.health === 'exceeded'
                      ? 'var(--viz-critical)'
                      : data.health === 'at_risk'
                        ? 'var(--viz-warning)'
                        : 'var(--viz-ordinal-3)',
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
              ${data.observedUsd.toFixed(2)} of ${data.capUsd.toFixed(2)} · {data.percentage}%
            </p>
          </div>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <BarChart
          title="Daily spend"
          subtitle="Last 14 days"
          dates={series?.dates ?? []}
          series={[
            { key: 'spend', label: 'Spend', colorVar: '--viz-series-1', values: series?.spendUsd ?? [] },
          ]}
          format={(v) => `$${v.toFixed(4)}`}
        />

        <div className="grid grid-cols-2 gap-4 content-start">
          <StatTile label="Input tokens" value={formatNumber(data.tokens.inputTokens)} />
          <StatTile label="Output tokens" value={formatNumber(data.tokens.outputTokens)} />
          <StatTile label="Cached tokens" value={formatNumber(data.tokens.cachedTokens)} />
          <StatTile label="Total tokens" value={formatNumber(data.tokens.totalTokens)} />
        </div>
      </div>

      <Panel title="Set budget" description="A cap of 0 disables the cap; runs are never blocked by a zero limit.">
        <Field label="Budget (USD)">
          {(id) => <NumberInput id={id} value={amount} min={0} onChange={setAmount} />}
        </Field>

        <div className="space-y-3">
          <Toggle label="Alert at 80%" checked={alert80} onChange={setAlert80} />
          <Toggle
            label="Alert at 100%"
            description="Runs are blocked once an active instance-wide budget is exhausted."
            checked={alert100}
            onChange={setAlert100}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          {dirty && <span className="text-xs text-muted-foreground mr-auto">Unsaved changes</span>}
          <Button
            variant="outline"
            size="sm"
            disabled={!dirty || save.isPending}
            onClick={() => {
              setAmount(data.budget?.amount ?? 0);
              setAlert80(data.budget?.alert80 ?? true);
              setAlert100(data.budget?.alert100 ?? true);
            }}
          >
            Revert
          </Button>
          <Button
            size="sm"
            isLoading={save.isPending}
            disabled={!dirty}
            onClick={() => save.mutate({ amount, alert80, alert100 })}
          >
            Save budget
          </Button>
        </div>
        {save.isError && <p className="text-xs text-destructive">{(save.error as Error).message}</p>}
      </Panel>
    </div>
  );
};

import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Cpu } from 'lucide-react';
import { agentKeys, useAgentDetail } from '../hooks/useAgents';
import { useAgentSocket } from '../hooks/useAgentSocket';
import { DashboardTab } from '../components/agents/DashboardTab';
import { InstructionsTab } from '../components/agents/InstructionsTab';
import { SkillsTab } from '../components/agents/SkillsTab';
import { ConfigurationTab } from '../components/agents/ConfigurationTab';
import { RunsTab } from '../components/agents/RunsTab';
import { BudgetTab } from '../components/agents/BudgetTab';
import { Spinner } from '../components/common/Spinner';
import { Badge } from '../components/common/Badge';
import { StatusBadge } from '../components/agents/primitives';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'instructions', label: 'Instructions' },
  { id: 'skills', label: 'Skills' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'runs', label: 'Runs' },
  { id: 'budget', label: 'Budget' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const isTab = (value: string | null): value is TabId =>
  !!value && TABS.some((t) => t.id === value);

/**
 * Agent detail page. The active tab and the selected run live in the query
 * string, so a link to a specific run's log survives a reload and can be shared.
 */
export const AgentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const tab: TabId = isTab(tabParam) ? tabParam : 'dashboard';
  const selectedRunId = searchParams.get('run');

  const { data, isLoading, isError } = useAgentDetail(id);

  // A run event invalidates everything derived from runs for this agent.
  useAgentSocket(id, {
    onRunUpdated: () => {
      if (!id) return;
      queryClient.invalidateQueries({ queryKey: [...agentKeys.all, id] });
      queryClient.invalidateQueries({ queryKey: agentKeys.roster() });
    },
    onAgentUpdated: () => {
      if (!id) return;
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(id) });
    },
  });

  const setTab = (next: TabId) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    if (next !== 'runs') params.delete('run');
    setSearchParams(params, { replace: true });
  };

  const setRun = (runId: string | null) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'runs');
    if (runId) params.set('run', runId);
    else params.delete('run');
    setSearchParams(params, { replace: true });
  };

  if (!id) return null;

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner size="lg" /></div>;
  }

  if (isError || !data) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <Cpu className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Agent not found.</p>
        <button onClick={() => navigate('/agents')} className="text-primary text-sm hover:underline mt-2">
          Back to agents
        </button>
      </div>
    );
  }

  const { agent, stats } = data;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/agents" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" /> Agents
        </Link>

        <div className="flex items-start justify-between gap-3 mt-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Cpu className={`w-5 h-5 ${stats.runningRuns > 0 ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{agent.name}</h1>
                <StatusBadge status={stats.runningRuns > 0 ? 'running' : agent.isActive ? 'idle' : 'paused'} />
                {agent.trustPreset && <Badge variant="outline">{agent.trustPreset}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {agent.title ?? agent.role ?? agent.type}
                {agent.adapter && ` · ${agent.adapter.name}`}
                {` · ${agent.model}`}
                {agent.manager && ` · reports to ${agent.manager.name}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-border overflow-x-auto">
        <nav className="flex gap-1 min-w-max" aria-label="Agent sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`px-3 py-2 text-sm border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'dashboard' && <DashboardTab agentId={id} />}
      {tab === 'instructions' && <InstructionsTab agentId={id} />}
      {tab === 'skills' && <SkillsTab agentId={id} />}
      {tab === 'configuration' && <ConfigurationTab agentId={id} />}
      {tab === 'runs' && <RunsTab agentId={id} selectedRunId={selectedRunId} onSelectRun={setRun} />}
      {tab === 'budget' && <BudgetTab agentId={id} />}
    </div>
  );
};

import { Cpu } from 'lucide-react';
import { Badge } from '../common/Badge';

interface Agent {
  name: string;
  status: 'idle' | 'running' | 'error' | 'completed';
  task?: string;
}

interface AgentOverviewProps {
  agents: Agent[];
}

const statusBadge: Record<string, 'secondary' | 'success' | 'destructive' | 'warning'> = {
  idle: 'secondary',
  running: 'success',
  error: 'destructive',
  completed: 'warning',
};

export const AgentOverview = ({ agents }: AgentOverviewProps) => {
  if (agents.length === 0) {
    return (
      <div className="bg-background border border-border rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Agent Status</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-8">No agents running.</p>
      </div>
    );
  }

  return (
    <div className="bg-background border border-border rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Agent Status</h3>
        </div>
        <span className="text-xs text-muted-foreground">{agents.filter(a => a.status === 'running').length} active</span>
      </div>
      <div className="space-y-3">
        {agents.map((agent, i) => (
          <div key={i} className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{agent.name}</div>
              {agent.task && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{agent.task}</div>}
            </div>
            <Badge variant={statusBadge[agent.status]}>{agent.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
};

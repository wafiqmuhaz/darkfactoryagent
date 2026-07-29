import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Spinner } from '../components/common/Spinner';
import { Play, Square, Cpu, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { formatRelativeTime } from '../utils/helpers';

interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  currentTask?: string;
  startedAt?: string;
  completedAt?: string;
}

export const AgentStatus = () => {
  const queryClient = useQueryClient();

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await apiClient.get('/agents');
      return res.data as Agent[];
    },
  });

  const startAgent = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/agents/${id}/start`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  const stopAgent = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/agents/${id}/stop`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Cpu className="w-4 h-4 text-green-500 animate-pulse" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const statusBadge: Record<string, 'success' | 'secondary' | 'destructive' | 'warning'> = {
    running: 'success',
    idle: 'secondary',
    completed: 'warning',
    error: 'destructive',
  };

  const defaultAgents: Agent[] = agents?.length ? agents : [
    { id: 'chief-of-staff', name: 'Chief of Staff', type: 'orchestrator', status: 'idle' },
    { id: 'spec-writer', name: 'Spec Writer', type: 'specification', status: 'idle' },
    { id: 'code-writer', name: 'Code Writer', type: 'implementation', status: 'idle' },
    { id: 'test-writer', name: 'Test Writer', type: 'testing', status: 'idle' },
    { id: 'review-agent', name: 'Review Agent', type: 'review', status: 'idle' },
    { id: 'doc-agent', name: 'Doc Agent', type: 'documentation', status: 'idle' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agent Status</h1>
        <p className="text-muted-foreground text-sm mt-1">Monitor and control your AI agents</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {defaultAgents.map((agent) => (
          <div key={agent.id} className="bg-background border border-border rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {statusIcon(agent.status)}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{agent.name}</h3>
                    <Badge variant={statusBadge[agent.status] || 'secondary'}>{agent.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {agent.type}
                    {agent.currentTask && ` — ${agent.currentTask}`}
                  </div>
                  {agent.startedAt && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Started {formatRelativeTime(agent.startedAt)}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {agent.status === 'running' ? (
                  <Button size="sm" variant="destructive" onClick={() => stopAgent.mutate(agent.id)}>
                    <Square className="w-3 h-3" /> Stop
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" onClick={() => startAgent.mutate(agent.id)}>
                    <Play className="w-3 h-3" /> Start
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

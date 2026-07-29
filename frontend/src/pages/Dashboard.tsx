import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { StatsCards } from '../components/Dashboard/StatsCards';
import { ActivityFeed } from '../components/Dashboard/ActivityFeed';
import { AgentOverview } from '../components/Dashboard/AgentOverview';
import { CostTracker } from '../components/Dashboard/CostTracker';
import { Spinner } from '../components/common/Spinner';
import { CheckCircle, ListTodo, Users, GitPullRequest } from 'lucide-react';

export const Dashboard = () => {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const res = await apiClient.get('/metrics');
      return res.data;
    },
  });

  const { data: activities } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const res = await apiClient.get('/tasks?limit=10');
      return res.data;
    },
  });

  if (metricsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const stats = [
    { label: 'Total Tasks', value: metrics?.totalTasks ?? 0, icon: <ListTodo className="w-4 h-4" />, change: '+12% this week', trend: 'up' as const },
    { label: 'Completed', value: metrics?.completedTasks ?? 0, icon: <CheckCircle className="w-4 h-4" />, change: '85% completion rate', trend: 'up' as const },
    { label: 'Active Agents', value: metrics?.activeAgents ?? 0, icon: <Users className="w-4 h-4" />, change: '3 running', trend: 'neutral' as const },
    { label: 'Open PRs', value: metrics?.openPRs ?? 0, icon: <GitPullRequest className="w-4 h-4" />, change: '2 awaiting review', trend: 'neutral' as const },
  ];

  const agents = [
    { name: 'Chief of Staff', status: 'idle' as const },
    { name: 'Code Writer', status: 'running' as const, task: 'Implementing auth middleware' },
    { name: 'Test Writer', status: 'completed' as const },
    { name: 'Review Agent', status: 'idle' as const },
  ];

  const sampleActivities = Array.isArray(activities)
    ? activities.slice(0, 10).map((t: any) => ({
        id: t.id,
        type: (t.status === 'DONE' ? 'task_completed' : 'task_created') as any,
        message: t.title,
        timestamp: t.createdAt,
      }))
    : [];

  const costData = {
    daily: metrics?.dailyCost ?? 2.45,
    weekly: metrics?.weeklyCost ?? 18.30,
    monthly: metrics?.monthlyCost ?? 72.10,
    budget: metrics?.monthlyBudget ?? 200,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your development pipeline</p>
      </div>

      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityFeed activities={sampleActivities} />
        <AgentOverview agents={agents} />
      </div>

      <CostTracker data={costData} />
    </div>
  );
};

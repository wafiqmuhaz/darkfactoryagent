import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { StatsCards } from '../components/Dashboard/StatsCards';
import { ActivityFeed } from '../components/Dashboard/ActivityFeed';
import { AgentOverview } from '../components/Dashboard/AgentOverview';
import { CostTracker } from '../components/Dashboard/CostTracker';
import { Spinner } from '../components/common/Spinner';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ListTodo, Users, GitPullRequest, Columns3, Timer, DollarSign, Activity } from 'lucide-react';

export const Dashboard = () => {
  const navigate = useNavigate();
  const [companyData, setCompanyData] = useState<any>(null);

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const res = await apiClient.get('/metrics');
      return res.data;
    },
  });

  const { data: costData } = useQuery({
    queryKey: ['dashboard-costs'],
    queryFn: async () => {
      const res = await apiClient.get('/costs?period=monthly');
      return res.data;
    },
  });

  const { data: activities } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const res = await apiClient.get('/activities?limit=10');
      return res.data;
    },
  });

  useEffect(() => {
    loadCompany();
  }, []);

  const loadCompany = async () => {
    try {
      const res = await apiClient.get('/company');
      setCompanyData(res.data.company);
    } catch {
      // No company yet
    }
  };

  if (metricsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Quick action cards
  const quickActions = [
    { label: 'Task Board', icon: Columns3, path: '/kanban', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Routines', icon: Timer, path: '/routines', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Costs', icon: DollarSign, path: '/costs', color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Activity', icon: Activity, path: '/activity', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  ];

  const stats = [
    { label: 'Total Tasks', value: metrics?.totalTasks ?? 0, icon: <ListTodo className="w-4 h-4" />, change: '+12% this week', trend: 'up' as const },
    { label: 'Completed', value: metrics?.completedTasks ?? 0, icon: <CheckCircle className="w-4 h-4" />, change: '85% completion rate', trend: 'up' as const },
    { label: 'Active Agents', value: metrics?.activeAgents ?? 0, icon: <Users className="w-4 h-4" />, change: '3 running', trend: 'neutral' as const },
    { label: 'Monthly Spend', value: `$${costData?.totalSpend?.toFixed(2) || '0.00'}`, icon: <DollarSign className="w-4 h-4" />, change: `of $${costData?.budget?.limit?.toFixed(2) || '10.00'}`, trend: costData?.budget?.percentage > 80 ? 'down' as const : 'up' as const },
  ];

  const agents = [
    { name: 'Chief of Staff', status: 'idle' as const },
    { name: 'Code Writer', status: 'running' as const, task: 'Implementing auth middleware' },
    { name: 'Test Writer', status: 'completed' as const },
    { name: 'Review Agent', status: 'idle' as const },
  ];

  const sampleActivities = Array.isArray(activities?.activities)
    ? activities.activities.slice(0, 10).map((t: any) => ({
        id: t.id,
        type: t.type === 'error' ? 'task_failed' as const : 'task_completed' as const,
        message: t.message,
        timestamp: t.createdAt,
      }))
    : [];

  const costSummary = {
    daily: costData?.totalSpend ?? 0,
    weekly: costData?.totalSpend ?? 0,
    monthly: costData?.totalSpend ?? 0,
    budget: costData?.budget?.limit ?? 10,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {companyData ? companyData.name : 'Dashboard'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {companyData?.mission || 'Overview of your development pipeline'}
          </p>
        </div>
      </div>

      {/* Quick actions */}
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
        <ActivityFeed activities={sampleActivities} />
        <AgentOverview agents={agents} />
      </div>

      <CostTracker data={costSummary} />
    </div>
  );
};

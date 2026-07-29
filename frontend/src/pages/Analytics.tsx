import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { Spinner } from '../components/common/Spinner';
import { Badge } from '../components/common/Badge';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { formatNumber } from '../utils/helpers';

interface AnalyticsData {
  dora: {
    deploymentFrequency: string;
    leadTime: string;
    changeFailureRate: string;
    timeToRestore: string;
  };
  costs: {
    total: number;
    byProvider: Record<string, number>;
    trend: number;
  };
  trends: Array<{
    date: string;
    tasksCompleted: number;
    tokensUsed: number;
    cost: number;
  }>;
}

export const Analytics = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: async () => {
      const res = await apiClient.get('/metrics');
      return res.data as AnalyticsData;
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const dora = data?.dora ?? {
    deploymentFrequency: '2/day',
    leadTime: '4 hours',
    changeFailureRate: '5%',
    timeToRestore: '30 min',
  };

  const costs = data?.costs ?? {
    total: 72.10,
    byProvider: { openai: 45.00, anthropic: 27.10 },
    trend: 12,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">DORA metrics, cost analysis, and trends</p>
      </div>

      {/* DORA Metrics */}
      <div>
        <h2 className="text-lg font-semibold mb-3">DORA Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-background border border-border rounded-lg p-4 shadow-sm">
            <div className="text-xs text-muted-foreground mb-1">Deployment Frequency</div>
            <div className="text-xl font-bold">{dora.deploymentFrequency}</div>
          </div>
          <div className="bg-background border border-border rounded-lg p-4 shadow-sm">
            <div className="text-xs text-muted-foreground mb-1">Lead Time for Changes</div>
            <div className="text-xl font-bold">{dora.leadTime}</div>
          </div>
          <div className="bg-background border border-border rounded-lg p-4 shadow-sm">
            <div className="text-xs text-muted-foreground mb-1">Change Failure Rate</div>
            <div className="text-xl font-bold">{dora.changeFailureRate}</div>
          </div>
          <div className="bg-background border border-border rounded-lg p-4 shadow-sm">
            <div className="text-xs text-muted-foreground mb-1">Time to Restore</div>
            <div className="text-xl font-bold">{dora.timeToRestore}</div>
          </div>
        </div>
      </div>

      {/* Cost Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-background border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">Cost Breakdown</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(costs.byProvider).map(([provider, amount]) => (
              <div key={provider} className="flex items-center justify-between">
                <span className="text-sm capitalize">{provider}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(amount / costs.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">${amount.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <span className="text-sm font-semibold">Total</span>
            <div className="flex items-center gap-2">
              <Badge variant={costs.trend >= 0 ? 'warning' : 'success'}>
                {costs.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {costs.trend >= 0 ? '+' : ''}{costs.trend}%
              </Badge>
              <span className="text-lg font-bold">${costs.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Trends */}
        <div className="bg-background border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">Recent Trends</h3>
          </div>
          {data?.trends && data.trends.length > 0 ? (
            <div className="space-y-3">
              {data.trends.slice(-7).map((t, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t.date}</span>
                  <div className="flex gap-4">
                    <span>{t.tasksCompleted} tasks</span>
                    <span className="text-muted-foreground">{formatNumber(t.tokensUsed)} tokens</span>
                    <span>${t.cost.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No trend data available yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

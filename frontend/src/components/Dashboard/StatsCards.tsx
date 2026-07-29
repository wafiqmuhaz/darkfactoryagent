import type { ReactNode } from 'react';

interface Stat {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
}

interface StatsCardsProps {
  stats: Stat[];
}

const trendColors = {
  up: 'text-green-500',
  down: 'text-red-500',
  neutral: 'text-muted-foreground',
};

export const StatsCards = ({ stats }: StatsCardsProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <div key={i} className="bg-background border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">{stat.label}</span>
            {stat.icon && <span className="text-muted-foreground">{stat.icon}</span>}
          </div>
          <div className="text-2xl font-bold">{stat.value}</div>
          {stat.change && (
            <div className={`text-xs mt-1 ${trendColors[stat.trend || 'neutral']}`}>
              {stat.change}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

import { DollarSign } from 'lucide-react';

interface CostData {
  daily: number;
  weekly: number;
  monthly: number;
  budget: number;
}

interface CostTrackerProps {
  data: CostData;
}

export const CostTracker = ({ data }: CostTrackerProps) => {
  const usagePercent = Math.min((data.monthly / data.budget) * 100, 100);

  const getBarColor = (pct: number) => {
    if (pct < 50) return 'bg-green-500';
    if (pct < 75) return 'bg-yellow-500';
    if (pct < 90) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-background border border-border rounded-lg p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold">Cost Tracker</h3>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Today</div>
            <div className="text-lg font-bold">${data.daily.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">This Week</div>
            <div className="text-lg font-bold">${data.weekly.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">This Month</div>
            <div className="text-lg font-bold">${data.monthly.toFixed(2)}</div>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Monthly Budget</span>
            <span>{usagePercent.toFixed(0)}% used</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getBarColor(usagePercent)}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

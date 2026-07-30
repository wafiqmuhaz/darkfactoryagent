import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { DollarSign, TrendingUp, AlertTriangle, Plus, Edit3 } from 'lucide-react';

interface CostSummary {
  period: string;
  totalSpend: number;
  byCategory: Record<string, number>;
  budget: {
    limit: number;
    used: number;
    remaining: number;
    percentage: number;
    name: string;
  } | null;
}

interface Budget {
  id: string;
  name: string;
  amount: number;
  period: string;
  isActive: boolean;
  alert50: boolean;
  alert80: boolean;
  alert100: boolean;
}

export const Costs = () => {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetName, setBudgetName] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('10');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [costRes, budgetRes] = await Promise.all([
        apiClient.get('/costs?period=monthly'),
        apiClient.get('/costs/budgets'),
      ]);
      setSummary(costRes.data);
      setBudgets(budgetRes.data.budgets || []);
    } catch (err) {
      console.error('Failed to load costs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBudget = async () => {
    if (!budgetAmount) return;
    try {
      await apiClient.post('/costs/budgets', {
        name: budgetName || 'Monthly Budget',
        amount: parseFloat(budgetAmount),
        period: 'monthly',
        isActive: true,
      });
      setShowBudgetForm(false);
      setBudgetName('');
      setBudgetAmount('10');
      await loadData();
    } catch (err: any) {
      console.error('Create budget failed:', err);
    }
  };

  const budgetLevel = summary?.budget?.percentage || 0;
  const budgetColor = budgetLevel >= 100 ? 'bg-destructive' : budgetLevel >= 80 ? 'bg-orange-500' : budgetLevel >= 50 ? 'bg-yellow-500' : 'bg-green-500';

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Costs</h1>
        <p className="text-muted-foreground text-sm mt-1">Track inference spend and manage budgets</p>
      </div>

      {/* Budget card */}
      {summary?.budget && (
        <div className="bg-background border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">{summary.budget.name}</h2>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              budgetLevel >= 100 ? 'bg-destructive/10 text-destructive' :
              budgetLevel >= 80 ? 'bg-orange-500/10 text-orange-600' :
              'bg-secondary text-muted-foreground'
            }`}>
              {budgetLevel >= 100 ? 'Limit Reached' : budgetLevel >= 80 ? 'Almost Full' : 'Healthy'}
            </span>
          </div>

          <div className="flex items-end justify-between mb-2">
            <div>
              <span className="text-3xl font-bold">${summary.totalSpend.toFixed(2)}</span>
              <span className="text-muted-foreground text-sm ml-2">/ ${summary.budget.limit.toFixed(2)}</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-muted-foreground">${summary.budget.remaining.toFixed(2)} remaining</div>
            </div>
          </div>

          {/* Budget bar */}
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${budgetColor}`}
              style={{ width: `${Math.min(budgetLevel, 100)}%` }}
            />
          </div>

          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>80%</span>
            <span>100%</span>
          </div>

          {budgetLevel >= 80 && (
            <div className="mt-3 p-3 bg-orange-500/5 border border-orange-500/20 rounded-md flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
              <div className="text-sm text-orange-700 dark:text-orange-300">
                {budgetLevel >= 100
                  ? 'Budget limit reached. Agent execution may be paused.'
                  : `Budget ${budgetLevel >= 80 ? 'alert' : 'warning'}: ${budgetLevel.toFixed(0)}% of limit used.`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cost by category */}
      {summary?.byCategory && (
        <div className="bg-background border border-border rounded-lg p-6">
          <h2 className="font-semibold mb-4">Spend by Category</h2>
          <div className="space-y-3">
            {Object.entries(summary.byCategory).map(([category, amount]) => (
              <div key={category} className="flex items-center justify-between">
                <span className="text-sm capitalize">{category}</span>
                <span className="text-sm font-medium">${(amount as number).toFixed(4)}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-border flex items-center justify-between font-medium">
              <span>Total ({summary.period})</span>
              <span>${summary.totalSpend.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Budget management */}
      <div className="bg-background border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Budgets</h2>
          <Button size="sm" variant="outline" onClick={() => setShowBudgetForm(true)}>
            <Plus className="w-3 h-3 mr-1" /> Add Budget
          </Button>
        </div>

        {showBudgetForm && (
          <div className="mb-4 p-4 bg-secondary/30 rounded-lg space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                type="text"
                value={budgetName}
                onChange={(e) => setBudgetName(e.target.value)}
                placeholder="Monthly Budget"
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Amount (USD)</label>
              <input
                type="number"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                min="1"
                step="1"
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateBudget}>Create</Button>
              <Button size="sm" variant="outline" onClick={() => setShowBudgetForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {budgets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No budgets configured.</p>
        ) : (
          <div className="space-y-2">
            {budgets.map((budget) => (
              <div key={budget.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div>
                  <div className="text-sm font-medium">{budget.name}</div>
                  <div className="text-xs text-muted-foreground">${budget.amount.toFixed(2)} / {budget.period}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  budget.isActive ? 'bg-green-500/10 text-green-600' : 'bg-secondary text-muted-foreground'
                }`}>
                  {budget.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

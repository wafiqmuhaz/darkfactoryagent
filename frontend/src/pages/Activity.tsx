import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Spinner } from '../components/common/Spinner';
import { Activity as ActivityIcon, Filter, RefreshCw, Cpu, CheckCircle, AlertCircle, Clock, Timer, Puzzle, Plug } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  metadata?: string;
  agentId?: string;
  taskId?: string;
  createdAt: string;
}

const typeIcons: Record<string, any> = {
  agent_run: Cpu,
  task_status: CheckCircle,
  system: ActivityIcon,
  routine: Timer,
  skill: Puzzle,
  adapter: Plug,
  error: AlertCircle,
};

const typeColors: Record<string, string> = {
  agent_run: 'text-blue-500',
  task_status: 'text-green-500',
  system: 'text-muted-foreground',
  routine: 'text-purple-500',
  skill: 'text-orange-500',
  adapter: 'text-cyan-500',
  error: 'text-destructive',
};

export const Activity = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [types, setTypes] = useState<string[]>([]);

  useEffect(() => {
    loadTypes();
    loadActivities();
  }, []);

  const loadTypes = async () => {
    try {
      const res = await apiClient.get('/activities/types');
      setTypes(res.data.types || []);
    } catch {
      setTypes(['agent_run', 'task_status', 'system', 'routine', 'skill', 'adapter', 'error']);
    }
  };

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (typeFilter !== 'all') params.type = typeFilter;
      const res = await apiClient.get('/activities', { params });
      setActivities(res.data.activities || []);
    } catch {
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    const Icon = typeIcons[type] || ActivityIcon;
    return <Icon className={`w-4 h-4 ${typeColors[type] || 'text-muted-foreground'}`} />;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activity</h1>
          <p className="text-muted-foreground text-sm mt-1">Event timeline for agents, tasks, and system</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            <Filter className="w-3.5 h-3.5 text-muted-foreground ml-2" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-sm px-2 py-1 rounded-md focus:outline-none"
            >
              <option value="all">All Events</option>
              {types.map(t => (
                <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <button
            onClick={loadActivities}
            className="p-2 rounded-md hover:bg-secondary transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : activities.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No activity events yet</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-0">
            {activities.map((item, i) => (
              <div key={item.id} className="relative pl-10 pb-6">
                {/* Timeline dot */}
                <div className={`absolute left-2.5 top-1 w-3 h-3 rounded-full border-2 border-background ${
                  item.type === 'error' ? 'bg-destructive' : 'bg-secondary'
                }`}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {getTypeIcon(item.type)}
                  </div>
                </div>

                <div className="bg-background border border-border rounded-lg p-3 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium capitalize px-1.5 py-0.5 rounded ${
                          item.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'
                        }`}>
                          {item.type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm">{item.message}</p>
                      {item.metadata && (
                        <pre className="mt-1 text-xs text-muted-foreground overflow-hidden max-h-12">
                          {JSON.stringify(JSON.parse(item.metadata), null, 1)}
                        </pre>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {formatTime(item.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

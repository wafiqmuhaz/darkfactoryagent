import { formatRelativeTime } from '../../utils/helpers';
import { Activity } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'task_created' | 'task_completed' | 'agent_run' | 'review' | 'deploy' | 'error';
  message: string;
  timestamp: string;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
}

const typeIcons: Record<string, string> = {
  task_created: 'bg-blue-500',
  task_completed: 'bg-green-500',
  agent_run: 'bg-purple-500',
  review: 'bg-yellow-500',
  deploy: 'bg-cyan-500',
  error: 'bg-red-500',
};

export const ActivityFeed = ({ activities }: ActivityFeedProps) => {
  if (activities.length === 0) {
    return (
      <div className="bg-background border border-border rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Recent Activity</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-8">No recent activity.</p>
      </div>
    );
  }

  return (
    <div className="bg-background border border-border rounded-lg p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold">Recent Activity</h3>
      </div>
      <div className="space-y-4">
        {activities.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${typeIcons[item.type] || 'bg-secondary'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm">{item.message}</p>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(item.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

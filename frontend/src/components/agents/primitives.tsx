import { Badge } from '../common/Badge';

/** Run/task status → badge variant. Status colour never travels alone: the badge
 *  always carries the status word. */
const STATUS_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'secondary' | 'default'> = {
  completed: 'success',
  done: 'success',
  succeeded: 'success',
  failed: 'destructive',
  error: 'destructive',
  blocked: 'destructive',
  running: 'default',
  in_progress: 'default',
  pending: 'secondary',
  review: 'warning',
  cancelled: 'secondary',
  backlog: 'secondary',
  todo: 'secondary',
  idle: 'secondary',
  paused: 'secondary',
};

export const StatusBadge = ({ status }: { status: string }) => (
  <Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>{status.replace(/_/g, ' ')}</Badge>
);

/** Label + value tile. `hint` carries the supporting line under the number. */
export const StatTile = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) => (
  <div className="bg-background border border-border rounded-lg p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-2xl font-semibold mt-1">{value}</div>
    {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
  </div>
);

/** Empty state used inside tab panels. */
export const EmptyState = ({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) => (
  <div className="text-center text-muted-foreground py-10">
    <div className="mx-auto mb-2 opacity-50 w-fit">{icon}</div>
    <p className="text-sm">{title}</p>
    {hint && <p className="text-xs mt-1">{hint}</p>}
  </div>
);

/** Notice shown above forms whose changes only take effect on the next run. */
export const NextRunNotice = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-muted-foreground bg-secondary/50 border border-border rounded-md px-3 py-2">
    {children}
  </p>
);

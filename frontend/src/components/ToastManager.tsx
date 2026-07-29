import { useEffect } from 'react';
import { useNotificationStore } from '../store';
import type { NotificationState } from '../store';
import { X, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export const ToastManager = () => {
  const notifications = useNotificationStore((state: NotificationState) => state.notifications);
  const markAsRead = useNotificationStore((state: NotificationState) => state.markAsRead);

  // Auto-dismiss unread toasts after 5 seconds
  useEffect(() => {
    const unreadToasts = notifications.filter((n) => !n.read);
    const timers = unreadToasts.map((toast) =>
      setTimeout(() => {
        markAsRead(toast.id);
      }, 5000)
    );

    return () => timers.forEach(clearTimeout);
  }, [notifications, markAsRead]);

  const activeToasts = notifications.filter((n) => !n.read).slice(0, 3); // show max 3

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {activeToasts.map((toast) => {
        let Icon = Info;
        let colorClass = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
        
        switch (toast.type) {
          case 'success':
            Icon = CheckCircle;
            colorClass = 'bg-green-500/10 text-green-500 border-green-500/20';
            break;
          case 'warning':
            Icon = AlertTriangle;
            colorClass = 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            break;
          case 'error':
            Icon = XCircle;
            colorClass = 'bg-red-500/10 text-red-500 border-red-500/20';
            break;
        }

        return (
          <div
            key={toast.id}
            role="alert"
            aria-live="assertive"
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-lg border backdrop-blur-md transition-all animate-in slide-in-from-bottom-5 ${colorClass}`}
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm font-medium">{toast.message}</div>
            <button
              onClick={() => markAsRead(toast.id)}
              className="shrink-0 p-1 rounded-md opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

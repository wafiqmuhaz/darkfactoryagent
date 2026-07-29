import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useProjectStore } from '../store';
import type { ProjectState } from '../store';

export const KanbanBoard = () => {
  const currentProjectId = useProjectStore((state: ProjectState) => state.currentProjectId);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [];
      const res = await apiClient.get(`/tasks?projectId=${currentProjectId}`);
      return res.data;
    },
    enabled: !!currentProjectId,
  });

  if (!currentProjectId) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Please select a project to view tasks.</div>;
  }

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading tasks...</div>;
  }

  const columns = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-4">
      {columns.map((column) => (
        <div key={column} className="flex flex-col w-80 shrink-0 bg-secondary/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-foreground/80">{column}</h3>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
              {tasks.filter((t: any) => t.status === column).length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3">
            {tasks
              .filter((t: any) => t.status === column)
              .map((task: any) => (
                <div key={task.id} className="bg-background border border-border p-3 rounded shadow-sm hover:border-primary/50 cursor-grab transition-colors">
                  <div className="text-sm font-medium mb-1">{task.title}</div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-muted-foreground">{task.priority}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useProjectStore } from '../store';
import type { ProjectState } from '../store';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Spinner } from '../components/common/Spinner';
import { Plus, Play, Trash2, AlertCircle, Loader2, Folder } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  type: string;
  assignedAgent?: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  adapterType?: string;
  adapterModel?: string;
}

/** Board columns, mapped to the status values the backend stores. */
const COLUMNS: { status: string; label: string }[] = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' },
  { status: 'failed', label: 'Needs Recovery' },
];

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  medium: 'bg-secondary text-muted-foreground',
  low: 'bg-secondary text-muted-foreground',
};

export const KanbanBoard = () => {
  const currentProjectId = useProjectStore((state: ProjectState) => state.currentProjectId);
  const setCurrentProject = useProjectStore((state: ProjectState) => state.setCurrentProject);
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [runningTask, setRunningTask] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    type: 'feature',
    autoRun: true,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiClient.get('/projects');
      return res.data as Project[];
    },
  });

  const activeProject = projects.find((p) => p.id === currentProjectId);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [];
      const res = await apiClient.get(`/tasks?projectId=${currentProjectId}`);
      return res.data as Task[];
    },
    enabled: !!currentProjectId,
    // Tasks run asynchronously through the adapter CLI, so keep the board fresh.
    refetchInterval: 5000,
  });

  const createTask = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/tasks', {
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        type: form.type,
        projectId: currentProjectId,
        autoRun: form.autoRun,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', currentProjectId] });
      setIsCreateOpen(false);
      setError(null);
      setForm({ title: '', description: '', priority: 'medium', type: 'feature', autoRun: true });
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to create task'),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiClient.patch(`/tasks/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', currentProjectId] }),
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to move task'),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/tasks/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', currentProjectId] }),
  });

  const runTask = async (id: string) => {
    setRunningTask(id);
    setError(null);
    try {
      const res = await apiClient.post(`/tasks/${id}/run`);
      if (!res.data.success) setError(res.data.error || 'Task execution failed');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Task execution failed');
    } finally {
      setRunningTask(null);
      queryClient.invalidateQueries({ queryKey: ['tasks', currentProjectId] });
    }
  };

  const handleDrop = (status: string) => {
    setDragOverColumn(null);
    if (!draggedTask) return;
    const task = tasks.find((t) => t.id === draggedTask);
    setDraggedTask(null);
    if (task && task.status !== status) {
      updateStatus.mutate({ id: draggedTask, status });
    }
  };

  // No project selected yet — offer a picker instead of a dead end.
  if (!currentProjectId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <Folder className="w-12 h-12 text-muted-foreground opacity-50" />
        <div>
          <h2 className="font-semibold">Select a project</h2>
          <p className="text-sm text-muted-foreground mt-1">Tasks belong to a project. Pick one to open its board.</p>
        </div>
        {projects.length > 0 ? (
          <div className="flex flex-col gap-2 w-full max-w-xs">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setCurrentProject(p.id)}
                className="px-4 py-2 rounded-md border border-border hover:border-primary/50 text-sm text-left transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No projects yet — create one on the Projects page first.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Task Board</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activeProject?.name}
            {activeProject?.adapterType && (
              <> · runs on <span className="font-medium">{activeProject.adapterType}</span>
                {activeProject.adapterModel && activeProject.adapterModel !== 'auto' && ` (${activeProject.adapterModel})`}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={currentProjectId}
            onChange={(e) => setCurrentProject(e.target.value)}
            className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Task
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline shrink-0">dismiss</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center"><Spinner size="lg" /></div>
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((column) => {
            const columnTasks = tasks.filter((t) => t.status === column.status);
            const isDragTarget = dragOverColumn === column.status;

            return (
              <div
                key={column.status}
                onDragOver={(e) => { e.preventDefault(); setDragOverColumn(column.status); }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={() => handleDrop(column.status)}
                className={`flex flex-col w-72 shrink-0 rounded-lg p-3 transition-colors ${
                  isDragTarget ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-secondary/50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-foreground/80">{column.label}</h3>
                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                  {columnTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => setDraggedTask(task.id)}
                      onDragEnd={() => { setDraggedTask(null); setDragOverColumn(null); }}
                      className={`group bg-background border border-border p-3 rounded shadow-sm hover:border-primary/50 cursor-grab active:cursor-grabbing transition-all ${
                        draggedTask === task.id ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="text-sm font-medium mb-1">{task.title}</div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded capitalize ${PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium}`}>
                          {task.priority}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => runTask(task.id)}
                            disabled={runningTask === task.id}
                            title="Run through adapter CLI"
                            className="p-1 rounded hover:bg-secondary text-muted-foreground disabled:opacity-50"
                          >
                            {runningTask === task.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => deleteTask.mutate(task.id)}
                            title="Delete task"
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {task.assignedAgent && (
                        <div className="text-[11px] text-muted-foreground mt-1.5 font-mono">{task.assignedAgent}</div>
                      )}
                    </div>
                  ))}

                  {columnTasks.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-6">Drop tasks here</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create task */}
      <Modal isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); setError(null); }} title="New Task" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Add rate limiting to the login endpoint"
              autoFocus
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              placeholder="What should the agent do? Include acceptance criteria and any constraints."
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="feature">Feature</option>
                <option value="bug">Bug</option>
                <option value="refactor">Refactor</option>
                <option value="test">Test</option>
                <option value="docs">Docs</option>
              </select>
            </div>
          </div>

          <label className="flex items-start gap-2 p-3 rounded-md bg-secondary/30 cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoRun}
              onChange={(e) => setForm((f) => ({ ...f, autoRun: e.target.checked }))}
              className="mt-0.5"
            />
            <span className="text-sm">
              Run immediately
              <span className="block text-xs text-muted-foreground mt-0.5">
                Hands the task to {activeProject?.adapterType || 'the project adapter'} right away, in the project's repo.
                Uncheck to leave it in the backlog.
              </span>
            </span>
          </label>

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => { setIsCreateOpen(false); setError(null); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (!form.title.trim()) { setError('Title is required'); return; }
                createTask.mutate();
              }}
              isLoading={createTask.isPending}
            >
              Create Task
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

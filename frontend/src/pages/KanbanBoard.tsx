import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useProjectStore } from '../store';
import type { ProjectState } from '../store';
import { useProjectSocket } from '../hooks/useProjectSocket';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Spinner } from '../components/common/Spinner';
import {
  Plus, Play, Trash2, AlertCircle, Loader2, Folder,
  ChevronDown, ChevronRight, Wifi, WifiOff,
} from 'lucide-react';

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

interface ActivityEntry {
  id: string;
  type: string;
  message: string;
  metadata?: string | null;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  adapterType?: string;
  adapterModel?: string;
}

/** Board columns mapped to the status strings the backend stores. */
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

const LOG_STYLES: Record<string, string> = {
  task_failed: 'text-destructive',
  error: 'text-destructive',
  task_success: 'text-green-600 dark:text-green-400',
  agent_run: 'text-blue-600 dark:text-blue-400',
};

export const KanbanBoard = () => {
  const currentProjectId = useProjectStore((s: ProjectState) => s.currentProjectId);
  const setCurrentProject = useProjectStore((s: ProjectState) => s.setCurrentProject);
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [runningTask, setRunningTask] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    type: 'feature',
    autoRun: true,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await apiClient.get('/projects')).data as Project[],
  });

  const activeProject = projects.find((p) => p.id === currentProjectId);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [];
      return (await apiClient.get(`/tasks?projectId=${currentProjectId}`)).data as Task[];
    },
    enabled: !!currentProjectId,
  });

  const { data: logsByTask = {} } = useQuery({
    queryKey: ['task-logs', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return {};
      return (await apiClient.get(`/tasks/logs?projectId=${currentProjectId}`))
        .data as Record<string, ActivityEntry[]>;
    },
    enabled: !!currentProjectId,
  });

  // Live updates replace polling: the worker emits on every status change.
  const refreshBoard = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks', currentProjectId] });
    queryClient.invalidateQueries({ queryKey: ['task-logs', currentProjectId] });
  };

  const socketRef = useProjectSocket(currentProjectId, {
    onTaskCreated: refreshBoard,
    onTaskUpdated: refreshBoard,
    onTaskDeleted: refreshBoard,
    onActivityLog: () =>
      queryClient.invalidateQueries({ queryKey: ['task-logs', currentProjectId] }),
  });

  // Reflect connection state so a silent board is distinguishable from a live one.
  const socket = socketRef.current;
  if (socket && socket.connected !== live) setLive(socket.connected);

  const createTask = useMutation({
    mutationFn: async () =>
      (await apiClient.post('/tasks', {
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        type: form.type,
        projectId: currentProjectId,
        autoRun: form.autoRun,
      })).data,
    onSuccess: () => {
      refreshBoard();
      setIsCreateOpen(false);
      setError(null);
      setForm({ title: '', description: '', priority: 'medium', type: 'feature', autoRun: true });
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to create task'),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await apiClient.patch(`/tasks/${id}/status`, { status })).data,
    onSuccess: refreshBoard,
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to move task'),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/tasks/${id}`); },
    onSuccess: refreshBoard,
  });

  const runTask = async (id: string) => {
    setRunningTask(id);
    setError(null);
    try {
      const res = await apiClient.post(`/tasks/${id}/run`);
      // 202 means queued; the worker drives it from here via socket events.
      if (res.data.queued === false && res.data.success === false) {
        setError(res.data.error || 'Task execution failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Task execution failed');
    } finally {
      setRunningTask(null);
      refreshBoard();
    }
  };

  const toggleLogs = (taskId: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleDrop = (status: string) => {
    setDragOverColumn(null);
    if (!draggedTask) return;
    const task = tasks.find((t) => t.id === draggedTask);
    setDraggedTask(null);
    if (task && task.status !== status) updateStatus.mutate({ id: draggedTask, status });
  };

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
          <p className="text-sm text-muted-foreground">No project yet — create one on the Projects page first.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Task Board</h1>
            <span
              className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${
                live ? 'text-green-600 dark:text-green-400 bg-green-500/10' : 'text-muted-foreground bg-secondary'
              }`}
              title={live ? 'Receiving live updates' : 'Not connected — refresh to see changes'}
            >
              {live ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {live ? 'Live' : 'Offline'}
            </span>
          </div>
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
          {projects.length > 1 && (
            <select
              value={currentProjectId}
              onChange={(e) => setCurrentProject(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
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
                className={`flex flex-col w-80 shrink-0 rounded-lg p-3 transition-colors ${
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
                  {columnTasks.map((task) => {
                    const logs = logsByTask[task.id] ?? [];
                    const isExpanded = expandedLogs.has(task.id);
                    const latestFailure = logs.find((l) => l.type === 'task_failed' || l.type === 'error');

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => setDraggedTask(task.id)}
                        onDragEnd={() => { setDraggedTask(null); setDragOverColumn(null); }}
                        className={`group bg-background border border-border p-3 rounded shadow-sm hover:border-primary/50 transition-all ${
                          draggedTask === task.id ? 'opacity-40' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2 cursor-grab active:cursor-grabbing">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{task.title}</div>
                            {task.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{task.description}</p>
                            )}
                          </div>
                          {task.status === 'in_progress' && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0 mt-0.5" />
                          )}
                        </div>

                        {/* Surface the adapter error inline — the reason a task failed
                            matters more than the fact that it did. */}
                        {latestFailure && (
                          <div className="mt-2 p-2 rounded bg-destructive/5 border border-destructive/20 text-xs text-destructive line-clamp-3">
                            {latestFailure.message}
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] px-1.5 py-0.5 rounded capitalize ${PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium}`}>
                              {task.priority}
                            </span>
                            {logs.length > 0 && (
                              <button
                                onClick={() => toggleLogs(task.id)}
                                className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                              >
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                {logs.length} log{logs.length === 1 ? '' : 's'}
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => runTask(task.id)}
                              disabled={runningTask === task.id || task.status === 'in_progress'}
                              title="Queue this task for the adapter CLI"
                              className="p-1 rounded hover:bg-secondary text-muted-foreground disabled:opacity-40"
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

                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-border space-y-1.5">
                            {logs.map((log) => (
                              <div key={log.id} className="text-[11px]">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`font-medium ${LOG_STYLES[log.type] ?? 'text-muted-foreground'}`}>
                                    {log.type.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-muted-foreground shrink-0">
                                    {new Date(log.createdAt).toLocaleTimeString()}
                                  </span>
                                </div>
                                <p className="text-muted-foreground whitespace-pre-wrap break-words line-clamp-4">
                                  {log.message}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {columnTasks.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-6">Drop tasks here</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
              Queue immediately
              <span className="block text-xs text-muted-foreground mt-0.5">
                Pushes the task onto the queue for {activeProject?.adapterType || 'the project adapter'},
                which runs it in the project's repo. Uncheck to leave it in the backlog.
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

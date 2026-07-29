import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  projectId: string;
  assignedTo?: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export function useTasks(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await apiClient.get(`/tasks?projectId=${projectId}`);
      return res.data as Task[];
    },
    enabled: !!projectId,
  });

  const createTask = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      const res = await apiClient.post('/tasks', data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Task>) => {
      const res = await apiClient.put(`/tasks/${id}`, data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiClient.patch(`/tasks/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tasks/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  return {
    tasks: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
  };
}

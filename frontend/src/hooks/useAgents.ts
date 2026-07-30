import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentsApi } from '../api/agents';
import type { AgentConfigInput, AgentIdentityInput } from '../api/agents';

/** Query keys are grouped under one root so a run event can invalidate the lot. */
export const agentKeys = {
  all: ['agents'] as const,
  roster: () => [...agentKeys.all, 'roster'] as const,
  adapterStatus: () => [...agentKeys.all, 'adapter-status'] as const,
  detail: (id: string) => [...agentKeys.all, id, 'detail'] as const,
  companySeries: (days: number) => [...agentKeys.all, 'company-series', days] as const,
  series: (id: string, days: number) => [...agentKeys.all, id, 'series', days] as const,
  tasks: (id: string) => [...agentKeys.all, id, 'tasks'] as const,
  runs: (id: string) => [...agentKeys.all, id, 'runs'] as const,
  runDetail: (id: string, runId: string) => [...agentKeys.all, id, 'run', runId] as const,
  activity: (id: string) => [...agentKeys.all, id, 'activity'] as const,
  instructions: (id: string) => [...agentKeys.all, id, 'instructions'] as const,
  skills: (id: string) => [...agentKeys.all, id, 'skills'] as const,
  config: (id: string) => [...agentKeys.all, id, 'config'] as const,
  revisions: (id: string) => [...agentKeys.all, id, 'revisions'] as const,
  budget: (id: string) => [...agentKeys.all, id, 'budget'] as const,
};

export function useAgentRoster() {
  return useQuery({
    queryKey: agentKeys.roster(),
    queryFn: agentsApi.list,
    refetchInterval: 15000,
  });
}

export function useAdapterStatus() {
  return useQuery({
    queryKey: agentKeys.adapterStatus(),
    queryFn: agentsApi.adapterStatus,
    refetchInterval: 10000,
  });
}

export function useAgentDetail(id: string | undefined) {
  return useQuery({
    queryKey: agentKeys.detail(id ?? ''),
    queryFn: () => agentsApi.detail(id!),
    enabled: !!id,
  });
}

export function useCompanySeries(days = 14) {
  return useQuery({
    queryKey: agentKeys.companySeries(days),
    queryFn: () => agentsApi.companySeries(days),
    refetchInterval: 30000,
  });
}

export function useAgentSeries(id: string | undefined, days = 14) {
  return useQuery({
    queryKey: agentKeys.series(id ?? '', days),
    queryFn: () => agentsApi.series(id!, days),
    enabled: !!id,
  });
}

export function useAgentTasks(id: string | undefined, limit = 5) {
  return useQuery({
    queryKey: agentKeys.tasks(id ?? ''),
    queryFn: () => agentsApi.tasks(id!, limit),
    enabled: !!id,
  });
}

export function useAgentRuns(id: string | undefined, limit = 20) {
  return useQuery({
    queryKey: agentKeys.runs(id ?? ''),
    queryFn: () => agentsApi.runs(id!, limit),
    enabled: !!id,
  });
}

export function useAgentRunDetail(id: string | undefined, runId: string | null) {
  return useQuery({
    queryKey: agentKeys.runDetail(id ?? '', runId ?? ''),
    queryFn: () => agentsApi.runDetail(id!, runId!),
    enabled: !!id && !!runId,
  });
}

export function useAgentActivity(id: string | undefined, limit = 50) {
  return useQuery({
    queryKey: agentKeys.activity(id ?? ''),
    queryFn: () => agentsApi.activity(id!, limit),
    enabled: !!id,
  });
}

export function useAgentInstructions(id: string | undefined) {
  return useQuery({
    queryKey: agentKeys.instructions(id ?? ''),
    queryFn: () => agentsApi.instructions(id!),
    enabled: !!id,
  });
}

export function useSaveInstructions(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instructions: string) => agentsApi.saveInstructions(id, instructions),
    onSuccess: (data) => {
      queryClient.setQueryData(agentKeys.instructions(id), data);
      queryClient.invalidateQueries({ queryKey: agentKeys.revisions(id) });
    },
  });
}

export function useAgentSkills(id: string | undefined) {
  return useQuery({
    queryKey: agentKeys.skills(id ?? ''),
    queryFn: () => agentsApi.skills(id!),
    enabled: !!id,
  });
}

export function useSaveSkills(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skills: string[]) => agentsApi.saveSkills(id, skills),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: agentKeys.skills(id) }),
  });
}

export function useAgentConfig(id: string | undefined) {
  return useQuery({
    queryKey: agentKeys.config(id ?? ''),
    queryFn: () => agentsApi.config(id!),
    enabled: !!id,
  });
}

export function useSaveConfig(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AgentConfigInput) => agentsApi.saveConfig(id, input),
    onSuccess: (data) => {
      queryClient.setQueryData(agentKeys.config(id), data);
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: agentKeys.revisions(id) });
      queryClient.invalidateQueries({ queryKey: agentKeys.roster() });
    },
  });
}

export function useSaveIdentity(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AgentIdentityInput) => agentsApi.saveIdentity(id, input),
    onSuccess: (data) => {
      queryClient.setQueryData(agentKeys.config(id), data);
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: agentKeys.revisions(id) });
      queryClient.invalidateQueries({ queryKey: agentKeys.roster() });
    },
  });
}

export function useAgentRevisions(id: string | undefined) {
  return useQuery({
    queryKey: agentKeys.revisions(id ?? ''),
    queryFn: () => agentsApi.revisions(id!),
    enabled: !!id,
  });
}

export function useAgentBudget(id: string | undefined) {
  return useQuery({
    queryKey: agentKeys.budget(id ?? ''),
    queryFn: () => agentsApi.budget(id!),
    enabled: !!id,
  });
}

export function useSaveBudget(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { amount: number; alert50?: boolean; alert80?: boolean; alert100?: boolean; isActive?: boolean }) =>
      agentsApi.saveBudget(id, input),
    onSuccess: (data) => {
      queryClient.setQueryData(agentKeys.budget(id), data);
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(id) });
    },
  });
}

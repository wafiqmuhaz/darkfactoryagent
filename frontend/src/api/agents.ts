import { apiClient } from './client';

/** The instance-wide adapter shown in the Agents page header and on the Dashboard. */
export interface AdapterStatusPayload {
  adapter: {
    id: string;
    name: string;
    description: string | null;
    model: string;
    status: 'running' | 'available' | 'unavailable';
    available: boolean;
    probeStatus: string;
    probeError: string | null;
    runtime: 'local' | 'docker' | 'none' | null;
    version: string | null;
    lastProbeAt: string | null;
    installHint: string | null;
  };
  currentRun: { id: string; taskTitle: string | null; startedAt: string } | null;
  lastRun: {
    id: string;
    status: string;
    taskTitle: string | null;
    durationSec: number;
    costUsd: number;
    error: string | null;
    completedAt: string | null;
  } | null;
}

export interface AgentRosterEntry {
  id: string;
  name: string;
  type: string;
  role: string | null;
  title: string | null;
  isActive: boolean;
  adapter: { id: string | null; name: string | null; probeStatus: string | null };
  model: string;
  status: 'running' | 'idle' | 'paused';
  runs: { total: number; completed: number; failed: number; running: number };
  successRate: number | null;
  totalSpendUsd: number;
  latestRun: {
    id: string;
    status: string;
    trigger: string;
    error: string | null;
    createdAt: string;
  } | null;
  createdAt: string;
}

export interface AgentRunSummary {
  id: string;
  status: string;
  trigger: string;
  adapter: string | null;
  model: string | null;
  error: string | null;
  stopReason: string | null;
  exitCode: number | null;
  duration: number;
  cost: number;
  tokensUsed: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  task: { id: string; title: string; status: string } | null;
}

export interface AgentDetailPayload {
  agent: {
    id: string;
    name: string;
    type: string;
    role: string | null;
    title: string | null;
    isActive: boolean;
    trustPreset: string | null;
    manager: { id: string; name: string; title: string | null } | null;
    adapter: { id: string; name: string; probeStatus: string | null } | null;
    model: string;
    createdAt: string;
    updatedAt: string;
  };
  latestRun:
    | (AgentRunSummary & { output: string | null; logs: string | null; metadata: string | null })
    | null;
  stats: {
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    runningRuns: number;
    successRate: number | null;
  };
  costs: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    totalTokens: number;
    totalCostUsd: number;
    budgetUsd: number | null;
  };
}

export interface AgentSeriesPayload {
  days: number;
  dates: string[];
  runActivity: number[];
  tasksByPriority: Record<'critical' | 'high' | 'medium' | 'low', number[]>;
  tasksByStatus: Record<'in_progress' | 'review' | 'done' | 'failed', number[]>;
  successRate: (number | null)[];
  spendUsd: number[];
}

export interface AgentTaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  updatedAt: string;
  project: { id: string; name: string } | null;
}

export interface AgentInstructionsPayload {
  instructions: string;
  updatedAt: string;
  files: { name: string; label: string | null; language: string; bytes: number }[];
}

export interface AgentSkillRow {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  version: string;
  source: 'built-in' | 'store';
  enabled: boolean;
}

export interface AgentSkillsPayload {
  selected: string[];
  /** Stored ids that match no known skill (e.g. onboarding's capability words). */
  unresolved: string[];
  installed: AgentSkillRow[];
  available: AgentSkillRow[];
}

export interface AgentConfigPayload {
  identity: {
    name: string;
    title: string | null;
    type: string;
    role: string | null;
    managerId: string | null;
    isActive: boolean;
  };
  trust: {
    preset: string;
    canCreateAgents: boolean;
    canManageSkills: boolean;
    canAssignTasks: boolean;
  };
  config: {
    adapterType: string;
    command: string;
    model: string;
    cheapModel: string | null;
    baseUrl: string | null;
    thinkingEffort: string;
    enableChrome: boolean;
    skipPermissions: boolean;
    maxTurns: number;
    extraArgs: string[];
    envVars: { key: string; secretKey: string | null; hasValue: boolean }[];
    timeoutSec: number;
    interruptGraceSec: number;
    heartbeatEnabled: boolean;
    heartbeatIntervalMin: number;
  };
  /** The stored key's value is never sent to the browser — only whether it exists. */
  apiKey: { isSet: boolean; updatedAt: string | null };
  options: {
    adapters: { id: string; name: string; type: string }[];
    models: string[];
    managers: { id: string; name: string; title: string | null }[];
    trustPresets: string[];
    thinkingEfforts: string[];
  };
  revisionCount: number;
  updatedAt: string;
}

export interface AgentBudgetPayload {
  agent: { id: string; name: string; adapter: string | null };
  period: { label: string; start: string };
  observedUsd: number;
  allTimeUsd: number;
  capUsd: number | null;
  remainingUsd: number | null;
  percentage: number | null;
  health: 'healthy' | 'at_risk' | 'exceeded';
  softAlertAt: number | null;
  budget: {
    id: string;
    name: string;
    amount: number;
    period: string;
    isActive: boolean;
    alert50: boolean;
    alert80: boolean;
    alert100: boolean;
  } | null;
  tokens: { inputTokens: number; outputTokens: number; cachedTokens: number; totalTokens: number };
}

export interface AgentRunDetailPayload {
  run: {
    id: string;
    status: string;
    trigger: string;
    adapter: string | null;
    model: string | null;
    output: string | null;
    logs: string | null;
    error: string | null;
    stopReason: string | null;
    exitCode: number | null;
    duration: number;
    cost: number;
    tokensUsed: number;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    input: unknown;
    metadata: unknown;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    task: { id: string; title: string; status: string; priority: string } | null;
    project: { id: string; name: string; path: string } | null;
    artifacts: { id: string; name: string; type: string; createdAt: string }[];
  };
  events: {
    id: string;
    type: string;
    message: string;
    metadata: unknown;
    createdAt: string;
  }[];
}

export interface AgentActivityRow {
  id: string;
  type: string;
  message: string;
  metadata: unknown;
  taskId: string | null;
  createdAt: string;
}

export interface AgentRevisionRow {
  id: string;
  kind: string;
  summary: string | null;
  snapshot: unknown;
  createdBy: string | null;
  createdAt: string;
}

/** Payload accepted by PUT /agents/:id/config. */
export interface AgentConfigInput {
  adapterType?: string;
  command?: string;
  model?: string;
  cheapModel?: string | null;
  baseUrl?: string | null;
  thinkingEffort?: string;
  enableChrome?: boolean;
  skipPermissions?: boolean;
  maxTurns?: number;
  extraArgs?: string[];
  envVars?: { key: string; secretKey?: string; value?: string }[];
  timeoutSec?: number;
  interruptGraceSec?: number;
  heartbeatEnabled?: boolean;
  heartbeatIntervalMin?: number;
  /** Written to the secret store; never echoed back by the API. */
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface AgentIdentityInput {
  name?: string;
  title?: string | null;
  managerId?: string | null;
  trustPreset?: string;
  canCreateAgents?: boolean;
  canManageSkills?: boolean;
  canAssignTasks?: boolean;
  isActive?: boolean;
}

export const agentsApi = {
  adapterStatus: async () => (await apiClient.get('/agents/status')).data as AdapterStatusPayload,

  list: async () => (await apiClient.get('/agents')).data.agents as AgentRosterEntry[],

  detail: async (id: string) => (await apiClient.get(`/agents/${id}`)).data as AgentDetailPayload,

  series: async (id: string, days = 14) =>
    (await apiClient.get(`/agents/${id}/series`, { params: { days } })).data as AgentSeriesPayload,

  companySeries: async (days = 14) =>
    (await apiClient.get('/agents/series', { params: { days } })).data as AgentSeriesPayload,

  tasks: async (id: string, limit = 5) =>
    (await apiClient.get(`/agents/${id}/tasks`, { params: { limit } })).data.tasks as AgentTaskRow[],

  runs: async (id: string, limit = 20) =>
    (await apiClient.get(`/agents/${id}/runs`, { params: { limit } })).data.runs as AgentRunSummary[],

  runDetail: async (id: string, runId: string) =>
    (await apiClient.get(`/agents/${id}/runs/${runId}`)).data as AgentRunDetailPayload,

  activity: async (id: string, limit = 50) =>
    (await apiClient.get(`/agents/${id}/activity`, { params: { limit } }))
      .data.activities as AgentActivityRow[],

  instructions: async (id: string) =>
    (await apiClient.get(`/agents/${id}/instructions`)).data as AgentInstructionsPayload,

  saveInstructions: async (id: string, instructions: string) =>
    (await apiClient.put(`/agents/${id}/instructions`, { instructions }))
      .data as AgentInstructionsPayload,

  skills: async (id: string) =>
    (await apiClient.get(`/agents/${id}/skills`)).data as AgentSkillsPayload,

  saveSkills: async (id: string, skills: string[]) =>
    (await apiClient.put(`/agents/${id}/skills`, { skills })).data as { selected: string[] },

  config: async (id: string) =>
    (await apiClient.get(`/agents/${id}/config`)).data as AgentConfigPayload,

  saveConfig: async (id: string, input: AgentConfigInput) =>
    (await apiClient.put(`/agents/${id}/config`, input)).data as AgentConfigPayload,

  saveIdentity: async (id: string, input: AgentIdentityInput) =>
    (await apiClient.put(`/agents/${id}/identity`, input)).data as AgentConfigPayload,

  revisions: async (id: string, limit = 20) =>
    (await apiClient.get(`/agents/${id}/revisions`, { params: { limit } }))
      .data.revisions as AgentRevisionRow[],

  budget: async (id: string) =>
    (await apiClient.get(`/agents/${id}/budget`)).data as AgentBudgetPayload,

  saveBudget: async (
    id: string,
    input: { amount: number; alert50?: boolean; alert80?: boolean; alert100?: boolean; isActive?: boolean }
  ) => (await apiClient.put(`/agents/${id}/budget`, input)).data as AgentBudgetPayload,
};

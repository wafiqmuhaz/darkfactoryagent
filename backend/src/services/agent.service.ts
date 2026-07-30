import { PrismaClient } from '@prisma/client';
import { adapterManager } from '../adapters/manager';
import { skillRegistry } from '../skills';
import { config } from '../config';
import { logger } from '../utils/logger';
import { emitAgentRunUpdated, emitAgentUpdated } from '../websocket/socket';

const prisma = new PrismaClient();

// Agent trust/permission values are stored as String in the Prisma schema.
export type TrustPresetType = 'restricted' | 'standard' | 'elevated';

export const TrustPreset = {
  RESTRICTED: 'restricted' as const,
  STANDARD: 'standard' as const,
  ELEVATED: 'elevated' as const,
};

export type ThinkingEffortType = 'auto' | 'low' | 'medium' | 'high';

export const ThinkingEffort = {
  AUTO: 'auto' as const,
  LOW: 'low' as const,
  MEDIUM: 'medium' as const,
  HIGH: 'high' as const,
};

/** AgentRun.trigger — why the run started. */
export type RunTriggerType = 'assignment' | 'automation' | 'manual' | 'routine';

export const RunTrigger = {
  ASSIGNMENT: 'assignment' as const,
  AUTOMATION: 'automation' as const,
  MANUAL: 'manual' as const,
  ROUTINE: 'routine' as const,
};

/**
 * Shape of the JSON blob kept in Agent.config. Every field is optional so an
 * agent written by an older code path still parses; readers fill the gaps from
 * `DEFAULT_AGENT_CONFIG`.
 */
export interface AgentRuntimeConfig {
  /** Adapter id, e.g. "claude-code" | "codex". Mirrors Adapter.name. */
  adapterType?: string;
  /** CLI entry point the adapter process should spawn. */
  command?: string;
  /** Primary model id, or "auto" to let the adapter decide. */
  model?: string;
  /** Model used when a run asks for the cheap profile (routine summaries). */
  cheapModel?: string | null;
  /** Overrides the provider base URL for this agent only. */
  baseUrl?: string | null;
  thinkingEffort?: string;
  enableChrome?: boolean;
  skipPermissions?: boolean;
  maxTurns?: number;
  /** Extra CLI flags, stored split so the UI can round-trip a comma list. */
  extraArgs?: string[];
  /** KEY -> { secretKey } to resolve at run start, or { value } for plain values. */
  envVars?: Record<string, { secretKey?: string; value?: string }>;
  timeoutSec?: number;
  interruptGraceSec?: number;
  heartbeatEnabled?: boolean;
  heartbeatIntervalMin?: number;
}

export const DEFAULT_AGENT_CONFIG: Required<
  Pick<
    AgentRuntimeConfig,
    | 'command'
    | 'model'
    | 'thinkingEffort'
    | 'enableChrome'
    | 'skipPermissions'
    | 'maxTurns'
    | 'timeoutSec'
    | 'interruptGraceSec'
    | 'heartbeatEnabled'
    | 'heartbeatIntervalMin'
  >
> = {
  command: 'claude',
  model: 'auto',
  thinkingEffort: ThinkingEffort.AUTO,
  enableChrome: false,
  skipPermissions: false,
  maxTurns: 1000,
  timeoutSec: 0,
  interruptGraceSec: 15,
  heartbeatEnabled: false,
  heartbeatIntervalMin: 60,
};

/** Secret key that holds an agent's provider API key. Values are never returned. */
export const agentApiKeySecret = (agentId: string) => `AGENT_${agentId}_API_KEY`;


export interface UpdateConfigInput extends AgentRuntimeConfig {
  /** Written to the Secret store, never persisted on the agent itself. */
  apiKey?: string;
  /** Explicitly clears the stored API key. */
  clearApiKey?: boolean;
}

export interface UpdateIdentityInput {
  name?: string;
  title?: string | null;
  managerId?: string | null;
  trustPreset?: string;
  canCreateAgents?: boolean;
  canManageSkills?: boolean;
  canAssignTasks?: boolean;
  isActive?: boolean;
}

export class AgentService {
  /** Parse Agent.config, tolerating the legacy shape and malformed JSON. */
  parseConfig(raw: string | null): AgentRuntimeConfig {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? (parsed as AgentRuntimeConfig) : {};
    } catch {
      logger.warn('Agent config is not valid JSON — treating it as empty');
      return {};
    }
  }

  /** Parse Agent.skills, which holds a JSON array of skill ids. */
  parseSkills(raw: string | null): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
    } catch {
      return [];
    }
  }

  /** The company the user belongs to. Agents are always scoped through it. */
  private async requireMembership(userId: string) {
    const membership = await prisma.companyMember.findFirst({ where: { userId } });
    if (!membership) throw new Error('Company not found');
    return membership;
  }

  /** Load one agent, refusing agents outside the caller's company. */
  private async requireAgent(agentId: string, userId: string) {
    const membership = await this.requireMembership(userId);
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: { adapter: true, manager: { select: { id: true, name: true, title: true } } },
    });
    if (!agent || agent.companyId !== membership.companyId) throw new Error('Agent not found');
    return agent;
  }
  /** Roster for the /agents index: one row per agent with its headline numbers. */
  async listAgents(userId: string) {
    const membership = await this.requireMembership(userId);

    const agents = await prisma.agent.findMany({
      where: { companyId: membership.companyId },
      include: { adapter: { select: { name: true, displayName: true, probeStatus: true } } },
      orderBy: [{ createdAt: 'asc' }],
    });
    if (agents.length === 0) return [];

    const ids = agents.map((a) => a.id);
    const [grouped, latestRuns, spend] = await Promise.all([
      prisma.agentRun.groupBy({
        by: ['agentId', 'status'],
        where: { agentId: { in: ids } },
        _count: { id: true },
      }),
      prisma.agentRun.findMany({
        where: { agentId: { in: ids } },
        orderBy: { createdAt: 'desc' },
        // No per-group limit on SQLite; fetch a window and pick the newest per agent.
        take: ids.length * 5,
        select: { id: true, agentId: true, status: true, trigger: true, error: true, createdAt: true },
      }),
      prisma.costLedger.groupBy({
        by: ['agentId'],
        where: { agentId: { in: ids } },
        _sum: { amount: true },
      }),
    ]);

    const latestByAgent = new Map<string, (typeof latestRuns)[number]>();
    for (const run of latestRuns) {
      if (run.agentId && !latestByAgent.has(run.agentId)) latestByAgent.set(run.agentId, run);
    }
    const spendByAgent = new Map(spend.map((s) => [s.agentId, s._sum.amount ?? 0]));

    return agents.map((agent) => {
      const counts = grouped.filter((g) => g.agentId === agent.id);
      const total = counts.reduce((sum, g) => sum + g._count.id, 0);
      const completed = counts.find((g) => g.status === 'completed')?._count.id ?? 0;
      const failed = counts.find((g) => g.status === 'failed')?._count.id ?? 0;
      const running = counts.find((g) => g.status === 'running')?._count.id ?? 0;
      const config = this.parseConfig(agent.config);
      const latest = latestByAgent.get(agent.id) ?? null;

      return {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        role: agent.role,
        title: agent.title,
        isActive: agent.isActive,
        adapter: agent.adapter
          ? { id: agent.adapter.name, name: agent.adapter.displayName, probeStatus: agent.adapter.probeStatus }
          : { id: config.adapterType ?? config.command ?? null, name: null, probeStatus: null },
        model: config.model ?? 'auto',
        status: running > 0 ? 'running' : agent.isActive ? 'idle' : 'paused',
        runs: { total, completed, failed, running },
        successRate: total > 0 ? Math.round((completed / total) * 100) : null,
        totalSpendUsd: Math.round((spendByAgent.get(agent.id) ?? 0) * 10000) / 10000,
        latestRun: latest,
        createdAt: agent.createdAt,
      };
    });
  }

  /** Everything the Dashboard tab renders, in one round trip. */
  async getAgentDetail(agentId: string, userId: string) {
    const agent = await this.requireAgent(agentId, userId);
    const config = this.parseConfig(agent.config);

    const [runCounts, latestRun, budget, spendAgg, tokenAgg] = await Promise.all([
      prisma.agentRun.groupBy({
        by: ['status'],
        where: { agentId },
        _count: { id: true },
      }),
      prisma.agentRun.findFirst({
        where: { agentId },
        orderBy: { createdAt: 'desc' },
        include: { task: { select: { id: true, title: true, status: true } } },
      }),
      prisma.budget.findFirst({ where: { agentId, isActive: true } }),
      prisma.costLedger.aggregate({ where: { agentId }, _sum: { amount: true } }),
      prisma.agentRun.aggregate({
        where: { agentId },
        _sum: { inputTokens: true, outputTokens: true, cachedTokens: true, tokensUsed: true },
      }),
    ]);

    const countFor = (status: string) => runCounts.find((c) => c.status === status)?._count.id ?? 0;
    const total = runCounts.reduce((sum, c) => sum + c._count.id, 0);
    const completed = countFor('completed');

    return {
      agent: {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        role: agent.role,
        title: agent.title,
        isActive: agent.isActive,
        trustPreset: agent.trustPreset,
        manager: agent.manager,
        adapter: agent.adapter
          ? { id: agent.adapter.name, name: agent.adapter.displayName, probeStatus: agent.adapter.probeStatus }
          : null,
        model: config.model ?? 'auto',
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      },
      latestRun,
      stats: {
        totalRuns: total,
        completedRuns: completed,
        failedRuns: countFor('failed'),
        runningRuns: countFor('running'),
        successRate: total > 0 ? Math.round((completed / total) * 100) : null,
      },
      costs: {
        inputTokens: tokenAgg._sum.inputTokens ?? 0,
        outputTokens: tokenAgg._sum.outputTokens ?? 0,
        cachedTokens: tokenAgg._sum.cachedTokens ?? 0,
        totalTokens: tokenAgg._sum.tokensUsed ?? 0,
        totalCostUsd: Math.round((spendAgg._sum.amount ?? 0) * 10000) / 10000,
        budgetUsd: budget?.amount ?? null,
      },
    };
  }
  /**
   * Task ids this agent is responsible for: anything it has run, plus anything
   * assigned to it directly. `Task.assignedAgent` holds an agent id when a task
   * was assigned from the roster, and an adapter id when the executor claimed
   * it. The adapter id is not unique to one agent, so that match is confined to
   * projects linked to this agent's company — otherwise every company sharing
   * the "claude-code" adapter would see each other's tasks.
   */
  private async taskIdsForAgent(agent: { id: string; companyId: string; config: string | null }) {
    const adapterType = this.parseConfig(agent.config).adapterType;

    const companyProjects = adapterType
      ? await prisma.projectCompany.findMany({
          where: { companyId: agent.companyId },
          select: { projectId: true },
        })
      : [];
    const projectIds = companyProjects.map((p) => p.projectId);

    const [ranTasks, assignedTasks] = await Promise.all([
      prisma.agentRun.findMany({
        where: { agentId: agent.id, taskId: { not: null } },
        select: { taskId: true },
        distinct: ['taskId'],
      }),
      prisma.task.findMany({
        where: {
          OR: [
            { assignedAgent: agent.id },
            ...(adapterType && projectIds.length
              ? [{ assignedAgent: adapterType, projectId: { in: projectIds } }]
              : []),
          ],
        },
        select: { id: true },
      }),
    ]);

    return [
      ...new Set([
        ...ranTasks.map((r) => r.taskId).filter((id): id is string => !!id),
        ...assignedTasks.map((t) => t.id),
      ]),
    ];
  }

  /** Bucket boundaries for the trailing `days`-day window, oldest first. */
  private dayBuckets(days: number) {
    return Array.from({ length: days }, (_, i) => {
      // Stepping with setDate keeps buckets aligned to local midnight across a
      // DST change, which fixed-millisecond arithmetic would drift past.
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      from.setDate(from.getDate() - (days - 1) + i);

      const to = new Date(from);
      to.setDate(to.getDate() + 1);

      // Built from local parts — toISOString() would shift the label by the
      // UTC offset and mislabel every bucket east of Greenwich.
      const date = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(
        from.getDate()
      ).padStart(2, '0')}`;

      return { date, from, to };
    });
  }

  /** Index of the bucket containing `at`, or -1 when it falls outside the window. */
  private bucketIndex(buckets: { from: Date; to: Date }[], at: Date): number {
    const time = at.getTime();
    return buckets.findIndex((b) => time >= b.from.getTime() && time < b.to.getTime());
  }

  /**
   * Daily series behind the Dashboard tab's four charts. Everything is bucketed
   * in JS — SQLite has no date_trunc, and the row counts here are small.
   */
  async getAgentSeries(agentId: string, userId: string, days = 14) {
    const agent = await this.requireAgent(agentId, userId);
    const buckets = this.dayBuckets(days);
    const since = buckets[0]!.from;
    const taskIds = await this.taskIdsForAgent(agent);

    const [runs, tasks, ledger] = await Promise.all([
      prisma.agentRun.findMany({
        where: { agentId, createdAt: { gte: since } },
        select: { status: true, createdAt: true },
      }),
      taskIds.length
        ? prisma.task.findMany({
            where: { id: { in: taskIds }, updatedAt: { gte: since } },
            select: { priority: true, status: true, updatedAt: true },
          })
        : Promise.resolve([]),
      prisma.costLedger.findMany({
        where: { agentId, createdAt: { gte: since } },
        select: { amount: true, createdAt: true },
      }),
    ]);

    const blank = () => buckets.map(() => 0);
    const runActivity = blank();
    const runsCompleted = blank();
    const runsFailed = blank();
    const spend = blank();
    const byPriority: Record<string, number[]> = {
      critical: blank(),
      high: blank(),
      medium: blank(),
      low: blank(),
    };
    const byStatus: Record<string, number[]> = {
      in_progress: blank(),
      review: blank(),
      done: blank(),
      failed: blank(),
    };

    for (const run of runs) {
      const i = this.bucketIndex(buckets, run.createdAt);
      if (i < 0) continue;
      runActivity[i]! += 1;
      if (run.status === 'completed') runsCompleted[i]! += 1;
      if (run.status === 'failed') runsFailed[i]! += 1;
    }

    for (const task of tasks) {
      const i = this.bucketIndex(buckets, task.updatedAt);
      if (i < 0) continue;
      if (byPriority[task.priority]) byPriority[task.priority]![i]! += 1;
      if (byStatus[task.status]) byStatus[task.status]![i]! += 1;
    }

    for (const entry of ledger) {
      const i = this.bucketIndex(buckets, entry.createdAt);
      if (i >= 0) spend[i]! += entry.amount;
    }

    return {
      days,
      dates: buckets.map((b) => b.date),
      runActivity,
      tasksByPriority: byPriority,
      tasksByStatus: byStatus,
      // null on days with no runs, so the chart draws a gap instead of a false 0%.
      successRate: buckets.map((_, i) => {
        const finished = runsCompleted[i]! + runsFailed[i]!;
        return finished > 0 ? Math.round((runsCompleted[i]! / finished) * 100) : null;
      }),
      spendUsd: spend.map((v) => Math.round(v * 10000) / 10000),
    };
  }

  /**
   * Company-wide version of {@link getAgentSeries}: the same four daily series,
   * but aggregated across every agent in the caller's company. Powers the main
   * Dashboard's chart row. Tasks are scoped through the company's projects
   * rather than per-agent assignment, so the status/priority mix reflects the
   * whole workspace.
   */
  async getCompanySeries(userId: string, days = 14) {
    const membership = await this.requireMembership(userId);
    const buckets = this.dayBuckets(days);
    const since = buckets[0]!.from;

    const [agents, companyProjects] = await Promise.all([
      prisma.agent.findMany({
        where: { companyId: membership.companyId },
        select: { id: true },
      }),
      prisma.projectCompany.findMany({
        where: { companyId: membership.companyId },
        select: { projectId: true },
      }),
    ]);
    const agentIds = agents.map((a) => a.id);
    const projectIds = companyProjects.map((p) => p.projectId);

    const [runs, tasks, ledger] = await Promise.all([
      agentIds.length
        ? prisma.agentRun.findMany({
            where: { agentId: { in: agentIds }, createdAt: { gte: since } },
            select: { status: true, createdAt: true },
          })
        : Promise.resolve([]),
      projectIds.length
        ? prisma.task.findMany({
            where: { projectId: { in: projectIds }, updatedAt: { gte: since } },
            select: { priority: true, status: true, updatedAt: true },
          })
        : Promise.resolve([]),
      agentIds.length
        ? prisma.costLedger.findMany({
            where: { agentId: { in: agentIds }, createdAt: { gte: since } },
            select: { amount: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);

    const blank = () => buckets.map(() => 0);
    const runActivity = blank();
    const runsCompleted = blank();
    const runsFailed = blank();
    const spend = blank();
    const byPriority: Record<string, number[]> = {
      critical: blank(),
      high: blank(),
      medium: blank(),
      low: blank(),
    };
    const byStatus: Record<string, number[]> = {
      in_progress: blank(),
      review: blank(),
      done: blank(),
      failed: blank(),
    };

    for (const run of runs) {
      const i = this.bucketIndex(buckets, run.createdAt);
      if (i < 0) continue;
      runActivity[i]! += 1;
      if (run.status === 'completed') runsCompleted[i]! += 1;
      if (run.status === 'failed') runsFailed[i]! += 1;
    }

    for (const task of tasks) {
      const i = this.bucketIndex(buckets, task.updatedAt);
      if (i < 0) continue;
      if (byPriority[task.priority]) byPriority[task.priority]![i]! += 1;
      if (byStatus[task.status]) byStatus[task.status]![i]! += 1;
    }

    for (const entry of ledger) {
      const i = this.bucketIndex(buckets, entry.createdAt);
      if (i >= 0) spend[i]! += entry.amount;
    }

    return {
      days,
      dates: buckets.map((b) => b.date),
      runActivity,
      tasksByPriority: byPriority,
      tasksByStatus: byStatus,
      successRate: buckets.map((_, i) => {
        const finished = runsCompleted[i]! + runsFailed[i]!;
        return finished > 0 ? Math.round((runsCompleted[i]! / finished) * 100) : null;
      }),
      spendUsd: spend.map((v) => Math.round(v * 10000) / 10000),
    };
  }

  /** Recent tasks for the Dashboard tab's "Recent Tasks" list. */
  async getAgentTasks(agentId: string, userId: string, limit = 5) {
    const agent = await this.requireAgent(agentId, userId);
    const taskIds = await this.taskIdsForAgent(agent);
    if (taskIds.length === 0) return [];

    return prisma.task.findMany({
      where: { id: { in: taskIds } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        type: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
      },
    });
  }
  /** Run list for the Runs tab. */
  async getAgentRuns(agentId: string, userId: string, limit = 20) {
    await this.requireAgent(agentId, userId);

    return prisma.agentRun.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        status: true,
        trigger: true,
        adapter: true,
        model: true,
        error: true,
        stopReason: true,
        exitCode: true,
        duration: true,
        cost: true,
        tokensUsed: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        task: { select: { id: true, title: true, status: true } },
      },
    });
  }

  /**
   * One run with everything the Runs tab's detail panel shows: invocation,
   * transcript, the raw adapter result JSON, and the run's activity events.
   */
  async getRunDetail(agentId: string, runId: string, userId: string) {
    await this.requireAgent(agentId, userId);

    const run = await prisma.agentRun.findUnique({
      where: { id: runId },
      include: {
        task: { select: { id: true, title: true, status: true, priority: true } },
        project: { select: { id: true, name: true, path: true } },
        artifacts: { select: { id: true, name: true, type: true, createdAt: true } },
      },
    });
    if (!run || run.agentId !== agentId) throw new Error('Agent run not found');

    // Activity rows carry the run id inside their JSON metadata, so the link has
    // to be made in JS — there is no column to filter on.
    const candidates = await prisma.activity.findMany({
      where: { taskId: run.taskId ?? undefined, createdAt: { gte: run.createdAt } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    const events = candidates
      .filter((a) => (a.metadata ? a.metadata.includes(run.id) : false))
      .map((a) => ({
        id: a.id,
        type: a.type,
        message: a.message,
        metadata: a.metadata ? this.safeParse(a.metadata) : null,
        createdAt: a.createdAt,
      }));

    return {
      run: {
        ...run,
        input: run.input ? this.safeParse(run.input) : null,
        metadata: run.metadata ? this.safeParse(run.metadata) : null,
      },
      events,
    };
  }

  /** JSON.parse that returns the raw string instead of throwing on bad input. */
  private safeParse(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  /** Activity log for an agent, used by the Runs tab's log stream. */
  async getAgentActivity(agentId: string, userId: string, limit = 50) {
    const agent = await this.requireAgent(agentId, userId);
    const taskIds = await this.taskIdsForAgent(agent);

    const activities = await prisma.activity.findMany({
      where: {
        OR: [{ agentId }, ...(taskIds.length ? [{ taskId: { in: taskIds } }] : [])],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return activities.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      metadata: a.metadata ? this.safeParse(a.metadata) : null,
      taskId: a.taskId,
      createdAt: a.createdAt,
    }));
  }
  /** Instructions tab: the markdown prompt plus the files that make it up. */
  async getInstructions(agentId: string, userId: string) {
    const agent = await this.requireAgent(agentId, userId);

    return {
      instructions: agent.instructions ?? '',
      updatedAt: agent.updatedAt,
      /**
       * Instruction "files" are derived views over stored fields, not real files
       * on disk. AGENTS.md is the entry point; the rest are company context.
       */
      files: [
        {
          name: 'AGENTS.md',
          label: 'entry',
          language: 'markdown',
          bytes: Buffer.byteLength(agent.instructions ?? '', 'utf8'),
        },
      ],
    };
  }

  /** Save the Instructions tab and record a revision. */
  async updateInstructions(agentId: string, userId: string, instructions: string) {
    await this.requireAgent(agentId, userId);

    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: { instructions },
    });

    await prisma.agentConfigRevision.create({
      data: {
        agentId,
        kind: 'instructions',
        summary: `instructions updated (${Buffer.byteLength(instructions, 'utf8')} bytes)`,
        snapshot: JSON.stringify({ instructions }),
        createdBy: userId,
      },
    });

    emitAgentUpdated(agentId, { id: agentId, instructionsUpdatedAt: agent.updatedAt });
    logger.info(`Agent ${agentId} instructions updated`);

    // Same shape as the GET so the client can swap it into the cache directly.
    return this.getInstructions(agentId, userId);
  }

  /**
   * Skills tab: the ids stored on the agent, resolved against the built-in
   * registry and the Skills Store, plus everything else that could be installed.
   */
  async getAgentSkills(agentId: string, userId: string) {
    const agent = await this.requireAgent(agentId, userId);
    const selected = this.parseSkills(agent.skills);

    const [registry, store] = await Promise.all([
      Promise.resolve(skillRegistry.listStatus()),
      prisma.skill.findMany({ orderBy: { displayName: 'asc' } }),
    ]);

    const catalog = [
      ...registry.map((s) => ({
        id: s.name,
        name: s.name,
        displayName: s.displayName,
        description: s.description,
        category: s.category,
        version: s.version,
        source: 'built-in' as const,
        enabled: s.enabled,
      })),
      ...store
        .filter((s) => !registry.some((r) => r.name === s.name))
        .map((s) => ({
          id: s.name,
          name: s.name,
          displayName: s.displayName,
          description: s.description ?? '',
          category: s.category,
          version: s.version,
          source: 'store' as const,
          enabled: s.isEnabled && s.isInstalled,
        })),
    ];

    return {
      selected: selected.filter((id) => catalog.some((s) => s.id === id)),
      /**
       * Ids stored on the agent that match no registry or store skill — the
       * onboarding seed writes capability words like "task_planning". Reported
       * so the UI can show them without offering them as a saveable selection.
       */
      unresolved: selected.filter((id) => !catalog.some((s) => s.id === id)),
      installed: catalog.filter((s) => selected.includes(s.id)),
      available: catalog.filter((s) => !selected.includes(s.id)),
    };
  }

  /** Replace the agent's applied skill set. Unknown ids are rejected. */
  async updateAgentSkills(agentId: string, userId: string, skillIds: string[]) {
    await this.requireAgent(agentId, userId);

    const known = new Set([
      ...skillRegistry.listStatus().map((s) => s.name),
      ...(await prisma.skill.findMany({ select: { name: true } })).map((s) => s.name),
    ]);

    const unknown = skillIds.filter((id) => !known.has(id));
    if (unknown.length > 0) throw new Error(`Unknown skill: ${unknown[0]}`);

    const deduped = [...new Set(skillIds)];
    await prisma.agent.update({
      where: { id: agentId },
      data: { skills: JSON.stringify(deduped) },
    });

    emitAgentUpdated(agentId, { id: agentId, skills: deduped });
    return { selected: deduped };
  }
  /**
   * Configuration tab payload. The API key is never returned — only whether one
   * is stored — so the value cannot leak through the API or the browser cache.
   */
  async getConfiguration(agentId: string, userId: string) {
    const agent = await this.requireAgent(agentId, userId);
    const stored = this.parseConfig(agent.config);
    const adapterId = stored.adapterType ?? agent.adapter?.name ?? config.agents.adapterDefault;

    const [adapters, models, secret, revisionCount, siblings] = await Promise.all([
      Promise.resolve(adapterManager.listAdapters()),
      adapterManager.getModels(adapterId).catch(() => [] as string[]),
      prisma.secret.findFirst({
        where: { key: agentApiKeySecret(agentId), scope: 'user' },
        select: { updatedAt: true },
      }),
      prisma.agentConfigRevision.count({ where: { agentId } }),
      prisma.agent.findMany({
        where: { companyId: agent.companyId, id: { not: agentId } },
        select: { id: true, name: true, title: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      identity: {
        name: agent.name,
        title: agent.title,
        type: agent.type,
        role: agent.role,
        managerId: agent.managerId,
        isActive: agent.isActive,
      },
      trust: {
        preset: agent.trustPreset ?? TrustPreset.STANDARD,
        canCreateAgents: agent.canCreateAgents,
        canManageSkills: agent.canManageSkills,
        // CEO/orchestrator agents always hold assignment authority.
        canAssignTasks: agent.canAssignTasks || agent.type === 'chief-of-staff',
      },
      config: {
        adapterType: adapterId,
        command: stored.command ?? DEFAULT_AGENT_CONFIG.command,
        model: stored.model ?? DEFAULT_AGENT_CONFIG.model,
        cheapModel: stored.cheapModel ?? null,
        baseUrl: stored.baseUrl ?? null,
        thinkingEffort: stored.thinkingEffort ?? DEFAULT_AGENT_CONFIG.thinkingEffort,
        enableChrome: stored.enableChrome ?? DEFAULT_AGENT_CONFIG.enableChrome,
        skipPermissions: stored.skipPermissions ?? DEFAULT_AGENT_CONFIG.skipPermissions,
        maxTurns: stored.maxTurns ?? DEFAULT_AGENT_CONFIG.maxTurns,
        extraArgs: stored.extraArgs ?? [],
        // Values stay in the Secret store; only the binding shape is exposed.
        envVars: Object.entries(stored.envVars ?? {}).map(([key, binding]) => ({
          key,
          secretKey: binding.secretKey ?? null,
          hasValue: !!binding.value,
        })),
        timeoutSec: stored.timeoutSec ?? DEFAULT_AGENT_CONFIG.timeoutSec,
        interruptGraceSec: stored.interruptGraceSec ?? DEFAULT_AGENT_CONFIG.interruptGraceSec,
        heartbeatEnabled: stored.heartbeatEnabled ?? DEFAULT_AGENT_CONFIG.heartbeatEnabled,
        heartbeatIntervalMin: stored.heartbeatIntervalMin ?? DEFAULT_AGENT_CONFIG.heartbeatIntervalMin,
      },
      apiKey: { isSet: !!secret, updatedAt: secret?.updatedAt ?? null },
      options: {
        adapters: adapters.map((a) => ({ id: a.id, name: a.name, type: a.type })),
        models,
        managers: siblings,
        trustPresets: [TrustPreset.RESTRICTED, TrustPreset.STANDARD, TrustPreset.ELEVATED],
        thinkingEfforts: [
          ThinkingEffort.AUTO,
          ThinkingEffort.LOW,
          ThinkingEffort.MEDIUM,
          ThinkingEffort.HIGH,
        ],
      },
      revisionCount,
      updatedAt: agent.updatedAt,
    };
  }

  /**
   * Merge the submitted runtime config into Agent.config and record a revision.
   * `apiKey`, when present, goes to the Secret store instead of the agent row.
   */
  async updateConfiguration(agentId: string, userId: string, input: UpdateConfigInput) {
    const agent = await this.requireAgent(agentId, userId);
    const { apiKey, clearApiKey, ...runtime } = input;

    const existing = this.parseConfig(agent.config);
    // Only keys the caller actually sent overwrite what is stored.
    const merged: AgentRuntimeConfig = { ...existing };
    for (const [key, value] of Object.entries(runtime)) {
      if (value !== undefined) (merged as Record<string, unknown>)[key] = value;
    }

    // Keep Agent.adapterId in step with config.adapterType so run-time lookups
    // and the roster's adapter column cannot disagree.
    let adapterId = agent.adapterId;
    if (merged.adapterType && merged.adapterType !== agent.adapter?.name) {
      const adapterRow = await prisma.adapter.findUnique({ where: { name: merged.adapterType } });
      adapterId = adapterRow?.id ?? null;
    }

    const updated = await prisma.agent.update({
      where: { id: agentId },
      data: { config: JSON.stringify(merged), adapterId },
    });

    if (clearApiKey) {
      await prisma.secret
        .delete({ where: { key_scope: { key: agentApiKeySecret(agentId), scope: 'user' } } })
        .catch(() => undefined); // already absent
    } else if (apiKey) {
      const encrypted = Buffer.from(apiKey).toString('base64');
      await prisma.secret.upsert({
        where: { key_scope: { key: agentApiKeySecret(agentId), scope: 'user' } },
        update: { value: encrypted },
        create: { key: agentApiKeySecret(agentId), value: encrypted, scope: 'user' },
      });
    }

    const changed = Object.keys(runtime).filter(
      (k) => (runtime as Record<string, unknown>)[k] !== undefined
    );
    await prisma.agentConfigRevision.create({
      data: {
        agentId,
        kind: 'config',
        summary: changed.length ? `updated ${changed.join(', ')}` : 'config saved',
        // The snapshot never carries the key itself, only that it changed.
        snapshot: JSON.stringify({ ...merged, apiKeyChanged: !!apiKey || !!clearApiKey }),
        createdBy: userId,
      },
    });

    emitAgentUpdated(agentId, { id: agentId, configUpdatedAt: updated.updatedAt });
    logger.info(`Agent ${agentId} configuration saved (${changed.join(', ') || 'no field change'})`);

    return this.getConfiguration(agentId, userId);
  }

  /** Identity, reporting line, trust preset, and the three permission flags. */
  async updateIdentity(agentId: string, userId: string, input: UpdateIdentityInput) {
    const agent = await this.requireAgent(agentId, userId);

    if (input.managerId) {
      if (input.managerId === agentId) throw new Error('Agent cannot report to itself');
      const manager = await prisma.agent.findUnique({ where: { id: input.managerId } });
      if (!manager || manager.companyId !== agent.companyId) throw new Error('Manager not found');
    }

    const updated = await prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.managerId !== undefined && { managerId: input.managerId }),
        ...(input.trustPreset !== undefined && { trustPreset: input.trustPreset }),
        ...(input.canCreateAgents !== undefined && { canCreateAgents: input.canCreateAgents }),
        ...(input.canManageSkills !== undefined && { canManageSkills: input.canManageSkills }),
        ...(input.canAssignTasks !== undefined && { canAssignTasks: input.canAssignTasks }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    await prisma.agentConfigRevision.create({
      data: {
        agentId,
        kind: 'permissions',
        summary: `identity/trust updated (${Object.keys(input).join(', ')})`,
        snapshot: JSON.stringify(input),
        createdBy: userId,
      },
    });

    emitAgentUpdated(agentId, { id: agentId, name: updated.name, isActive: updated.isActive });
    return this.getConfiguration(agentId, userId);
  }

  /** Configuration tab: the revision list under "Configuration Revisions". */
  async getRevisions(agentId: string, userId: string, limit = 20) {
    await this.requireAgent(agentId, userId);

    const revisions = await prisma.agentConfigRevision.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return revisions.map((r) => ({
      id: r.id,
      kind: r.kind,
      summary: r.summary,
      snapshot: this.safeParse(r.snapshot),
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    }));
  }
  /** Start of the current UTC month — the window the Budget tab reports on. */
  private monthStartUtc(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  /**
   * Budget tab: observed month-to-date spend against this agent's cap, with the
   * soft-alert threshold. A missing Budget row means "no cap configured".
   */
  async getBudget(agentId: string, userId: string) {
    const agent = await this.requireAgent(agentId, userId);
    const config = this.parseConfig(agent.config);
    const monthStart = this.monthStartUtc();

    const [budget, monthAgg, allTimeAgg, tokenAgg] = await Promise.all([
      prisma.budget.findFirst({ where: { agentId }, orderBy: { createdAt: 'desc' } }),
      prisma.costLedger.aggregate({
        where: { agentId, createdAt: { gte: monthStart } },
        _sum: { amount: true, inputTokens: true, outputTokens: true, cachedTokens: true },
      }),
      prisma.costLedger.aggregate({ where: { agentId }, _sum: { amount: true } }),
      prisma.agentRun.aggregate({
        where: { agentId, createdAt: { gte: monthStart } },
        _sum: { inputTokens: true, outputTokens: true, cachedTokens: true, tokensUsed: true },
      }),
    ]);

    const observed = monthAgg._sum.amount ?? 0;
    const cap = budget && budget.isActive && budget.amount > 0 ? budget.amount : null;
    const percentage = cap ? Math.round((observed / cap) * 100) : null;

    // "healthy" until the soft alert trips; alerts fire at 80% by default.
    const softAlertAt = budget?.alert80 ? 80 : budget?.alert50 ? 50 : null;
    const health =
      percentage === null
        ? 'healthy'
        : percentage >= 100
          ? 'exceeded'
          : softAlertAt !== null && percentage >= softAlertAt
            ? 'at_risk'
            : 'healthy';

    return {
      agent: { id: agent.id, name: agent.name, adapter: agent.adapter?.displayName ?? config.adapterType ?? null },
      period: { label: 'Monthly UTC budget', start: monthStart },
      observedUsd: Math.round(observed * 10000) / 10000,
      allTimeUsd: Math.round((allTimeAgg._sum.amount ?? 0) * 10000) / 10000,
      capUsd: cap,
      remainingUsd: cap === null ? null : Math.round((cap - observed) * 10000) / 10000,
      percentage,
      health,
      softAlertAt,
      budget: budget
        ? {
            id: budget.id,
            name: budget.name,
            amount: budget.amount,
            period: budget.period,
            isActive: budget.isActive,
            alert50: budget.alert50,
            alert80: budget.alert80,
            alert100: budget.alert100,
          }
        : null,
      tokens: {
        inputTokens: tokenAgg._sum.inputTokens ?? monthAgg._sum.inputTokens ?? 0,
        outputTokens: tokenAgg._sum.outputTokens ?? monthAgg._sum.outputTokens ?? 0,
        cachedTokens: tokenAgg._sum.cachedTokens ?? monthAgg._sum.cachedTokens ?? 0,
        totalTokens: tokenAgg._sum.tokensUsed ?? 0,
      },
    };
  }

  /**
   * Set or clear this agent's cap. `amount: 0` disables the cap rather than
   * blocking every run, which is what a zero limit would otherwise mean.
   */
  async updateBudget(
    agentId: string,
    userId: string,
    input: { amount: number; alert50?: boolean; alert80?: boolean; alert100?: boolean; isActive?: boolean }
  ) {
    await this.requireAgent(agentId, userId);

    const existing = await prisma.budget.findFirst({ where: { agentId }, orderBy: { createdAt: 'desc' } });
    const isActive = input.isActive ?? input.amount > 0;

    if (existing) {
      await prisma.budget.update({
        where: { id: existing.id },
        data: {
          amount: input.amount,
          isActive,
          ...(input.alert50 !== undefined && { alert50: input.alert50 }),
          ...(input.alert80 !== undefined && { alert80: input.alert80 }),
          ...(input.alert100 !== undefined && { alert100: input.alert100 }),
        },
      });
    } else {
      await prisma.budget.create({
        data: {
          agentId,
          name: 'Agent monthly budget',
          amount: input.amount,
          period: 'monthly',
          isActive,
          alert50: input.alert50 ?? false,
          alert80: input.alert80 ?? true,
          alert100: input.alert100 ?? true,
        },
      });
    }

    logger.info(`Agent ${agentId} budget set to $${input.amount.toFixed(2)} (active: ${isActive})`);
    return this.getBudget(agentId, userId);
  }

  /**
   * Called by the executor so a run, its cost, and its token counts are
   * attributed to the agent that produced them. Best-effort: attribution must
   * never fail a run.
   */
  async attributeRun(runId: string, agentId: string | null) {
    if (!agentId) return;
    try {
      await prisma.agentRun.update({ where: { id: runId }, data: { agentId } });
      emitAgentRunUpdated(agentId, { runId });
    } catch (error: any) {
      logger.warn(`Run attribution failed for ${runId}: ${error.message}`);
    }
  }

  /**
   * The agent that should own runs for a project: preferring the company linked
   * to that project, the agent whose config names the project's adapter, else
   * that company's chief of staff. Returns null when no agent matches, which
   * leaves the run unattributed rather than crediting an unrelated company.
   */
  async resolveOwningAgent(adapterId: string, projectId?: string): Promise<string | null> {
    try {
      const link = projectId
        ? await prisma.projectCompany.findFirst({ where: { projectId }, select: { companyId: true } })
        : null;

      const agents = await prisma.agent.findMany({
        where: { isActive: true, ...(link && { companyId: link.companyId }) },
        select: { id: true, type: true, config: true },
        orderBy: { createdAt: 'asc' },
      });
      if (agents.length === 0) return null;

      const byAdapter = agents.find((a) => this.parseConfig(a.config).adapterType === adapterId);
      if (byAdapter) return byAdapter.id;

      return agents.find((a) => a.type === 'chief-of-staff')?.id ?? agents[0]!.id;
    } catch {
      return null;
    }
  }
}

export const agentService = new AgentService();

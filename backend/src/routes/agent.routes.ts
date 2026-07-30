import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { agentService } from '../services/agent.service';
import { adapterManager } from '../adapters/manager';
import { config } from '../config';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

const router = Router();
router.use(authMiddleware);

const instructionsSchema = z.object({
  instructions: z.string().max(200000),
});

const skillsSchema = z.object({
  skills: z.array(z.string().min(1)).max(100),
});

const envVarSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(128)
    // Process env names only — anything else cannot be exported to the adapter.
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Environment variable names must be A-Z, 0-9, underscore'),
  secretKey: z.string().min(1).max(128).optional(),
  value: z.string().max(4096).optional(),
});

const configSchema = z.object({
  adapterType: z.string().min(1).max(64).optional(),
  command: z.string().min(1).max(256).optional(),
  model: z.string().max(128).optional(),
  cheapModel: z.string().max(128).nullable().optional(),
  baseUrl: z.string().url().max(512).nullable().optional(),
  thinkingEffort: z.enum(['auto', 'low', 'medium', 'high']).optional(),
  enableChrome: z.boolean().optional(),
  skipPermissions: z.boolean().optional(),
  maxTurns: z.number().int().min(1).max(10000).optional(),
  extraArgs: z.array(z.string().max(256)).max(50).optional(),
  envVars: z.array(envVarSchema).max(50).optional(),
  timeoutSec: z.number().int().min(0).max(86400).optional(),
  interruptGraceSec: z.number().int().min(0).max(3600).optional(),
  heartbeatEnabled: z.boolean().optional(),
  heartbeatIntervalMin: z.number().int().min(1).max(1440).optional(),
  /** Stored in the Secret table, never on the agent row. */
  apiKey: z.string().min(1).max(512).optional(),
  clearApiKey: z.boolean().optional(),
});

const identitySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  title: z.string().max(120).nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  trustPreset: z.enum(['restricted', 'standard', 'elevated']).optional(),
  canCreateAgents: z.boolean().optional(),
  canManageSkills: z.boolean().optional(),
  canAssignTasks: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const budgetSchema = z.object({
  amount: z.number().min(0).max(1000000),
  alert50: z.boolean().optional(),
  alert80: z.boolean().optional(),
  alert100: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/** Clamp a `?limit=` query value into a sane range. */
function limitOf(raw: unknown, fallback: number, max: number): number {
  const parsed = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

// GET /api/agents/status — the single active adapter, for the Dashboard and the
// Agents page header. This is instance-level state, not per-agent.
router.get('/status', async (_req: AuthRequest, res, next) => {
  try {
    // The project's adapter wins; otherwise fall back to the instance default.
    const project = await prisma.project.findFirst({ orderBy: { updatedAt: 'desc' } });
    const activeId = project?.adapterType || config.agents.adapterDefault;

    const descriptor = adapterManager.listAdapters().find((a) => a.id === activeId);
    const stored = await prisma.adapter.findUnique({ where: { name: activeId } });

    const runningRun = await prisma.agentRun.findFirst({
      where: { status: 'running' },
      orderBy: { startedAt: 'desc' },
      include: { task: { select: { title: true } } },
    });

    const lastRun = await prisma.agentRun.findFirst({
      where: { status: { in: ['completed', 'failed'] } },
      orderBy: { completedAt: 'desc' },
      include: { task: { select: { title: true } } },
    });

    // "available" reflects the last probe; a running job takes display priority.
    const available = stored?.probeStatus === 'ready';
    const status = runningRun ? 'running' : available ? 'available' : 'unavailable';

    res.status(200).json({
      adapter: {
        id: activeId,
        name: descriptor?.name ?? activeId,
        description: descriptor?.description ?? null,
        model: project?.adapterModel ?? 'auto',
        status,
        available,
        probeStatus: stored?.probeStatus ?? 'not_tested',
        probeError: stored?.probeError ?? null,
        runtime: stored?.runtime ?? null,
        version: stored?.version ?? null,
        lastProbeAt: stored?.lastProbeAt ?? null,
        installHint: descriptor?.installHint ?? null,
      },
      currentRun: runningRun
        ? {
            id: runningRun.id,
            taskTitle: runningRun.task?.title ?? null,
            startedAt: runningRun.startedAt,
          }
        : null,
      lastRun: lastRun
        ? {
            id: lastRun.id,
            status: lastRun.status,
            taskTitle: lastRun.task?.title ?? null,
            durationSec: lastRun.duration,
            costUsd: lastRun.cost,
            error: lastRun.error,
            completedAt: lastRun.completedAt,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/agents — roster of the caller's company agents
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const agents = await agentService.listAgents(req.userId!);
    res.status(200).json({ agents });
  } catch (error) {
    next(error);
  }
});

// GET /api/agents/:id — Dashboard tab header, latest run, stats, cost totals
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const detail = await agentService.getAgentDetail(req.params.id as string, req.userId!);
    res.status(200).json(detail);
  } catch (error) {
    next(error);
  }
});

// GET /api/agents/:id/series — daily series behind the Dashboard tab charts
router.get('/:id/series', async (req: AuthRequest, res, next) => {
  try {
    const days = limitOf(req.query.days, 14, 90);
    const series = await agentService.getAgentSeries(req.params.id as string, req.userId!, days);
    res.status(200).json(series);
  } catch (error) {
    next(error);
  }
});

// GET /api/agents/:id/tasks — recent tasks this agent ran or owns
router.get('/:id/tasks', async (req: AuthRequest, res, next) => {
  try {
    const limit = limitOf(req.query.limit, 5, 50);
    const tasks = await agentService.getAgentTasks(req.params.id as string, req.userId!, limit);
    res.status(200).json({ tasks });
  } catch (error) {
    next(error);
  }
});

// GET /api/agents/:id/runs — Runs tab list
router.get('/:id/runs', async (req: AuthRequest, res, next) => {
  try {
    const limit = limitOf(req.query.limit, 20, 100);
    const runs = await agentService.getAgentRuns(req.params.id as string, req.userId!, limit);
    res.status(200).json({ runs });
  } catch (error) {
    next(error);
  }
});

// GET /api/agents/:id/runs/:runId — Runs tab detail panel
router.get('/:id/runs/:runId', async (req: AuthRequest, res, next) => {
  try {
    const detail = await agentService.getRunDetail(
      req.params.id as string,
      req.params.runId as string,
      req.userId!
    );
    res.status(200).json(detail);
  } catch (error) {
    next(error);
  }
});

// GET /api/agents/:id/activity — activity log stream for this agent
router.get('/:id/activity', async (req: AuthRequest, res, next) => {
  try {
    const limit = limitOf(req.query.limit, 50, 200);
    const activities = await agentService.getAgentActivity(req.params.id as string, req.userId!, limit);
    res.status(200).json({ activities });
  } catch (error) {
    next(error);
  }
});

// GET /api/agents/:id/instructions — Instructions tab
router.get('/:id/instructions', async (req: AuthRequest, res, next) => {
  try {
    const payload = await agentService.getInstructions(req.params.id as string, req.userId!);
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
});

// PUT /api/agents/:id/instructions — save the prompt for the next run
router.put('/:id/instructions', async (req: AuthRequest, res, next) => {
  try {
    const input = instructionsSchema.parse(req.body);
    const payload = await agentService.updateInstructions(
      req.params.id as string,
      req.userId!,
      input.instructions
    );
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
});

// GET /api/agents/:id/skills — Skills tab: installed + available
router.get('/:id/skills', async (req: AuthRequest, res, next) => {
  try {
    const payload = await agentService.getAgentSkills(req.params.id as string, req.userId!);
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
});

// PUT /api/agents/:id/skills — replace the applied skill set
router.put('/:id/skills', async (req: AuthRequest, res, next) => {
  try {
    const input = skillsSchema.parse(req.body);
    const payload = await agentService.updateAgentSkills(
      req.params.id as string,
      req.userId!,
      input.skills
    );
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
});

// GET /api/agents/:id/config — Configuration tab (API key value never returned)
router.get('/:id/config', async (req: AuthRequest, res, next) => {
  try {
    const payload = await agentService.getConfiguration(req.params.id as string, req.userId!);
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
});

// PUT /api/agents/:id/config — adapter, models, base URL, API key, run policy
router.put('/:id/config', async (req: AuthRequest, res, next) => {
  try {
    const { envVars, ...rest } = configSchema.parse(req.body);

    const payload = await agentService.updateConfiguration(req.params.id as string, req.userId!, {
      ...rest,
      // The wire format is a list so the UI can keep row order; storage is a map.
      ...(envVars && {
        envVars: Object.fromEntries(
          envVars.map((v) => [v.key, { secretKey: v.secretKey, value: v.value }])
        ),
      }),
    });
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
});

// PUT /api/agents/:id/identity — name, title, reporting line, trust, permissions
router.put('/:id/identity', async (req: AuthRequest, res, next) => {
  try {
    const input = identitySchema.parse(req.body);
    const payload = await agentService.updateIdentity(req.params.id as string, req.userId!, input);
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
});

// GET /api/agents/:id/revisions — Configuration Revisions list
router.get('/:id/revisions', async (req: AuthRequest, res, next) => {
  try {
    const limit = limitOf(req.query.limit, 20, 100);
    const revisions = await agentService.getRevisions(req.params.id as string, req.userId!, limit);
    res.status(200).json({ revisions });
  } catch (error) {
    next(error);
  }
});

// GET /api/agents/:id/budget — Budget tab
router.get('/:id/budget', async (req: AuthRequest, res, next) => {
  try {
    const payload = await agentService.getBudget(req.params.id as string, req.userId!);
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
});

// PUT /api/agents/:id/budget — set or clear this agent's monthly cap
router.put('/:id/budget', async (req: AuthRequest, res, next) => {
  try {
    const input = budgetSchema.parse(req.body);
    const payload = await agentService.updateBudget(req.params.id as string, req.userId!, input);
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
});

export const agentRoutes = router;

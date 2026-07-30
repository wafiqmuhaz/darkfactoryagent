import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
export const routinesRoutes = Router();

// GET /api/routines — List all routines
routinesRoutes.get('/', authenticate, async (req, res) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const where: any = {};
    if (projectId) where.projectId = projectId;

    const routines = await prisma.routine.findMany({
      where,
      include: { _count: { select: { runs: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ routines, total: routines.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/routines — Create a routine
routinesRoutes.post('/', authenticate, async (req, res) => {
  try {
    const { name, description, schedule, timezone, projectId, agentId, skillId, taskTemplate, isActive } = req.body;
    if (!name || !schedule || !projectId) {
      return res.status(400).json({ error: 'name, schedule, and projectId are required' });
    }

    // Calculate next run
    const nextRunAt = calculateNextRun(schedule, timezone || 'UTC');

    const routine = await prisma.routine.create({
      data: {
        name,
        description,
        schedule,
        timezone: timezone || 'UTC',
        projectId,
        agentId,
        skillId,
        taskTemplate: taskTemplate ? JSON.stringify(taskTemplate) : null,
        isActive: isActive ?? true,
        nextRunAt,
      },
    });

    logger.info(`Routine created: ${name} (${schedule})`);
    res.status(201).json({ routine });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/routines/:id — Get routine details
routinesRoutes.get('/:id', authenticate, async (req, res) => {
  try {
    const id = req.params.id as string;
    const routine = await prisma.routine.findUnique({
      where: { id },
      include: {
        runs: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!routine) return res.status(404).json({ error: 'Routine not found' });
    res.json({ routine });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/routines/:id — Update a routine
routinesRoutes.put('/:id', authenticate, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { name, description, schedule, timezone, isActive, taskTemplate } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (schedule !== undefined) {
      updateData.schedule = schedule;
      updateData.nextRunAt = calculateNextRun(schedule, timezone || 'UTC');
    }
    if (timezone !== undefined) updateData.timezone = timezone;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (taskTemplate !== undefined) updateData.taskTemplate = JSON.stringify(taskTemplate);

    const routine = await prisma.routine.update({ where: { id }, data: updateData });
    res.json({ routine });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/routines/:id — Delete a routine
routinesRoutes.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = req.params.id as string;
    await prisma.routine.delete({ where: { id } });
    logger.info(`Routine deleted: ${id}`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/routines/:id/trigger — Trigger a routine manually
routinesRoutes.post('/:id/trigger', authenticate, async (req, res) => {
  try {
    const id = req.params.id as string;
    const routine = await prisma.routine.findUnique({ where: { id } });
    if (!routine) return res.status(404).json({ error: 'Routine not found' });

    // Check for an already running instance
    const activeRun = await prisma.routineRun.findFirst({
      where: { routineId: id, status: 'running' },
    });
    if (activeRun) {
      return res.status(409).json({ error: 'Routine is already running', activeRun });
    }

    // Start the run
    const run = await prisma.routineRun.create({
      data: {
        routineId: id,
        status: 'running',
        startedAt: new Date(),
      },
    });

    // Schedule asynchronously — in production this would go to BullMQ
    setTimeout(async () => {
      try {
        // Execute the routine: create a task from template
        if (routine.taskTemplate) {
          const template = JSON.parse(routine.taskTemplate);
          const project = await prisma.project.findUnique({ where: { id: routine.projectId } });
          if (project) {
            await prisma.task.create({
              data: {
                title: (template.title || 'Routine Task').replace('{{date}}', new Date().toISOString().split('T')[0]),
                description: template.description || 'Auto-generated from routine',
                priority: template.priority || 'medium',
                status: 'backlog',
                projectId: routine.projectId,
              },
            });
          }
        }

        await prisma.routineRun.update({
          where: { id: run.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            duration: Math.floor((Date.now() - run.startedAt!.getTime()) / 1000),
          },
        });

        await prisma.routine.update({
          where: { id },
          data: {
            lastRunAt: new Date(),
            runCount: { increment: 1 },
          },
        });
      } catch (error: any) {
        await prisma.routineRun.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            error: error.message,
            completedAt: new Date(),
          },
        });
      }
    }, 100);

    res.json({ success: true, run });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/routines/:id/toggle — Toggle active/inactive
routinesRoutes.post('/:id/toggle', authenticate, async (req, res) => {
  try {
    const id = req.params.id as string;
    const routine = await prisma.routine.findUnique({ where: { id } });
    if (!routine) return res.status(404).json({ error: 'Routine not found' });

    const updated = await prisma.routine.update({
      where: { id },
      data: { isActive: !routine.isActive },
    });

    res.json({ success: true, isActive: updated.isActive });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/routines/:id/runs — Get run history
routinesRoutes.get('/:id/runs', authenticate, async (req, res) => {
  try {
    const id = req.params.id as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [runs, total] = await Promise.all([
      prisma.routineRun.findMany({
        where: { routineId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.routineRun.count({ where: { routineId: id } }),
    ]);

    res.json({ runs, total, page, limit });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function calculateNextRun(cronExpression: string, timezone: string): Date | null {
  // Simple calculation: return ~24h from now for daily crons
  try {
    // For "0 21 * * *" (daily at 9PM), return next occurrence
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) return null;

    const minute = parseInt(parts[0]);
    const hour = parseInt(parts[1]);

    const now = new Date();
    const next = new Date(now);
    next.setHours(hour || 0, minute || 0, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  } catch {
    return null;
  }
}

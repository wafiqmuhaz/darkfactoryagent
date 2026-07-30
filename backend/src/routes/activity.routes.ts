import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const prisma = new PrismaClient();
export const activityRoutes = Router();

// GET /api/activities — Get activity timeline
activityRoutes.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const type = req.query.type as string | undefined;
    const since = req.query.since as string | undefined;
    const projectId = req.query.projectId as string | undefined;

    const where: any = {};
    if (type) where.type = type;
    if (projectId) where.projectId = projectId;
    if (since) {
      where.createdAt = { gte: new Date(since) };
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.activity.count({ where }),
    ]);

    res.json({ activities, total, page, limit });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/activities/types — Get distinct activity types
activityRoutes.get('/types', authenticate, async (_req, res) => {
  try {
    const types = await prisma.activity.findMany({
      select: { type: true },
      distinct: ['type'],
      orderBy: { type: 'asc' },
    });
    res.json({ types: types.map(t => t.type) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/activities — Create an activity event (internal use)
activityRoutes.post('/', authenticate, async (req, res) => {
  try {
    const { type, message, metadata, agentId, taskId, projectId } = req.body;
    if (!type || !message) {
      return res.status(400).json({ error: 'type and message are required' });
    }

    const activity = await prisma.activity.create({
      data: {
        type,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
        agentId,
        taskId,
        projectId,
      },
    });

    res.status(201).json({ activity });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/activities — Clear activity log (admin)
activityRoutes.delete('/', authenticate, async (req, res) => {
  try {
    const olderThan = req.query.olderThan as string | undefined;
    if (olderThan) {
      await prisma.activity.deleteMany({
        where: { createdAt: { lt: new Date(olderThan) } },
      });
    } else {
      // Keep last 1000 entries, delete older
      const total = await prisma.activity.count();
      if (total > 1000) {
        const toDelete = total - 1000;
        const oldestKeep = await prisma.activity.findFirst({
          orderBy: { createdAt: 'desc' },
          skip: 999,
          take: 1,
        });
        if (oldestKeep) {
          await prisma.activity.deleteMany({
            where: { createdAt: { lt: oldestKeep.createdAt } },
          });
        }
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

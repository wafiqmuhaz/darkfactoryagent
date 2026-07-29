import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const prisma = new PrismaClient();
export const pluginRoutes = Router();

// GET /api/plugins — List marketplace plugins
pluginRoutes.get('/', authenticate, async (req, res) => {
  const { category, search, published } = req.query as Record<string, string>;
  const plugins = await prisma.plugin.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(published !== undefined ? { isPublished: published === 'true' } : {}),
      ...(search ? {
        OR: [
          { displayName: { contains: search } },
          { description: { contains: search } },
          { tags: { contains: search } },
        ]
      } : {}),
    },
    orderBy: [{ downloads: 'desc' }, { rating: 'desc' }],
  });
  res.json({ plugins, total: plugins.length });
});

// GET /api/plugins/:id — Get plugin detail
pluginRoutes.get('/:id', authenticate, async (req, res) => {
  const id = req.params.id as string;
  const plugin = await prisma.plugin.findUnique({ where: { id } });
  if (!plugin) return res.status(404).json({ error: 'Plugin not found' });
  return res.json({ plugin });
});

// POST /api/plugins — Publish a new plugin
pluginRoutes.post('/', authenticate, async (req, res) => {
  const { name, displayName, description, category, entrypoint, version, tags, configSchema } = req.body;
  if (!name || !displayName || !category || !entrypoint) {
    return res.status(400).json({ error: 'name, displayName, category, entrypoint are required' });
  }
  try {
    const plugin = await prisma.plugin.create({
      data: {
        name, displayName, description, category, entrypoint,
        version: version ?? '1.0.0',
        tags, configSchema,
        author: (req as any).user?.username ?? 'system',
        isPublished: false,
      },
    });
    return res.status(201).json({ plugin });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// POST /api/plugins/:id/publish — Publish plugin to marketplace
pluginRoutes.post('/:id/publish', authenticate, async (req, res) => {
  const id = req.params.id as string;
  const plugin = await prisma.plugin.update({
    where: { id },
    data: { isPublished: true },
  });
  res.json({ success: true, plugin });
});

// POST /api/plugins/:id/install — Install plugin (associate with team)
pluginRoutes.post('/:id/install', authenticate, async (req, res) => {
  const id = req.params.id as string;
  const { teamId, config } = req.body;
  const install = await prisma.pluginInstall.create({
    data: { pluginId: id, teamId, config: config ? JSON.stringify(config) : null },
  });
  // Increment download count
  await prisma.plugin.update({
    where: { id },
    data: { downloads: { increment: 1 } },
  });
  res.status(201).json({ install });
});

// POST /api/plugins/:id/rate — Rate a plugin
pluginRoutes.post('/:id/rate', authenticate, async (req, res) => {
  const id = req.params.id as string;
  const { rating } = req.body;
  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be 1–5' });
  }
  const plugin = await prisma.plugin.findUnique({ where: { id } });
  if (!plugin) return res.status(404).json({ error: 'Plugin not found' });
  const newCount = plugin.ratingCount + 1;
  const newRating = (plugin.rating * plugin.ratingCount + rating) / newCount;
  const updated = await prisma.plugin.update({
    where: { id },
    data: { rating: newRating, ratingCount: newCount },
  });
  return res.json({ success: true, newRating: updated.rating });
});

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { adapterManager } from '../adapters/manager';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
export const adapterRoutes = Router();

// GET /api/adapters — catalog plus the last probe result for each adapter
adapterRoutes.get('/', authenticate, async (_req, res) => {
  try {
    const catalog = adapterManager.listAdapters();
    const stored = await prisma.adapter.findMany();
    const byName = new Map(stored.map((a) => [a.name, a]));

    const adapters = await Promise.all(
      catalog.map(async (entry) => {
        const db = byName.get(entry.id);
        return {
          ...entry,
          probeStatus: db?.probeStatus ?? 'not_tested',
          probeError: db?.probeError ?? null,
          lastProbeAt: db?.lastProbeAt ?? null,
          isConnected: db?.isConnected ?? false,
          version: db?.version ?? null,
          runtime: db?.runtime ?? null,
          models: db?.models ? JSON.parse(db.models) : await adapterManager.getModels(entry.id),
        };
      })
    );

    res.json({ adapters });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/adapters/:id/models — model choices for the picker
adapterRoutes.get('/:id/models', authenticate, async (req, res) => {
  try {
    const models = await adapterManager.getModels(req.params.id as string);
    res.json({ models });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/adapters/probe — live environment check ("Test now")
adapterRoutes.post('/probe', authenticate, async (req, res) => {
  const { adapterId } = req.body;
  if (!adapterId) return res.status(400).json({ error: 'adapterId is required' });

  try {
    logger.info(`Probing adapter: ${adapterId}`);
    const result = await adapterManager.probeAdapter(adapterId);
    const descriptor = adapterManager.listAdapters().find((a) => a.id === adapterId);

    await prisma.adapter.upsert({
      where: { name: adapterId },
      update: {
        probeStatus: result.status,
        probeError: result.error ?? null,
        lastProbeAt: new Date(),
        isConnected: result.status === 'ready',
        version: result.version,
        runtime: result.runtime,
        models: result.models ? JSON.stringify(result.models) : undefined,
      },
      create: {
        name: adapterId,
        displayName: descriptor?.name ?? adapterId,
        description: descriptor?.description ?? null,
        type: descriptor?.type ?? 'cli',
        probeStatus: result.status,
        probeError: result.error ?? null,
        lastProbeAt: new Date(),
        isConnected: result.status === 'ready',
        version: result.version,
        runtime: result.runtime,
        models: result.models ? JSON.stringify(result.models) : null,
      },
    });

    await prisma.activity.create({
      data: {
        type: 'adapter',
        message:
          result.status === 'ready'
            ? `Adapter probe passed: ${result.message}`
            : `Adapter probe failed: ${result.message}`,
        metadata: JSON.stringify({ adapterId, status: result.status, runtime: result.runtime }),
      },
    });

    res.json(result);
  } catch (error: any) {
    logger.error(`Adapter probe error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      runtime: 'none',
      version: null,
      path: null,
      message: `Probe could not run: ${error.message}`,
      error: error.message,
    });
  }
});

// POST /api/adapters/execute — run a prompt through an adapter CLI
adapterRoutes.post('/execute', authenticate, async (req, res) => {
  try {
    const { adapterId, prompt, systemPrompt, model, cwd, timeout } = req.body;
    if (!adapterId || !prompt) {
      return res.status(400).json({ error: 'adapterId and prompt are required' });
    }

    const result = await adapterManager.executeAdapter(adapterId, {
      prompt,
      systemPrompt,
      model,
      cwd,
      timeout,
    });

    res.status(result.success ? 200 : 502).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, output: '', error: error.message });
  }
});

// GET /api/adapters/:id — stored adapter record
adapterRoutes.get('/:id', authenticate, async (req, res) => {
  try {
    const adapter = await prisma.adapter.findUnique({ where: { name: req.params.id as string } });
    if (!adapter) return res.status(404).json({ error: 'Adapter not found' });
    res.json({ adapter });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { adapterManager } from '../adapters/manager';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
export const adapterRoutes = Router();

// GET /api/adapters — List all available adapters
adapterRoutes.get('/', authenticate, async (_req, res) => {
  try {
    const adapters = adapterManager.listAdapters();
    // Enrich with probe status from DB
    const enriched = await Promise.all(adapters.map(async (a) => {
      const dbAdapter = await prisma.adapter.findUnique({ where: { name: a.id } });
      return {
        ...a,
        probeStatus: dbAdapter?.probeStatus || 'not_tested',
        probeError: dbAdapter?.probeError || null,
        lastProbeAt: dbAdapter?.lastProbeAt || null,
        isConnected: dbAdapter?.isConnected || false,
        models: dbAdapter?.models ? JSON.parse(dbAdapter.models) : [],
      };
    }));
    res.json({ adapters: enriched });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/adapters/probe — Test an adapter's connectivity
adapterRoutes.post('/probe', authenticate, async (req, res) => {
  try {
    const { adapterId } = req.body;
    if (!adapterId) return res.status(400).json({ error: 'adapterId is required' });

    logger.info(`Probing adapter: ${adapterId}`);
    const result = await adapterManager.probeAdapter(adapterId);

    // Save probe result to database
    const models = result.models ? JSON.stringify(result.models) : null;
    await prisma.adapter.upsert({
      where: { name: adapterId },
      update: {
        probeStatus: result.status,
        probeError: result.error || null,
        lastProbeAt: new Date(),
        isConnected: result.status === 'ready',
        models,
        version: result.version,
      },
      create: {
        name: adapterId,
        displayName: result.status === 'ready' ? adapterId : adapterId,
        type: 'cli',
        probeStatus: result.status,
        probeError: result.error || null,
        lastProbeAt: new Date(),
        isConnected: result.status === 'ready',
        models,
      },
    });

    res.json(result);
  } catch (error: any) {
    logger.error(`Adapter probe error: ${error.message}`);
    res.status(500).json({ status: 'error', message: error.message, error: error.message });
  }
});

// POST /api/adapters/execute — Execute a task through an adapter
adapterRoutes.post('/execute', authenticate, async (req, res) => {
  try {
    const { adapterId, prompt, systemPrompt, model, maxTokens, temperature, timeout } = req.body;
    if (!adapterId || !prompt) {
      return res.status(400).json({ error: 'adapterId and prompt are required' });
    }

    const result = await adapterManager.executeAdapter(adapterId, {
      prompt,
      systemPrompt,
      model,
      maxTokens,
      temperature,
      timeout,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/adapters/:id — Get adapter details
adapterRoutes.get('/:id', authenticate, async (req, res) => {
  try {
    const id = req.params.id as string;
    const dbAdapter = await prisma.adapter.findUnique({ where: { name: id } });
    if (!dbAdapter) return res.status(404).json({ error: 'Adapter not found' });

    res.json({ adapter: dbAdapter });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

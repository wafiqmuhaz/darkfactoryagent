import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { aiModelManager } from '../ai/model-manager';

const prisma = new PrismaClient();
export const skillStudioRoutes = Router();

// GET /api/skill-studio — List custom skills
skillStudioRoutes.get('/', authenticate, async (req, res) => {
  const { authorId, isPublic } = req.query as Record<string, string>;
  const skills = await prisma.customSkill.findMany({
    where: {
      ...(authorId ? { authorId } : {}),
      ...(isPublic !== undefined ? { isPublic: isPublic === 'true' } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ skills, total: skills.length });
});

// GET /api/skill-studio/:id — Get a custom skill
skillStudioRoutes.get('/:id', authenticate, async (req, res) => {
  const id = req.params.id as string;
  const skill = await prisma.customSkill.findUnique({ where: { id } });
  if (!skill) return res.status(404).json({ error: 'Custom skill not found' });
  return res.json({ skill });
});

// POST /api/skill-studio — Create a new custom skill
skillStudioRoutes.post('/', authenticate, async (req, res) => {
  const { name, displayName, description, prompt, parameters, model, examples, isPublic } = req.body;
  if (!name || !displayName || !prompt) {
    return res.status(400).json({ error: 'name, displayName, prompt are required' });
  }
  try {
    const skill = await prisma.customSkill.create({
      data: {
        name, displayName, description, prompt,
        parameters: parameters ? JSON.stringify(parameters) : null,
        model: model ?? null,
        examples: examples ? JSON.stringify(examples) : null,
        isPublic: isPublic ?? false,
        authorId: (req as any).user?.id ?? 'system',
      },
    });
    return res.status(201).json({ skill });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// PUT /api/skill-studio/:id — Update a custom skill
skillStudioRoutes.put('/:id', authenticate, async (req, res) => {
  const id = req.params.id as string;
  const { displayName, description, prompt, parameters, model, examples, isPublic } = req.body;
  const skill = await prisma.customSkill.update({
    where: { id },
    data: {
      displayName, description, prompt, model: model ?? undefined,
      parameters: parameters ? JSON.stringify(parameters) : undefined,
      examples: examples ? JSON.stringify(examples) : undefined,
      isPublic: isPublic ?? undefined,
    },
  });
  res.json({ skill });
});

// POST /api/skill-studio/:id/test — Execute & test the skill (6.12)
skillStudioRoutes.post('/:id/test', authenticate, async (req, res) => {
  const id = req.params.id as string;
  const skill = await prisma.customSkill.findUnique({ where: { id } });
  if (!skill) return res.status(404).json({ error: 'Custom skill not found' });

  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'input is required for testing' });

  const start = Date.now();
  try {
    const response = await aiModelManager.complete(
      [
        { role: 'system', content: skill.prompt },
        { role: 'user', content: typeof input === 'string' ? input : JSON.stringify(input) },
      ],
      {
        strategy: skill.model ? 'specific' : 'cheapest',
        specificModelId: skill.model ?? undefined,
      }
    );

    const testResult = {
      success: true,
      input,
      output: response.content,
      model: response.model,
      latencyMs: Date.now() - start,
      costUsd: response.costUsd,
    };

    // Persist last test result
    await prisma.customSkill.update({
      where: { id },
      data: { testResults: JSON.stringify(testResult) },
    });

    return res.json(testResult);
  } catch (error: any) {
    const testResult = { success: false, error: error.message, latencyMs: Date.now() - start };
    await prisma.customSkill.update({
      where: { id },
      data: { testResults: JSON.stringify(testResult) },
    });
    return res.status(500).json(testResult);
  }
});

// DELETE /api/skill-studio/:id — Delete a custom skill
skillStudioRoutes.delete('/:id', authenticate, async (req, res) => {
  const id = req.params.id as string;
  await prisma.customSkill.delete({ where: { id } });
  res.json({ success: true });
});

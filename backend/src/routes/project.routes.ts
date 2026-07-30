import { Router } from 'express';
import { z } from 'zod';
import { projectService } from '../services/project.service';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const createProjectSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().optional(),
  localPath: z.string().min(1),
  githubRepoUrl: z.string().url().optional(),
  adapterType: z.string().optional(),
  adapterModel: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  description: z.string().optional(),
  localPath: z.string().min(1).optional(),
  githubRepoUrl: z.string().url().optional(),
  defaultBranch: z.string().optional(),
  adapterType: z.string().optional(),
  adapterModel: z.string().optional(),
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const input = createProjectSchema.parse(req.body);
    const result = await projectService.create({
      name: input.name,
      description: input.description,
      path: input.localPath,
      repoUrl: input.githubRepoUrl,
      adapterType: input.adapterType,
      adapterModel: input.adapterModel,
      ownerId: req.userId!,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const result = await projectService.findAll(req.userId!);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const result = await projectService.findById(id, req.userId!);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const input = updateProjectSchema.parse(req.body);
    const updateData: any = {};
    if (input.name) updateData.name = input.name;
    if (input.description) updateData.description = input.description;
    if (input.localPath) updateData.path = input.localPath;
    if (input.githubRepoUrl) updateData.repoUrl = input.githubRepoUrl;
    if (input.defaultBranch) updateData.branch = input.defaultBranch;
    if (input.adapterType) updateData.adapterType = input.adapterType;
    if (input.adapterModel) updateData.adapterModel = input.adapterModel;

    const result = await projectService.update(id, req.userId!, updateData);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    await projectService.delete(id, req.userId!);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/validate-path', async (req: AuthRequest, res, next) => {
  try {
    const { localPath } = z.object({ localPath: z.string().min(1) }).parse(req.body);
    const exists = require('fs').existsSync(localPath);
    res.status(200).json({ valid: exists });
  } catch (error) {
    next(error);
  }
});

export const projectRoutes = router;

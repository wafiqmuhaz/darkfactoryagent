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
});

const updateProjectSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  description: z.string().optional(),
  localPath: z.string().min(1).optional(),
  githubRepoUrl: z.string().url().optional(),
  defaultBranch: z.string().optional(),
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const input = createProjectSchema.parse(req.body);
    const result = await projectService.createProject(req.userId!, input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const result = await projectService.listProjects(req.userId!);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const result = await projectService.getProject(req.params.id, req.userId!);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const input = updateProjectSchema.parse(req.body);
    const result = await projectService.updateProject(req.params.id, req.userId!, input);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await projectService.deleteProject(req.params.id, req.userId!);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/validate-path', async (req: AuthRequest, res, next) => {
  try {
    const { localPath } = z.object({ localPath: z.string().min(1) }).parse(req.body);
    const isValid = await projectService.validateLocalPath(localPath);
    res.status(200).json({ valid: isValid });
  } catch (error) {
    next(error);
  }
});

export const projectRoutes = router;

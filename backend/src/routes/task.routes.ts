import { Router } from 'express';
import { z } from 'zod';
import { taskService } from '../services/task.service';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  projectId: z.string().uuid(),
  parentTaskId: z.string().uuid().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedAgentId: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.string(),
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const input = createTaskSchema.parse(req.body);
    const result = await taskService.createTask(input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const projectId = req.query.projectId;
    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ error: 'projectId query parameter is required' });
    }

    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const priority = typeof req.query.priority === 'string' ? req.query.priority : undefined;

    const result = await taskService.listTasks(projectId, { status, priority });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const result = await taskService.getTask(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const input = updateTaskSchema.parse(req.body);
    const result = await taskService.updateTask(id, input);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const { status } = updateStatusSchema.parse(req.body);
    const result = await taskService.updateTaskStatus(id, status);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    await taskService.deleteTask(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export const taskRoutes = router;

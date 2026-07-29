import { Router } from 'express';
import { z } from 'zod';
import { taskService } from '../services/task.service';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { TaskStatus, TaskPriority } from '@prisma/client';

const router = Router();
router.use(authMiddleware);

const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  projectId: z.string().uuid(),
  parentTaskId: z.string().uuid().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assignedAgentId: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const input = createTaskSchema.parse(req.body);
    // Add additional check here to ensure the user actually has access to the project
    const result = await taskService.createTask(input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId query parameter is required' });
    }
    
    const status = req.query.status as TaskStatus | undefined;
    const priority = req.query.priority as TaskPriority | undefined;

    const result = await taskService.listTasks(projectId, { status, priority });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const result = await taskService.getTask(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const input = updateTaskSchema.parse(req.body);
    const result = await taskService.updateTask(req.params.id, input);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    const result = await taskService.updateTaskStatus(req.params.id, status);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await taskService.deleteTask(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export const taskRoutes = router;

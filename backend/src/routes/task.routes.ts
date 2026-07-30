import { Router } from 'express';
import { z } from 'zod';
import { taskService } from '../services/task.service';
import { taskExecutionService } from '../services/task-execution.service';
import { activityService } from '../services/activity.service';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  type: z.string().optional(),
  projectId: z.string().uuid(),
  parentTaskId: z.string().uuid().optional(),
  /** When false, the task is created but not queued. */
  autoRun: z.boolean().optional(),
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
    // The service owns queueing so the queue push happens for every caller.
    const task = await taskService.createTask(input);
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/stats — aggregate counts for the dashboard
router.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const stats = await taskService.getStats(projectId);
    res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/logs — activity entries grouped by task, for the board
router.get('/logs', async (req: AuthRequest, res, next) => {
  try {
    const projectId = req.query.projectId;
    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ error: 'projectId query parameter is required' });
    }

    const tasks = await taskService.listTasks(projectId);
    const grouped = await activityService.listByTasks(tasks.map((t) => t.id));
    res.status(200).json(grouped);
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/run — (re)queue a task, or run it inline if Redis is down
router.post('/:id/run', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const task = await taskService.getTask(id);

    const queued = await taskService.enqueueTask(task);
    if (queued.queued) {
      return res.status(202).json({ queued: true, jobId: queued.jobId, taskId: id });
    }

    // Redis unavailable — execute synchronously so the request still does the work.
    const result = await taskExecutionService.executeTask(id);
    res.status(result.success ? 200 : 502).json({ queued: false, ...result });
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

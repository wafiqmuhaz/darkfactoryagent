import { Router } from 'express';
import { z } from 'zod';
import { taskService } from '../services/task.service';
import { taskExecutionService } from '../services/task-execution.service';
import { taskQueue } from '../orchestrator/queue';
import { logger } from '../utils/logger';
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
  /** When true, hand the task straight to the project's adapter CLI. */
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
    const { autoRun, ...input } = createTaskSchema.parse(req.body);
    const task = await taskService.createTask(input);

    // Creating a task is the trigger: queue it for the adapter CLI unless told otherwise.
    if (autoRun !== false) {
      try {
        await taskQueue.add(
          'adapter-exec',
          { agentType: 'adapter-exec', taskId: task.id, projectId: task.projectId },
          { priority: priorityToQueueWeight(task.priority) }
        );
      } catch (queueError: any) {
        // Redis unavailable — run inline so the task still executes.
        logger.warn(`Queue unavailable (${queueError.message}); running task ${task.id} inline`);
        void taskExecutionService
          .executeTask(task.id)
          .catch((err) => logger.error(`Inline execution failed for ${task.id}: ${err.message}`));
      }
    }

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/run — manually (re)run a task through the adapter CLI
router.post('/:id/run', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const result = await taskExecutionService.executeTask(id);
    res.status(result.success ? 200 : 502).json(result);
  } catch (error) {
    next(error);
  }
});

function priorityToQueueWeight(priority: string): number {
  switch (priority) {
    case 'critical': return 1;
    case 'high': return 2;
    case 'medium': return 3;
    default: return 4;
  }
}

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

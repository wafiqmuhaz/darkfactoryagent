import { Router } from 'express';
import { taskQueue } from '../orchestrator/queue';
import { skillRegistry } from '../skills/skill-registry';

const router = Router();

router.get('/health', async (req, res, next) => {
  try {
    const queueCounts = await taskQueue.getJobCounts();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      queue: queueCounts,
      skills: skillRegistry.getAvailableSkills(),
    });
  } catch (error) {
    next(error);
  }
});

export const metricsRoutes = router;

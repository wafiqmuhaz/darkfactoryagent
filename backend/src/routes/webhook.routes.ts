import { Router } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.post('/github', (req, res) => {
  const eventType = req.headers['x-github-event'];
  logger.info(`Received GitHub Webhook: ${eventType}`);
  
  if (eventType === 'pull_request') {
    // Handle PR updates
  } else if (eventType === 'push') {
    // Handle push events (auto-sync)
  }

  res.status(200).send('OK');
});

export const webhookRoutes = router;

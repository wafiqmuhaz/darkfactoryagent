import { Router } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.get('/github/callback', (req, res) => {
  const code = req.query.code;
  logger.info(`Received GitHub OAuth callback with code: ${code}`);
  
  // In a real app, exchange code for token using client_id and client_secret
  // Then save token to user session
  
  res.redirect('/dashboard?oauth=success');
});

export const oauthRoutes = router;

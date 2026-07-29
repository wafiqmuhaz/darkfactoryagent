import { Router } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.get('/saml/login', (req, res) => {
  logger.info('Initiating SAML SSO login');
  // Redirect to Enterprise IdP
  res.redirect('/mock-idp-login');
});

router.post('/saml/callback', (req, res) => {
  logger.info('Received SAML callback');
  // Process SAML Assertion
  // Mint local JWT Token
  res.json({ token: 'mock-sso-jwt-token' });
});

export const ssoRoutes = router;

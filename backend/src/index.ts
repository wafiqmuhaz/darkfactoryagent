import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './utils/logger';
import { initWebSocket } from './websocket/socket';
import { errorHandler } from './middleware/errorHandler';

import { authRoutes } from './routes/auth.routes';
import { projectRoutes } from './routes/project.routes';
import { taskRoutes } from './routes/task.routes';
import { metricsRoutes } from './routes/metrics.routes';
import { webhookRoutes } from './routes/webhook.routes';
import { oauthRoutes } from './routes/oauth.routes';
import { ssoRoutes } from './routes/sso.routes';
import { aiRoutes } from './routes/ai.routes';
import { pluginRoutes } from './routes/plugin.routes';
import { skillStudioRoutes } from './routes/skill-studio.routes';
import { teamRoutes } from './routes/team.routes';
import { enterpriseRoutes } from './routes/enterprise.routes';
import { integrationRoutes } from './routes/integration.routes';
import { auditLogger } from './middleware/auditLogger';
import { apiRateLimiter } from './middleware/rateLimiter';

import { initQueueWorker } from './orchestrator/queue';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(helmet());
app.use(apiRateLimiter);
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import { dataLakeService } from './services/datalake.service';

// Request logging middleware
app.use(auditLogger);
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  
  // Log telemetry to Data Lake
  dataLakeService.logEvent({
    eventType: 'api_request',
    timestamp: new Date().toISOString(),
    data: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }
  });
  
  next();
});

// Health check endpoint (Available in all modes)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', mode: process.env.PROCESS_MODE || 'monolith', timestamp: new Date().toISOString() });
});

const PORT = config.port || 3001;
const MODE = process.env.PROCESS_MODE || 'monolith';

if (MODE === 'api' || MODE === 'monolith') {
  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/metrics', metricsRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/oauth', oauthRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/plugins', pluginRoutes);
  app.use('/api/skill-studio', skillStudioRoutes);
  app.use('/api/teams', teamRoutes);
  app.use('/api/enterprise', enterpriseRoutes);
  app.use('/api/integrations', integrationRoutes);

  // Error handling middleware
  app.use(errorHandler);

  // Initialize WebSocket server
  initWebSocket(httpServer);
  
  logger.info(`Initialized API Routes and WebSockets (Mode: ${MODE})`);
}

let workerInstance: any = null;

if (MODE === 'worker' || MODE === 'monolith') {
  workerInstance = initQueueWorker();
  logger.info(`Initialized BullMQ Background Worker (Mode: ${MODE})`);
}

httpServer.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT} [Mode: ${MODE}]`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  if (workerInstance) await workerInstance.close();
  httpServer.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});

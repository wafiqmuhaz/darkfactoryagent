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
import { auditLogger } from './middleware/auditLogger';
import { apiRateLimiter } from './middleware/rateLimiter';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(helmet());
app.use(apiRateLimiter);
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use(auditLogger);
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/oauth', oauthRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use(errorHandler);

// Initialize WebSocket server
initWebSocket(httpServer);

// Start server
const PORT = config.port || 3001;

httpServer.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});

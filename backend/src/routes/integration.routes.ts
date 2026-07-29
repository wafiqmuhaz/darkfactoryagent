import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/authenticate';

const prisma = new PrismaClient();
export const integrationRoutes = Router();

// Supported integration catalog
const INTEGRATION_CATALOG = [
  { name: 'github',   displayName: 'GitHub',      type: 'vcs',     description: 'Source control, PRs, issues' },
  { name: 'gitlab',   displayName: 'GitLab',      type: 'vcs',     description: 'Self-hosted Git, CI/CD' },
  { name: 'jira',     displayName: 'Jira',         type: 'pm',      description: 'Issue tracking & sprints' },
  { name: 'linear',   displayName: 'Linear',       type: 'pm',      description: 'Modern issue tracker' },
  { name: 'slack',    displayName: 'Slack',         type: 'chat',    description: 'Notifications & bot commands' },
  { name: 'discord',  displayName: 'Discord',      type: 'chat',    description: 'Community notifications' },
  { name: 'github-actions', displayName: 'GitHub Actions', type: 'ci', description: 'CI/CD pipelines' },
  { name: 'circleci', displayName: 'CircleCI',     type: 'ci',      description: 'Continuous integration' },
  { name: 's3',       displayName: 'AWS S3',       type: 'storage', description: 'Artifact & backup storage' },
  { name: 'notion',   displayName: 'Notion',        type: 'docs',    description: 'Document & wiki sync' },
];

// GET /api/integrations/catalog — List available integrations
integrationRoutes.get('/catalog', authenticate, (req, res) => {
  res.json({ catalog: INTEGRATION_CATALOG, total: INTEGRATION_CATALOG.length });
});

// GET /api/integrations — List active integrations
integrationRoutes.get('/', authenticate, async (req, res) => {
  const { type } = req.query as Record<string, string>;
  const integrations = await prisma.integration.findMany({
    where: type ? { type } : {},
    orderBy: { name: 'asc' },
    select: { id: true, name: true, displayName: true, type: true, isActive: true, lastSyncAt: true, createdAt: true, updatedAt: true },
  });
  res.json({ integrations, total: integrations.length });
});

// POST /api/integrations — Add an integration
integrationRoutes.post('/', authenticate, async (req, res) => {
  const { name, config } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const catalogEntry = INTEGRATION_CATALOG.find((c) => c.name === name);
  if (!catalogEntry) return res.status(400).json({ error: `Unknown integration: ${name}. Check /catalog` });

  try {
    const integration = await prisma.integration.create({
      data: {
        name,
        displayName: catalogEntry.displayName,
        type: catalogEntry.type,
        config: config ? JSON.stringify(config) : null,
        isActive: true,
      },
    });
    return res.status(201).json({ integration });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// PATCH /api/integrations/:id — Update config or toggle active state
integrationRoutes.patch('/:id', authenticate, async (req, res) => {
  const id = req.params.id as string;
  const { config, isActive } = req.body;
  const integration = await prisma.integration.update({
    where: { id },
    data: {
      isActive: isActive ?? undefined,
      config: config ? JSON.stringify(config) : undefined,
    },
  });
  res.json({ integration });
});

// POST /api/integrations/:id/sync — Trigger a sync for an integration
integrationRoutes.post('/:id/sync', authenticate, async (req, res) => {
  const id = req.params.id as string;
  const integration = await prisma.integration.findUnique({ where: { id } });
  if (!integration) return res.status(404).json({ error: 'Integration not found' });

  // In a real system, enqueue a sync job via BullMQ.
  // For now, update the lastSyncAt timestamp to simulate a sync.
  const updated = await prisma.integration.update({
    where: { id },
    data: { lastSyncAt: new Date() },
  });

  return res.json({ success: true, message: `Sync triggered for ${integration.displayName}`, lastSyncAt: updated.lastSyncAt });
});

// DELETE /api/integrations/:id — Remove integration
integrationRoutes.delete('/:id', authenticate, async (req, res) => {
  const id = req.params.id as string;
  await prisma.integration.delete({ where: { id } });
  res.json({ success: true });
});

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/authenticate';

const prisma = new PrismaClient();
export const enterpriseRoutes = Router();

// ─── Admin Console (6.14) ────────────────────────────────────────────

// GET /api/enterprise/stats — Admin dashboard summary
enterpriseRoutes.get('/stats', authenticate, async (req, res) => {
  const [userCount, projectCount, taskCount, teamCount, agentRunCount] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.task.count(),
    prisma.team.count(),
    prisma.agentRun.count(),
  ]);

  const tasksByStatus = await prisma.task.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  const agentRunsByStatus = await prisma.agentRun.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  const recentMetrics = await prisma.metric.findMany({
    orderBy: { recordedAt: 'desc' },
    take: 10,
  });

  res.json({
    overview: { userCount, projectCount, taskCount, teamCount, agentRunCount },
    tasksByStatus: Object.fromEntries(tasksByStatus.map((s) => [s.status, s._count.id])),
    agentRunsByStatus: Object.fromEntries(agentRunsByStatus.map((s) => [s.status, s._count.id])),
    recentMetrics,
  });
});

// GET /api/enterprise/users — Admin: list all users
enterpriseRoutes.get('/users', authenticate, async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ users, total: users.length });
});

// DELETE /api/enterprise/users/:id — Admin: delete user
enterpriseRoutes.delete('/users/:id', authenticate, async (req, res) => {
  const id = req.params.id as string;
  await prisma.user.delete({ where: { id } });
  res.json({ success: true });
});

// ─── Billing (6.14) ─────────────────────────────────────────────────

// GET /api/enterprise/billing/:teamId — Get invoices for team
enterpriseRoutes.get('/billing/:teamId', authenticate, async (req, res) => {
  const teamId = req.params.teamId as string;
  const invoices = await prisma.invoice.findMany({
    where: { teamId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ invoices, total: invoices.length });
});

// POST /api/enterprise/billing/:teamId/invoice — Create invoice
enterpriseRoutes.post('/billing/:teamId/invoice', authenticate, async (req, res) => {
  const teamId = req.params.teamId as string;
  const { amount, currency, description, period } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount is required' });
  const invoice = await prisma.invoice.create({
    data: {
      teamId,
      amount,
      currency: currency ?? 'USD',
      description,
      period,
      status: 'pending',
    },
  });
  res.status(201).json({ invoice });
});

// PATCH /api/enterprise/billing/invoices/:id — Update invoice status
enterpriseRoutes.patch('/billing/invoices/:id', authenticate, async (req, res) => {
  const id = req.params.id as string;
  const { status } = req.body;
  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      status,
      paidAt: status === 'paid' ? new Date() : undefined,
    },
  });
  res.json({ invoice });
});

// ─── Plan Management (6.14) ─────────────────────────────────────────

// PATCH /api/enterprise/teams/:id/plan — Update team plan (upgrade/downgrade)
enterpriseRoutes.patch('/teams/:id/plan', authenticate, async (req, res) => {
  const id = req.params.id as string;
  const { plan } = req.body;
  if (!['free', 'pro', 'enterprise'].includes(plan)) {
    return res.status(400).json({ error: 'plan must be free, pro, or enterprise' });
  }
  const maxMembers = plan === 'enterprise' ? 1000 : plan === 'pro' ? 20 : 5;
  const team = await prisma.team.update({
    where: { id },
    data: { plan, maxMembers },
  });
  return res.json({ success: true, team });
});

// ─── Compliance (6.14) ──────────────────────────────────────────────

// GET /api/enterprise/audit-log — Get recent audit trail
enterpriseRoutes.get('/audit-log', authenticate, async (req, res) => {
  const { limit = '50' } = req.query as Record<string, string>;
  const runs = await prisma.agentRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit),
    include: { task: { select: { title: true } }, project: { select: { name: true } } },
  });
  res.json({ auditLog: runs, total: runs.length });
});

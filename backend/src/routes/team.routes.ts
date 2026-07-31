import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireTeamRole } from '../middleware/rbac';

const prisma = new PrismaClient();
export const teamRoutes = Router();

// GET /api/teams — List teams for admin
teamRoutes.get('/', authenticate, async (req, res) => {
  const teams = await prisma.team.findMany({
    include: { members: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ teams, total: teams.length });
});

// POST /api/teams — Create a new team
teamRoutes.post('/', authenticate, async (req, res) => {
  const { name, displayName, description, plan } = req.body;
  if (!name || !displayName) return res.status(400).json({ error: 'name and displayName are required' });

  const maxMembers = plan === 'enterprise' ? 1000 : plan === 'pro' ? 20 : 5;
  try {
    const team = await prisma.team.create({
      data: { name, displayName, description, plan: plan ?? 'free', maxMembers },
    });
    // Auto-add creator as owner
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: (req as AuthRequest).userId!, role: 'owner' },
    });
    return res.status(201).json({ team });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// GET /api/teams/:id — Get team details
teamRoutes.get('/:id', authenticate, async (req, res) => {
  const id = req.params.id as string;
  const team = await prisma.team.findUnique({
    where: { id },
    include: { members: true, workspaces: true, plugins: { include: { plugin: true } } },
  });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  return res.json({ team });
});

// POST /api/teams/:id/members — Invite a user to team (admin+)
teamRoutes.post('/:id/members', authenticate, requireTeamRole('admin'), async (req, res) => {
  const id = req.params.id as string;
  const { userId, role } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const team = await prisma.team.findUnique({ where: { id }, include: { members: true } });
  if (!team) return res.status(404).json({ error: 'Team not found' });

  if (team.members.length >= team.maxMembers) {
    return res.status(403).json({ error: `Team has reached max member limit of ${team.maxMembers}` });
  }

  try {
    const member = await prisma.teamMember.create({
      data: { teamId: id, userId, role: role ?? 'member' },
    });
    return res.status(201).json({ member });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// DELETE /api/teams/:id/members/:userId — Remove member (admin+)
teamRoutes.delete('/:id/members/:userId', authenticate, requireTeamRole('admin'), async (req, res) => {
  const teamId = req.params.id as string;
  const userId = req.params.userId as string;
  await prisma.teamMember.deleteMany({
    where: { teamId, userId },
  });
  res.json({ success: true });
});

// PATCH /api/teams/:id/members/:userId — Update member role (owner only)
teamRoutes.patch('/:id/members/:userId', authenticate, requireTeamRole('owner'), async (req, res) => {
  const teamId = req.params.id as string;
  const userId = req.params.userId as string;
  const { role } = req.body;
  const member = await prisma.teamMember.updateMany({
    where: { teamId, userId },
    data: { role },
  });
  res.json({ success: true, member });
});

// GET /api/teams/:id/workspaces — Team workspaces
teamRoutes.get('/:id/workspaces', authenticate, async (req, res) => {
  const id = req.params.id as string;
  const workspaces = await prisma.workspace.findMany({ where: { teamId: id } });
  res.json({ workspaces });
});

// POST /api/teams/:id/workspaces — Create a workspace (member+)
teamRoutes.post('/:id/workspaces', authenticate, requireTeamRole('member'), async (req, res) => {
  const id = req.params.id as string;
  const { name, description, settings } = req.body;
  const workspace = await prisma.workspace.create({
    data: {
      name, description,
      settings: settings ? JSON.stringify(settings) : null,
      teamId: id,
    },
  });
  res.status(201).json({ workspace });
});

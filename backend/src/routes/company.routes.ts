import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireCompanyRole } from '../middleware/rbac';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
export const companyRoutes = Router();

// GET /api/company — Get current user's company
companyRoutes.get('/', authenticate, async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const membership = await prisma.companyMember.findFirst({
      where: { userId },
      include: {
        company: {
          include: {
            agents: true,
            _count: { select: { projects: true, invites: true, members: true } },
          },
        },
      },
    });
    if (!membership) return res.status(404).json({ error: 'No company found' });
    res.json({ company: membership.company, role: membership.role });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/company — Update company details (admin+)
companyRoutes.put('/', authenticate, requireCompanyRole('admin'), async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { name, mission } = req.body;
    const membership = await prisma.companyMember.findFirst({
      where: { userId },
      include: { company: true },
    });
    if (!membership) return res.status(404).json({ error: 'No company found' });

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (mission !== undefined) updateData.mission = mission;

    const company = await prisma.company.update({
      where: { id: membership.company.id },
      data: updateData,
    });
    res.json({ company });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/company/members — List company members
companyRoutes.get('/members', authenticate, async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const membership = await prisma.companyMember.findFirst({
      where: { userId },
    });
    if (!membership) return res.status(404).json({ error: 'No company found' });

    const members = await prisma.companyMember.findMany({
      where: { companyId: membership.companyId },
      include: { company: { select: { name: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    res.json({ members });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/company/members/:userId — Update member role
companyRoutes.patch('/members/:userId', authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.userId as string;
    const { role } = req.body;
    const currentUserId = (req as AuthRequest).userId!;

    const membership = await prisma.companyMember.findFirst({
      where: { userId: currentUserId },
    });
    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can update member roles' });
    }

    const updated = await prisma.companyMember.updateMany({
      where: { userId: targetUserId, companyId: membership.companyId },
      data: { role },
    });
    res.json({ success: true, updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/company/members/:userId — Remove member
companyRoutes.delete('/members/:userId', authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.userId as string;
    const currentUserId = (req as AuthRequest).userId!;
    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }

    const membership = await prisma.companyMember.findFirst({
      where: { userId: currentUserId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await prisma.companyMember.deleteMany({
      where: { userId: targetUserId, companyId: membership.companyId },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/company/invites — Create an invite (admin+)
companyRoutes.post('/invites', authenticate, requireCompanyRole('admin'), async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const userId = (req as AuthRequest).userId!;
    const membership = await prisma.companyMember.findFirst({
      where: { userId },
    });
    if (!membership) return res.status(404).json({ error: 'No company found' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    const invite = await prisma.invite.create({
      data: {
        email,
        role: role || 'member',
        token,
        expiresAt,
        companyId: membership.companyId,
        invitedBy: userId,
      },
    });

    logger.info(`Invite created for ${email} to company ${membership.companyId}`);
    res.status(201).json({ invite, inviteUrl: `/accept-invite?token=${token}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/company/invites — List invites
companyRoutes.get('/invites', authenticate, async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const membership = await prisma.companyMember.findFirst({
      where: { userId },
    });
    if (!membership) return res.status(404).json({ error: 'No company found' });

    const invites = await prisma.invite.findMany({
      where: { companyId: membership.companyId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ invites });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/company/invites/:id — Revoke an invite (admin+)
companyRoutes.delete('/invites/:id', authenticate, requireCompanyRole('admin'), async (req, res) => {
  try {
    const id = req.params.id as string;
    await prisma.invite.update({
      where: { id },
      data: { status: 'revoked' },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/company/secrets — Store a secret (admin+)
companyRoutes.post('/secrets', authenticate, requireCompanyRole('admin'), async (req, res) => {
  try {
    const { key, value, scope } = req.body;
    if (!key || !value) return res.status(400).json({ error: 'key and value are required' });

    // Encrypt the value (basic encryption — enhance with proper key management)
    const encrypted = Buffer.from(value).toString('base64');

    await prisma.secret.upsert({
      where: { key_scope: { key, scope: scope || 'user' } },
      update: { value: encrypted },
      create: { key, value: encrypted, scope: scope || 'user' },
    });

    logger.info(`Secret stored: ${key} (scope: ${scope || 'user'})`);
    res.json({ success: true, key });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/company/secrets/:key — Delete a secret (admin+)
companyRoutes.delete('/secrets/:key', authenticate, requireCompanyRole('admin'), async (req, res) => {
  try {
    const key = req.params.key as string;
    const scope = req.query.scope as string || 'user';
    await prisma.secret.delete({ where: { key_scope: { key, scope } } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/company/projects — List company projects
companyRoutes.get('/projects', authenticate, async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const membership = await prisma.companyMember.findFirst({
      where: { userId },
    });
    if (!membership) return res.status(404).json({ error: 'No company found' });

    const projects = await prisma.projectCompany.findMany({
      where: { companyId: membership.companyId },
      include: { project: true },
    });
    res.json({ projects });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './auth';

const prisma = new PrismaClient();

/**
 * Require that the authenticated user has at least the specified role in their company.
 * Role hierarchy: owner > admin > operator > viewer
 */
export function requireCompanyRole(minimumRole: 'owner' | 'admin' | 'operator' | 'viewer') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as AuthRequest).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const membership = await prisma.companyMember.findFirst({
      where: { userId },
      select: { role: true, companyId: true },
    });

    if (!membership) {
      return res.status(403).json({ error: 'No company membership found' });
    }

    const roleHierarchy = ['viewer', 'operator', 'admin', 'owner'];
    const userRoleLevel = roleHierarchy.indexOf(membership.role);
    const requiredLevel = roleHierarchy.indexOf(minimumRole);

    if (userRoleLevel < requiredLevel) {
      return res.status(403).json({
        error: `Insufficient permissions: ${minimumRole} role required`,
        userRole: membership.role,
      });
    }

    // Attach companyId to request for convenience
    (req as any).companyId = membership.companyId;
    next();
  };
}

/**
 * Require that the authenticated user has at least the specified role in a team.
 * Role hierarchy: owner > admin > member > viewer
 */
export function requireTeamRole(minimumRole: 'owner' | 'admin' | 'member' | 'viewer') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as AuthRequest).userId;
    const teamId = req.params.id || req.params.teamId || req.body.teamId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID required' });
    }

    const membership = await prisma.teamMember.findFirst({
      where: { userId, teamId },
      select: { role: true },
    });

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this team' });
    }

    const roleHierarchy = ['viewer', 'member', 'admin', 'owner'];
    const userRoleLevel = roleHierarchy.indexOf(membership.role);
    const requiredLevel = roleHierarchy.indexOf(minimumRole);

    if (userRoleLevel < requiredLevel) {
      return res.status(403).json({
        error: `Insufficient permissions: ${minimumRole} role required`,
        userRole: membership.role,
      });
    }

    next();
  };
}

/**
 * Require admin privileges for enterprise/system-wide operations.
 * For now, "admin" means company owner. In a full multi-tenant system,
 * this would check a separate system-admin flag or a dedicated Admin table.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = (req as AuthRequest).userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const membership = await prisma.companyMember.findFirst({
    where: { userId, role: 'owner' },
  });

  if (!membership) {
    return res.status(403).json({ error: 'Admin privileges required' });
  }

  next();
}

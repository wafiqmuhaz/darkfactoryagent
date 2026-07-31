import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class GDPRService {
  /**
   * Export all data associated with a user (GDPR Article 20 — data portability).
   * Traverses the user's projects to gather tasks, artifacts, and agent runs,
   * since those are not direct User relations. Sensitive fields are scrubbed.
   */
  async exportUserData(userId: string) {
    logger.info(`[GDPRService] Exporting data for user ${userId}`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { projects: true },
    });

    if (!user) throw new Error('User not found');

    const projectIds = user.projects.map((p) => p.id);

    // Gather all data linked to the user's projects
    const [tasks, artifacts, agentRuns] = await Promise.all([
      prisma.task.findMany({ where: { projectId: { in: projectIds } } }),
      prisma.artifact.findMany({ where: { projectId: { in: projectIds } } }),
      prisma.agentRun.findMany({ where: { projectId: { in: projectIds } } }),
    ]);

    // Scrub sensitive data before export
    const { passwordHash, ...safeUserData } = user;

    return {
      exportedAt: new Date().toISOString(),
      user: safeUserData,
      projects: user.projects,
      tasks,
      artifacts,
      agentRuns,
      summary: {
        projectCount: user.projects.length,
        taskCount: tasks.length,
        artifactCount: artifacts.length,
        agentRunCount: agentRuns.length,
      },
    };
  }

  /**
   * Permanently delete a user and all associated data (GDPR Article 17 — right to erasure).
   * Project deletion cascades to tasks/artifacts/agent runs/routines via schema onDelete: Cascade;
   * the user's own record cascades from Project → User.
   */
  async deleteAccountAndData(userId: string) {
    logger.info(`[GDPRService] Processing right to be forgotten for user ${userId}`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { projects: true },
    });

    if (!user) throw new Error('User not found');

    const projectIds = user.projects.map((p) => p.id);

    // Count what will be deleted for the audit trail
    const [taskCount, artifactCount, agentRunCount] = await Promise.all([
      prisma.task.count({ where: { projectId: { in: projectIds } } }),
      prisma.artifact.count({ where: { projectId: { in: projectIds } } }),
      prisma.agentRun.count({ where: { projectId: { in: projectIds } } }),
    ]);

    // Deleting the user cascades to projects (onDelete: Cascade), which in turn
    // cascade to their tasks, artifacts, agent runs, and routines.
    await prisma.user.delete({ where: { id: userId } });

    logger.info(
      `[GDPRService] Deleted user ${userId}: ${user.projects.length} projects, ` +
        `${taskCount} tasks, ${artifactCount} artifacts, ${agentRunCount} agent runs`
    );

    return {
      success: true,
      message: 'All user data has been permanently deleted',
      deleted: {
        projects: user.projects.length,
        tasks: taskCount,
        artifacts: artifactCount,
        agentRuns: agentRunCount,
      },
    };
  }
}

export const gdprService = new GDPRService();

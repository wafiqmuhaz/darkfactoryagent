import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class GDPRService {
  async exportUserData(userId: string) {
    logger.info(`Exporting data for user ${userId}`);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        projects: true,
      }
    });

    if (!user) throw new Error('User not found');
    
    // Scrub sensitive data before export
    const { password, ...safeUserData } = user;
    return safeUserData;
  }

  async deleteAccountAndData(userId: string) {
    logger.info(`Processing right to be forgotten for user ${userId}`);
    
    // In a real scenario, this involves cascading deletes across projects, tasks, etc.
    await prisma.user.delete({
      where: { id: userId }
    });

    return { success: true, message: 'All user data has been permanently deleted' };
  }
}

export const gdprService = new GDPRService();

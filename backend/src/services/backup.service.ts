import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

export class BackupService {
  private backupDir = path.resolve(process.cwd(), 'backups');

  async createBackup() {
    logger.info('[BackupService] Starting database backup...');
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `db-backup-${timestamp}.sqlite`);

      const dbPath = path.resolve(process.cwd(), 'prisma/dev.db');
      await fs.copyFile(dbPath, backupPath);

      logger.info(`[BackupService] Backup created successfully at ${backupPath}`);
      return { success: true, path: backupPath, timestamp };
    } catch (error: any) {
      logger.error(`[BackupService] Backup failed: ${error.message}`);
      throw error;
    }
  }

  async restoreBackup(backupFilename: string) {
    logger.info(`[BackupService] Restoring backup from ${backupFilename}...`);
    try {
      const backupPath = path.join(this.backupDir, backupFilename);

      // Verify backup file exists
      try {
        await fs.access(backupPath);
      } catch {
        throw new Error(`Backup file not found: ${backupFilename}`);
      }

      const dbPath = path.resolve(process.cwd(), 'prisma/dev.db');

      // Create a safety backup of current state before restoring
      const safetyBackupPath = path.join(this.backupDir, `pre-restore-${Date.now()}.sqlite`);
      await fs.copyFile(dbPath, safetyBackupPath);
      logger.info(`[BackupService] Created safety backup at ${safetyBackupPath}`);

      // Restore the backup
      await fs.copyFile(backupPath, dbPath);

      logger.info(`[BackupService] Successfully restored backup from ${backupFilename}`);
      return { success: true, restoredFrom: backupFilename, safetyBackup: safetyBackupPath };
    } catch (error: any) {
      logger.error(`[BackupService] Restore failed: ${error.message}`);
      throw error;
    }
  }

  async listBackups() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      const files = await fs.readdir(this.backupDir);
      const backups = files.filter((f) => f.endsWith('.sqlite'));

      const backupDetails = await Promise.all(
        backups.map(async (filename) => {
          const filePath = path.join(this.backupDir, filename);
          const stats = await fs.stat(filePath);
          return {
            filename,
            size: stats.size,
            created: stats.mtime,
          };
        })
      );

      return backupDetails.sort((a, b) => b.created.getTime() - a.created.getTime());
    } catch (error: any) {
      logger.error(`[BackupService] List backups failed: ${error.message}`);
      return [];
    }
  }

  async deleteBackup(backupFilename: string) {
    try {
      const backupPath = path.join(this.backupDir, backupFilename);
      await fs.unlink(backupPath);
      logger.info(`[BackupService] Deleted backup ${backupFilename}`);
      return { success: true };
    } catch (error: any) {
      logger.error(`[BackupService] Delete backup failed: ${error.message}`);
      throw error;
    }
  }
}

export const backupService = new BackupService();

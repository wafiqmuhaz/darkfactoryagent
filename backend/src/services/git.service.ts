import simpleGit, { SimpleGit } from 'simple-git';
import { logger } from '../utils/logger';
import path from 'path';

export class GitService {
  private git: SimpleGit;

  constructor(repoPath?: string) {
    const targetPath = repoPath || process.cwd();
    this.git = simpleGit(targetPath);
  }

  async clone(url: string, localPath: string) {
    logger.info(`Cloning ${url} to ${localPath}`);
    await this.git.clone(url, localPath);
  }

  async fetch() {
    logger.info('Fetching from origin');
    await this.git.fetch();
  }

  async checkoutBranch(branch: string, create: boolean = false) {
    if (create) {
      await this.git.checkoutLocalBranch(branch);
    } else {
      await this.git.checkout(branch);
    }
    logger.info(`Checked out branch ${branch}`);
  }

  async commitAndPush(message: string, branch: string) {
    await this.git.add('.');
    await this.git.commit(message);
    await this.git.push('origin', branch);
    logger.info(`Committed and pushed to ${branch}`);
  }
}

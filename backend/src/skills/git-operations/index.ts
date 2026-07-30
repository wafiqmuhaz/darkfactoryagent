import simpleGit from 'simple-git';
import fs from 'fs';
import { SkillDefinition } from '../skill-registry';
import { logger } from '../../utils/logger';

type GitAction = 'status' | 'branch' | 'checkout' | 'commit' | 'push' | 'pull' | 'clone' | 'log' | 'diff';

export interface GitSkillInput {
  action: GitAction;
  /** Repository the operation runs in. Required for everything except `clone`. */
  repoPath?: string;
  branch?: string;
  message?: string;
  url?: string;
  targetPath?: string;
  createBranch?: boolean;
  remote?: string;
  limit?: number;
}

/**
 * Git operations scoped to a single repository path.
 *
 * Every action requires an explicit `repoPath` that must be an existing git
 * working tree — this keeps the skill from silently operating on whatever
 * directory the backend process happens to be running in.
 */
export const gitOperationsSkill: SkillDefinition = {
  name: 'git-operations',
  description: 'Clone, commit, push, branch management',
  category: 'git',
  version: '1.0.0',
  defaultEnabled: true,
  warning: 'Writes to git history and can push to remotes. Force pushes are refused.',

  execute: async (input: GitSkillInput) => {
    if (input.action === 'clone') {
      if (!input.url || !input.targetPath) {
        throw new Error('clone requires both `url` and `targetPath`');
      }
      logger.info(`[git-operations] cloning ${input.url} → ${input.targetPath}`);
      await simpleGit().clone(input.url, input.targetPath);
      return { success: true, action: 'clone', targetPath: input.targetPath };
    }

    const repoPath = input.repoPath;
    if (!repoPath) {
      throw new Error('`repoPath` is required — refusing to operate on an implicit directory');
    }
    if (!fs.existsSync(repoPath)) {
      throw new Error(`Repository path does not exist: ${repoPath}`);
    }

    const git = simpleGit(repoPath);
    if (!(await git.checkIsRepo())) {
      throw new Error(`Not a git repository: ${repoPath}`);
    }

    switch (input.action) {
      case 'status': {
        const status = await git.status();
        return {
          success: true,
          action: 'status',
          current: status.current,
          tracking: status.tracking,
          ahead: status.ahead,
          behind: status.behind,
          staged: status.staged,
          modified: status.modified,
          notAdded: status.not_added,
          conflicted: status.conflicted,
          isClean: status.isClean(),
        };
      }

      case 'branch': {
        const branches = await git.branchLocal();
        return { success: true, action: 'branch', current: branches.current, all: branches.all };
      }

      case 'checkout': {
        if (!input.branch) throw new Error('checkout requires `branch`');
        if (input.createBranch) {
          await git.checkoutLocalBranch(input.branch);
        } else {
          await git.checkout(input.branch);
        }
        logger.info(`[git-operations] checked out ${input.branch} in ${repoPath}`);
        return { success: true, action: 'checkout', branch: input.branch, created: !!input.createBranch };
      }

      case 'commit': {
        if (!input.message) throw new Error('commit requires `message`');
        const status = await git.status();
        if (status.isClean()) {
          return { success: true, action: 'commit', skipped: true, reason: 'nothing to commit' };
        }
        await git.add('.');
        const result = await git.commit(input.message);
        logger.info(`[git-operations] committed ${result.commit} in ${repoPath}`);
        return {
          success: true,
          action: 'commit',
          commit: result.commit,
          summary: result.summary,
        };
      }

      case 'push': {
        const status = await git.status();
        const branch = input.branch || status.current;
        if (!branch) throw new Error('Could not determine a branch to push');
        await git.push(input.remote || 'origin', branch);
        logger.info(`[git-operations] pushed ${branch} in ${repoPath}`);
        return { success: true, action: 'push', branch };
      }

      case 'pull': {
        const result = await git.pull(input.remote || 'origin', input.branch);
        return { success: true, action: 'pull', summary: result.summary, files: result.files };
      }

      case 'log': {
        const log = await git.log({ maxCount: input.limit ?? 20 });
        return {
          success: true,
          action: 'log',
          commits: log.all.map((c) => ({
            hash: c.hash.slice(0, 8),
            message: c.message,
            author: c.author_name,
            date: c.date,
          })),
        };
      }

      case 'diff': {
        const diff = await git.diff(input.branch ? [input.branch] : []);
        // Diffs can be enormous; cap what we hand back to a caller.
        return { success: true, action: 'diff', diff: diff.slice(0, 100000), truncated: diff.length > 100000 };
      }

      default:
        throw new Error(`Unsupported git action: ${(input as GitSkillInput).action}`);
    }
  },
};

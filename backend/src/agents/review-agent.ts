import { BaseAgent, AgentDefinition, AgentContext } from './base-agent';
import { skillRegistry } from '../skills/skill-registry';
import type { AIMessage } from '../ai/model-registry';

export class ReviewAgent extends BaseAgent {
  protected name = 'ReviewAgent';

  static definition: AgentDefinition = {
    agentType: 'review',
    name: 'Code Reviewer',
    executionMode: 'hybrid',
    description: 'Reviews code changes and provides feedback',
    strategy: 'cheapest',
    requiredCapability: 'code',
    requiredSkills: ['file-system', 'git-operations'],
    artifactType: 'review',
  };

  constructor() {
    super(ReviewAgent.definition);
  }

  protected async gatherHybridInputs(
    context: AgentContext,
    input: any
  ): Promise<any> {
    const projectPath = input?.projectPath || process.cwd();

    // Get git status via git-operations skill
    let gitStatus: any = {};
    try {
      gitStatus = await skillRegistry.executeSkill('git-operations', {
        action: 'status',
        repoPath: projectPath,
      });
    } catch (error: any) {
      gitStatus = { error: error.message };
    }

    // Get recent commits
    let recentCommits: any = {};
    try {
      recentCommits = await skillRegistry.executeSkill('git-operations', {
        action: 'log',
        repoPath: projectPath,
        limit: 5,
      });
    } catch (error: any) {
      recentCommits = { error: error.message };
    }

    // Get diff
    let diff = '';
    try {
      const diffResult = await skillRegistry.executeSkill('git-operations', {
        action: 'diff',
        repoPath: projectPath,
      });
      diff = diffResult.diff || '';
    } catch (error: any) {
      diff = `Error getting diff: ${error.message}`;
    }

    // Read a few changed files if available
    let changedFiles = '';
    if (gitStatus.modified && gitStatus.modified.length > 0) {
      for (const file of gitStatus.modified.slice(0, 3)) {
        try {
          const content = await skillRegistry.executeSkill('file-system', {
            action: 'read',
            filePath: file,
            baseDir: projectPath,
          });
          changedFiles += `\n\n=== ${file} ===\n${content.slice(0, 5000)}`;
        } catch {
          // File may not be readable
        }
      }
    }

    return {
      summary: `Review of ${gitStatus.modified?.length ?? 0} modified files`,
      gitStatus,
      recentCommits,
      diff: diff.slice(0, 10000),
      changedFiles,
      projectPath,
    };
  }

  protected buildMessages(context: AgentContext, input: any): AIMessage[] {
    const repoData = input?.repoData || {};
    const task = input?.title || input?.description || 'Code review';

    return [
      {
        role: 'system',
        content: `You are a senior code reviewer analyzing changes for quality, maintainability, and correctness. Focus on:
- Code quality and best practices
- Potential bugs or edge cases
- Security vulnerabilities
- Performance considerations
- Test coverage
- Documentation

Provide constructive, actionable feedback.`,
      },
      {
        role: 'user',
        content: `Review the following changes:\n\nTask: ${task}\n\nGit status:\n${JSON.stringify(repoData.gitStatus, null, 2)}\n\nRecent commits:\n${JSON.stringify(repoData.recentCommits, null, 2)}\n\nDiff:\n${repoData.diff || 'No diff available'}\n\nChanged files:\n${repoData.changedFiles || 'No files read'}`,
      },
    ];
  }
}

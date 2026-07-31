import { BaseAgent, AgentDefinition, AgentContext } from './base-agent';
import { skillRegistry } from '../skills/skill-registry';
import type { AIMessage } from '../ai/model-registry';

export class TestAgent extends BaseAgent {
  protected name = 'TestAgent';

  static definition: AgentDefinition = {
    agentType: 'test-writer',
    name: 'Test Writer',
    executionMode: 'hybrid',
    description: 'Analyzes code and test results, proposes test improvements',
    strategy: 'cheapest',
    requiredCapability: 'code',
    requiredSkills: ['file-system', 'shell-executor'],
    artifactType: 'test',
  };

  constructor() {
    super(TestAgent.definition);
  }

  protected async gatherHybridInputs(
    context: AgentContext,
    input: any
  ): Promise<any> {
    const projectPath = input?.projectPath || process.cwd();

    // Read relevant source files via file-system skill
    let sourceFiles = '';
    try {
      const packageJson = await skillRegistry.executeSkill('file-system', {
        action: 'read',
        filePath: 'package.json',
        baseDir: projectPath,
      });
      sourceFiles += `package.json:\n${packageJson}\n\n`;
    } catch {
      // package.json may not exist
    }

    // Run the test command via shell-executor skill (REAL execution)
    let testOutput = '';
    let testExitCode = 0;
    try {
      const testResult = await skillRegistry.executeSkill('shell-executor', {
        command: input?.testCommand || 'npm test',
        cwd: projectPath,
        timeout: 120000,
      });
      testOutput = testResult.stdout || testResult.stderr || '';
      testExitCode = testResult.exitCode ?? 0;
    } catch (error: any) {
      testOutput = error.message;
      testExitCode = 1;
    }

    return {
      summary: `Test run completed with exit code ${testExitCode}`,
      sourceFiles,
      testOutput: testOutput.slice(0, 10000),
      testExitCode,
      projectPath,
    };
  }

  protected buildMessages(context: AgentContext, input: any): AIMessage[] {
    const repoData = input?.repoData || {};
    const task = input?.title || input?.description || 'Test analysis';

    return [
      {
        role: 'system',
        content: `You are a test engineer analyzing test results and proposing improvements. Focus on:
- Test coverage gaps
- Failing tests and their root causes
- Edge cases that should be tested
- Test quality and maintainability
- Specific actionable fixes

Provide concrete, actionable recommendations.`,
      },
      {
        role: 'user',
        content: `Analyze the following test run:\n\nTask: ${task}\n\nTest output:\n${repoData.testOutput || 'No test output available'}\n\nExit code: ${repoData.testExitCode ?? 'unknown'}\n\nSource files:\n${repoData.sourceFiles || 'No source files read'}`,
      },
    ];
  }
}

import { skillRegistry } from './skill-registry';
import { browserUseSkill } from './browser-use';
import { droidmindSkill } from './droidmind';
import { fileSystemSkill } from './file-system';
import { apiIntegrationSkill } from './api-integration';
import { gitOperationsSkill } from './git-operations';
import { shellExecutorSkill } from './shell-executor';
import { logger } from '../utils/logger';

/**
 * Register every built-in skill, then load persisted enable/disable flags.
 * Called once during server startup.
 */
export async function initSkills(): Promise<void> {
  skillRegistry.register(browserUseSkill);
  skillRegistry.register(droidmindSkill);
  skillRegistry.register(fileSystemSkill);
  skillRegistry.register(apiIntegrationSkill);
  skillRegistry.register(gitOperationsSkill);
  skillRegistry.register(shellExecutorSkill);

  await skillRegistry.loadState();
  logger.info(`Skills initialized: ${skillRegistry.getAvailableSkills().length} registered`);
}

export { skillRegistry };

import { logger } from '../utils/logger';

export interface SkillDefinition {
  name: string;
  description: string;
  execute: (input: any) => Promise<any>;
}

class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map();

  register(skill: SkillDefinition) {
    if (this.skills.has(skill.name)) {
      logger.warn(`Skill ${skill.name} is already registered. Overwriting.`);
    }
    this.skills.set(skill.name, skill);
    logger.info(`Registered skill: ${skill.name}`);
  }

  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  getAvailableSkills(): string[] {
    return Array.from(this.skills.keys());
  }

  async executeSkill(name: string, input: any): Promise<any> {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill ${name} not found in registry.`);
    }

    try {
      logger.info(`Executing skill: ${name}`);
      return await skill.execute(input);
    } catch (error: any) {
      logger.error(`Skill ${name} execution failed:`, error);
      throw error;
    }
  }
}

export const skillRegistry = new SkillRegistry();

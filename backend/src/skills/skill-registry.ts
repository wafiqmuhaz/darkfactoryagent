import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export interface SkillDefinition {
  name: string;
  description: string;
  category: string;
  version: string;
  execute: (input: any) => Promise<any>;
  /** Skills that can act destructively start disabled and must be turned on explicitly. */
  defaultEnabled?: boolean;
  /** Shown in the UI when a skill carries real risk. */
  warning?: string;
}

export interface SkillStatus {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  version: string;
  enabled: boolean;
  builtIn: boolean;
  warning?: string;
}

const prisma = new PrismaClient();

/** Title-case a kebab-case skill name for display. */
function toDisplayName(name: string): string {
  return name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

class SkillRegistry {
  private skills = new Map<string, SkillDefinition>();
  /** In-memory mirror of the persisted enabled flags, so execute() stays synchronous-ish. */
  private enabledCache = new Map<string, boolean>();
  private loaded = false;

  register(skill: SkillDefinition) {
    if (this.skills.has(skill.name)) {
      logger.warn(`Skill ${skill.name} is already registered. Overwriting.`);
    }
    this.skills.set(skill.name, skill);
    if (!this.enabledCache.has(skill.name)) {
      this.enabledCache.set(skill.name, skill.defaultEnabled ?? true);
    }
    logger.info(`Registered skill: ${skill.name}`);
  }

  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  getAvailableSkills(): string[] {
    return Array.from(this.skills.keys());
  }

  /** Only skills that are both registered and enabled can run. */
  getEnabledSkills(): string[] {
    return this.getAvailableSkills().filter((name) => this.isEnabled(name));
  }

  isEnabled(name: string): boolean {
    const skill = this.skills.get(name);
    if (!skill) return false;
    return this.enabledCache.get(name) ?? skill.defaultEnabled ?? true;
  }

  /**
   * Load persisted enabled flags from the database, seeding rows for any
   * built-in skill that has never been stored.
   */
  async loadState(): Promise<void> {
    try {
      const rows = await prisma.skill.findMany();
      const byName = new Map(rows.map((r) => [r.name, r]));

      for (const [name, skill] of this.skills) {
        const row = byName.get(name);
        if (row) {
          this.enabledCache.set(name, row.isEnabled);
        } else {
          const enabled = skill.defaultEnabled ?? true;
          await prisma.skill.create({
            data: {
              name,
              displayName: toDisplayName(name),
              description: skill.description,
              category: skill.category,
              version: skill.version,
              isBuiltIn: true,
              isInstalled: true,
              installedAt: new Date(),
              isEnabled: enabled,
            },
          });
          this.enabledCache.set(name, enabled);
        }
      }
      this.loaded = true;
      logger.info(`Skill state loaded — enabled: ${this.getEnabledSkills().join(', ') || 'none'}`);
    } catch (error: any) {
      // Without the DB the registry still works off in-memory defaults.
      logger.warn(`Could not load skill state from database: ${error.message}`);
    }
  }

  /** Flip a skill on or off and persist the change. */
  async setEnabled(name: string, enabled: boolean): Promise<SkillStatus> {
    const skill = this.skills.get(name);
    if (!skill) throw new Error(`Skill '${name}' is not registered`);

    await prisma.skill.upsert({
      where: { name },
      update: { isEnabled: enabled },
      create: {
        name,
        displayName: toDisplayName(name),
        description: skill.description,
        category: skill.category,
        version: skill.version,
        isBuiltIn: true,
        isInstalled: true,
        installedAt: new Date(),
        isEnabled: enabled,
      },
    });

    this.enabledCache.set(name, enabled);
    logger.info(`Skill ${name} ${enabled ? 'enabled' : 'disabled'}`);
    return this.statusFor(name)!;
  }

  statusFor(name: string): SkillStatus | undefined {
    const skill = this.skills.get(name);
    if (!skill) return undefined;
    return {
      id: name,
      name,
      displayName: toDisplayName(name),
      description: skill.description,
      category: skill.category,
      version: skill.version,
      enabled: this.isEnabled(name),
      builtIn: true,
      warning: skill.warning,
    };
  }

  listStatus(): SkillStatus[] {
    return this.getAvailableSkills()
      .map((name) => this.statusFor(name)!)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async executeSkill(name: string, input: any): Promise<any> {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill ${name} not found in registry.`);
    }
    if (!this.isEnabled(name)) {
      throw new Error(`Skill '${name}' is disabled. Enable it on the Skills page to use it.`);
    }

    try {
      logger.info(`Executing skill: ${name}`);
      return await skill.execute(input);
    } catch (error: any) {
      logger.error(`Skill ${name} execution failed: ${error.message}`);
      throw error;
    }
  }

  get isLoaded(): boolean {
    return this.loaded;
  }
}

export const skillRegistry = new SkillRegistry();

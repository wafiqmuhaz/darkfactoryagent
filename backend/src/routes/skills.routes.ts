import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { skillRegistry } from '../skills';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
export const skillsRoutes = Router();

/** Scan ./skills for externally-provided skill packages (marketplace source). */
function scanSkillsDirectory(): any[] {
  const skillsDir = path.resolve(process.cwd(), '../skills');
  if (!fs.existsSync(skillsDir)) return [];

  const found: any[] = [];
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const metaPath = path.join(skillsDir, entry.name, 'meta.json');
    let meta: any = {};
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch {
        meta = {};
      }
    }

    found.push({
      name: entry.name,
      displayName: meta.displayName || entry.name,
      description: meta.description || '(no meta.json found)',
      category: meta.category || 'custom',
      version: meta.version || '1.0.0',
      author: meta.author || 'unknown',
      tags: meta.tags ?? null,
      entrypoint: meta.entrypoint || 'index.js',
      configSchema: meta.configSchema ?? null,
      source: 'filesystem',
    });
  }
  return found;
}

// GET /api/skills — every registered skill with its current enabled state
skillsRoutes.get('/', authenticate, async (_req, res) => {
  try {
    const skills = skillRegistry.listStatus();
    res.json(skills);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/skills/categories — distinct categories across registered skills
skillsRoutes.get('/categories', authenticate, async (_req, res) => {
  try {
    const categories = [...new Set(skillRegistry.listStatus().map((s) => s.category))].sort();
    res.json({ categories });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/skills/store — marketplace view: built-ins plus anything in ./skills
skillsRoutes.get('/store', authenticate, async (_req, res) => {
  try {
    const builtIns = skillRegistry.listStatus().map((s) => ({
      name: s.name,
      displayName: s.displayName,
      description: s.description,
      category: s.category,
      version: s.version,
      author: 'dark-factory',
      tags: null,
      isInstalled: true,
      isEnabled: s.enabled,
      isBuiltIn: true,
      source: 'built-in',
    }));

    const installedRows = await prisma.skill.findMany({ where: { isBuiltIn: false } });
    const known = new Set([...builtIns.map((s) => s.name), ...installedRows.map((r) => r.name)]);

    const external = installedRows.map((r) => ({
      name: r.name,
      displayName: r.displayName,
      description: r.description ?? '',
      category: r.category,
      version: r.version,
      author: r.author,
      tags: r.tags,
      isInstalled: r.isInstalled,
      isEnabled: r.isEnabled,
      isBuiltIn: false,
      source: 'database',
    }));

    const available = scanSkillsDirectory()
      .filter((s) => !known.has(s.name))
      .map((s) => ({ ...s, isInstalled: false, isEnabled: false, isBuiltIn: false }));

    const skills = [...builtIns, ...external, ...available];
    res.json({ skills, total: skills.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/skills/install — install an external skill from ./skills
skillsRoutes.post('/install', authenticate, async (req, res) => {
  try {
    const { skillName } = req.body;
    if (!skillName) return res.status(400).json({ error: 'skillName is required' });

    if (skillRegistry.getSkill(skillName)) {
      return res.status(400).json({ error: `'${skillName}' is a built-in skill — enable it on the Skills page instead.` });
    }

    const existing = await prisma.skill.findUnique({ where: { name: skillName } });
    if (existing) {
      const skill = await prisma.skill.update({
        where: { name: skillName },
        data: { isInstalled: true, installedAt: new Date() },
      });
      return res.json({ success: true, skill });
    }

    const fsSkill = scanSkillsDirectory().find((s) => s.name === skillName);
    if (!fsSkill) {
      return res.status(404).json({ error: `Skill '${skillName}' not found in the ./skills directory` });
    }

    const skill = await prisma.skill.create({
      data: {
        name: fsSkill.name,
        displayName: fsSkill.displayName,
        description: fsSkill.description,
        category: fsSkill.category,
        version: fsSkill.version,
        author: fsSkill.author,
        tags: fsSkill.tags,
        entrypoint: fsSkill.entrypoint,
        configSchema: fsSkill.configSchema ? JSON.stringify(fsSkill.configSchema) : null,
        codePath: `skills/${fsSkill.name}`,
        isBuiltIn: false,
        isInstalled: true,
        installedAt: new Date(),
      },
    });

    logger.info(`Skill installed: ${skillName}`);
    res.status(201).json({ success: true, skill });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/skills/uninstall — remove an external skill (code stays on disk)
skillsRoutes.post('/uninstall', authenticate, async (req, res) => {
  try {
    const { skillName } = req.body;
    if (!skillName) return res.status(400).json({ error: 'skillName is required' });

    if (skillRegistry.getSkill(skillName)) {
      return res.status(400).json({ error: `'${skillName}' is built in and cannot be uninstalled — disable it instead.` });
    }

    await prisma.skill.update({
      where: { name: skillName },
      data: { isInstalled: false, installedAt: null },
    });

    logger.info(`Skill uninstalled: ${skillName}`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/skills/:name/toggle — enable or disable a skill
skillsRoutes.patch('/:name/toggle', authenticate, async (req, res) => {
  try {
    const name = req.params.name as string;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: '`enabled` must be a boolean' });
    }

    // Built-in skills live in the registry; installed ones only in the database.
    if (!skillRegistry.getSkill(name)) {
      const row = await prisma.skill.findUnique({ where: { name } });
      if (!row) return res.status(404).json({ error: `Skill '${name}' not found` });

      const updated = await prisma.skill.update({ where: { name }, data: { isEnabled: enabled } });
      return res.json({
        success: true,
        skill: {
          id: updated.name,
          name: updated.name,
          displayName: updated.displayName,
          description: updated.description ?? '',
          category: updated.category,
          version: updated.version,
          enabled: updated.isEnabled,
          builtIn: false,
        },
      });
    }

    const skill = await skillRegistry.setEnabled(name, enabled);

    await prisma.activity.create({
      data: {
        type: 'skill',
        message: `Skill "${skill.displayName}" ${enabled ? 'enabled' : 'disabled'}`,
        metadata: JSON.stringify({ skill: name, enabled }),
      },
    }).catch(() => { /* activity logging is best-effort */ });

    res.json({ success: true, skill });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/skills/:name/execute — run a skill directly (disabled skills are refused)
skillsRoutes.post('/:name/execute', authenticate, async (req, res) => {
  try {
    const name = req.params.name as string;
    const result = await skillRegistry.executeSkill(name, req.body?.input ?? req.body);
    res.json({ success: true, result });
  } catch (error: any) {
    logger.warn(`Skill execution rejected/failed for ${req.params.name}: ${error.message}`);
    const status = error.message?.includes('is disabled') ? 403
      : error.message?.includes('not found') ? 404
      : 400;
    res.status(status).json({ success: false, error: error.message });
  }
});

// GET /api/skills/:name — one skill's status
skillsRoutes.get('/:name', authenticate, async (req, res) => {
  try {
    const name = req.params.name as string;
    const builtIn = skillRegistry.statusFor(name);
    if (builtIn) return res.json({ skill: builtIn });

    const row = await prisma.skill.findUnique({ where: { name } });
    if (!row) return res.status(404).json({ error: 'Skill not found' });
    res.json({ skill: { ...row, enabled: row.isEnabled, builtIn: false } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

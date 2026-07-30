import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
export const skillsRoutes = Router();

// Helper: scan ./skills directory for skill packages
function scanSkillsDirectory(): any[] {
  const skillsDir = path.resolve(process.cwd(), '../../skills');
  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  const skills: any[] = [];
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const metaPath = path.join(skillsDir, entry.name, 'meta.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          skills.push({
            name: entry.name,
            displayName: meta.displayName || entry.name,
            description: meta.description || '',
            category: meta.category || 'custom',
            version: meta.version || '1.0.0',
            author: meta.author || 'unknown',
            icon: meta.icon || null,
            tags: meta.tags || null,
            entrypoint: meta.entrypoint || 'index.js',
            config: meta.configSchema || null,
            source: 'filesystem',
          });
        } catch {
          skills.push({
            name: entry.name,
            displayName: entry.name,
            description: '(no meta.json found)',
            category: 'custom',
            version: '1.0.0',
            source: 'filesystem',
          });
        }
      } else {
        skills.push({
          name: entry.name,
          displayName: entry.name,
          description: '(no meta.json found)',
          category: 'custom',
          version: '1.0.0',
          source: 'filesystem',
        });
      }
    }
  }
  return skills;
}

// GET /api/skills — List all skills (from DB + filesystem)
skillsRoutes.get('/', authenticate, async (_req, res) => {
  try {
    const dbSkills = await prisma.skill.findMany({ orderBy: { createdAt: 'desc' } });
    const fsSkills = scanSkillsDirectory();

    // Merge: DB skills take precedence, filesystem fills gaps
    const dbNames = new Set(dbSkills.map(s => s.name));
    const merged = [...dbSkills.map(s => ({ ...s, source: 'database' }))];

    for (const fsSkill of fsSkills) {
      if (!dbNames.has(fsSkill.name)) {
        merged.push({ ...fsSkill, source: 'filesystem', isInstalled: false, isEnabled: true });
      }
    }

    res.json({ skills: merged, total: merged.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/skills/categories — List all categories
skillsRoutes.get('/categories', authenticate, async (_req, res) => {
  try {
    const dbCategories = await prisma.skill.findMany({
      select: { category: true },
      distinct: ['category'],
    });
    const fsSkills = scanSkillsDirectory();
    const fsCategories = [...new Set(fsSkills.map(s => s.category))];
    const allCategories = [...new Set([
      ...dbCategories.map(c => c.category),
      ...fsCategories,
      'browser', 'mobile', 'filesystem', 'api', 'custom',
    ])];
    res.json({ categories: allCategories });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/skills/install — Install a skill
skillsRoutes.post('/install', authenticate, async (req, res) => {
  try {
    const { skillName } = req.body;
    if (!skillName) return res.status(400).json({ error: 'skillName is required' });

    // Check if already installed
    const existing = await prisma.skill.findUnique({ where: { name: skillName } });
    if (existing) {
      await prisma.skill.update({
        where: { name: skillName },
        data: { isInstalled: true, installedAt: new Date() },
      });
      return res.json({ success: true, skill: existing, message: 'Skill installed successfully' });
    }

    // Scan filesystem for skill
    const fsSkills = scanSkillsDirectory();
    const fsSkill = fsSkills.find(s => s.name === skillName);
    if (!fsSkill) {
      return res.status(404).json({ error: `Skill '${skillName}' not found in filesystem` });
    }

    const skill = await prisma.skill.create({
      data: {
        name: fsSkill.name,
        displayName: fsSkill.displayName,
        description: fsSkill.description,
        category: fsSkill.category,
        version: fsSkill.version,
        author: fsSkill.author || 'dark-factory',
        icon: fsSkill.icon,
        tags: fsSkill.tags,
        entrypoint: fsSkill.entrypoint,
        configSchema: typeof fsSkill.config === 'object' ? JSON.stringify(fsSkill.config) : fsSkill.config,
        codePath: `skills/${fsSkill.name}`,
        isInstalled: true,
        installedAt: new Date(),
      },
    });

    logger.info(`Skill installed: ${skillName}`);
    res.status(201).json({ success: true, skill, message: 'Skill installed successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/skills/uninstall — Uninstall a skill
skillsRoutes.post('/uninstall', authenticate, async (req, res) => {
  try {
    const { skillName } = req.body;
    if (!skillName) return res.status(400).json({ error: 'skillName is required' });

    await prisma.skill.update({
      where: { name: skillName },
      data: { isInstalled: false, installedAt: null },
    });

    logger.info(`Skill uninstalled: ${skillName}`);
    res.json({ success: true, message: 'Skill uninstalled' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/skills/:name/toggle — Enable/disable a skill
skillsRoutes.patch('/:name/toggle', authenticate, async (req, res) => {
  try {
    const name = req.params.name as string;
    const { isEnabled } = req.body;
    const skill = await prisma.skill.update({
      where: { name },
      data: { isEnabled },
    });
    res.json({ success: true, skill });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/skills/:name — Get skill details
skillsRoutes.get('/:name', authenticate, async (req, res) => {
  try {
    const name = req.params.name as string;
    let skill = await prisma.skill.findUnique({ where: { name } });
    if (!skill) {
      // Check filesystem
      const fsSkills = scanSkillsDirectory();
      skill = fsSkills.find(s => s.name === name) as any;
    }
    if (!skill) return res.status(404).json({ error: 'Skill not found' });
    res.json({ skill });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
export const onboardingRoutes = Router();

// GET /api/onboarding/session — Get current onboarding session state
onboardingRoutes.get('/session', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    let session = await prisma.onboardingSession.findUnique({ where: { userId } });
    if (!session) {
      session = await prisma.onboardingSession.create({
        data: { userId, currentStep: 0 },
      });
    }
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/onboarding/company — Step 1: Create company
onboardingRoutes.post('/company', authenticate, async (req, res) => {
  try {
    const { companyName } = req.body;
    if (!companyName) return res.status(400).json({ error: 'Company name is required' });

    const userId = (req as any).user?.id;

    // Check if company already exists
    const existing = await prisma.company.findUnique({ where: { name: companyName } });
    if (existing) {
      return res.status(409).json({ error: 'Company name already exists' });
    }

    const company = await prisma.company.create({
      data: { name: companyName, mission: '' },
    });

    // Add user as company member (owner)
    await prisma.companyMember.create({
      data: { companyId: company.id, userId, role: 'owner' },
    });

    // Update onboarding session
    await prisma.onboardingSession.upsert({
      where: { userId },
      update: { companyName, currentStep: 1 },
      create: { userId, companyName, currentStep: 1 },
    });

    logger.info(`Company created: ${companyName} by user ${userId}`);
    res.status(201).json({ company });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/onboarding/mission — Step 2: Define mission
onboardingRoutes.post('/mission', authenticate, async (req, res) => {
  try {
    const { mission, mode } = req.body;
    if (!mission) return res.status(400).json({ error: 'Mission is required' });

    const userId = (req as any).user?.id;

    const session = await prisma.onboardingSession.findUnique({ where: { userId } });
    if (!session?.companyName) return res.status(400).json({ error: 'No company in progress' });

    const company = await prisma.company.update({
      where: { name: session.companyName },
      data: { mission },
    });

    await prisma.onboardingSession.update({
      where: { userId },
      data: { mission, missionMode: mode || 'i-know', currentStep: 2 },
    });

    res.json({ company });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/onboarding/agent — Step 3: Create team lead agent
onboardingRoutes.post('/agent', authenticate, async (req, res) => {
  try {
    const { agentName } = req.body;
    const name = agentName || 'Chief of Staff';
    const userId = (req as any).user?.id;

    const session = await prisma.onboardingSession.findUnique({ where: { userId } });
    if (!session?.companyName) return res.status(400).json({ error: 'No company in progress' });

    const company = await prisma.company.findUnique({ where: { name: session.companyName } });
    if (!company) return res.status(400).json({ error: 'Company not found' });

    const agent = await prisma.agent.create({
      data: {
        name,
        type: 'chief-of-staff',
        role: 'orchestrator',
        skills: JSON.stringify(['system_design', 'task_planning', 'decision_making']),
        config: JSON.stringify({
          temperature: 0.3,
          maxTokens: 4000,
          model: 'claude-sonnet-4-20250514',
        }),
        companyId: company.id,
      },
    });

    await prisma.onboardingSession.update({
      where: { userId },
      data: { agentName: name, currentStep: 3 },
    });

    logger.info(`Team lead agent created: ${name}`);
    res.status(201).json({ agent });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/onboarding/adapter — Step 4: Connect adapter
onboardingRoutes.post('/adapter', authenticate, async (req, res) => {
  try {
    const { adapterId, model } = req.body;
    if (!adapterId) return res.status(400).json({ error: 'Adapter ID is required' });

    const userId = (req as any).user?.id;
    const session = await prisma.onboardingSession.findUnique({ where: { userId } });
    if (!session?.companyName) return res.status(400).json({ error: 'No company in progress' });

    const company = await prisma.company.findUnique({ where: { name: session.companyName } });
    if (!company) return res.status(400).json({ error: 'Company not found' });

    // Record the chosen model on the lead agent's config.
    const lead = await prisma.agent.findFirst({
      where: { companyId: company.id, type: 'chief-of-staff' },
    });
    if (lead) {
      const existingConfig = lead.config ? JSON.parse(lead.config) : {};
      await prisma.agent.update({
        where: { id: lead.id },
        data: {
          adapterId,
          config: JSON.stringify({ ...existingConfig, adapterModel: model || 'auto' }),
        },
      });
    }

    await prisma.onboardingSession.update({
      where: { userId },
      data: { adapterId, adapterName: model || 'auto', currentStep: 4 },
    });

    res.json({ success: true, adapterId, model: model || 'auto' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/onboarding/review — Step 5: Complete onboarding
onboardingRoutes.post('/review', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const session = await prisma.onboardingSession.findUnique({ where: { userId } });
    if (!session) return res.status(400).json({ error: 'No onboarding session' });

    await prisma.onboardingSession.update({
      where: { userId },
      data: { completed: true, currentStep: 5 },
    });

    const company = await prisma.company.findUnique({
      where: { name: session.companyName! },
    });
    if (!company) return res.status(400).json({ error: 'Company not found' });

    // Create a default project
    const defaultProjectName = `${session.companyName}-workspace`;
    try {
      const project = await prisma.project.create({
        data: {
          name: defaultProjectName,
          description: `Default workspace for ${session.companyName}`,
          path: process.cwd(),
          ownerId: userId,
        },
      });
      await prisma.projectCompany.create({
        data: { companyId: company.id, projectId: project.id, localPath: process.cwd() },
      });
    } catch {
      // project creation is optional
    }

    // Set up default budget
    await prisma.budget.create({
      data: {
        name: `Monthly Budget - ${session.companyName}`,
        amount: 10.00,
        period: 'monthly',
        isActive: true,
      },
    });

    logger.info(`Onboarding completed for user ${userId}, company: ${session.companyName}`);
    res.json({
      success: true,
      message: 'Onboarding complete! Welcome to Dark Factory.',
      company: { name: session.companyName, mission: session.mission },
      agent: { name: session.agentName },
      adapter: { id: session.adapterId },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/onboarding/status — Check if onboarding is complete
onboardingRoutes.get('/status', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const session = await prisma.onboardingSession.findUnique({ where: { userId } });
    res.json({
      completed: session?.completed ?? false,
      currentStep: session?.currentStep ?? 0,
      session: session || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

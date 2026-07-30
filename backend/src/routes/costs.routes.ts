import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
export const costsRoutes = Router();

// GET /api/costs — Get cost summary
costsRoutes.get('/', authenticate, async (req, res) => {
  try {
    const period = req.query.period as string || 'monthly'; // daily, weekly, monthly
    const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Aggregate costs from ledger
    const ledgerEntries = await prisma.costLedger.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });

    const totalSpend = ledgerEntries.reduce((sum, e) => sum + e.amount, 0);
    const byCategory: Record<string, number> = {};
    for (const entry of ledgerEntries) {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + entry.amount;
    }

    // Get budget
    const budget = await prisma.budget.findFirst({ where: { isActive: true } });

    res.json({
      period,
      days,
      totalSpend: Math.round(totalSpend * 100) / 100,
      byCategory,
      entryCount: ledgerEntries.length,
      budget: budget ? {
        limit: budget.amount,
        used: Math.round(totalSpend * 100) / 100,
        remaining: Math.round((budget.amount - totalSpend) * 100) / 100,
        percentage: budget.amount > 0 ? Math.round((totalSpend / budget.amount) * 100) : 0,
        name: budget.name,
      } : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/costs/ledger — Get cost ledger entries
costsRoutes.get('/ledger', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const category = req.query.category as string | undefined;

    const where: any = {};
    if (category) where.category = category;

    const [entries, total] = await Promise.all([
      prisma.costLedger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.costLedger.count({ where }),
    ]);

    res.json({ entries, total, page, limit });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/costs/ledger — Add a cost entry
costsRoutes.post('/ledger', authenticate, async (req, res) => {
  try {
    const { amount, description, category, referenceId, referenceType } = req.body;
    if (!amount) return res.status(400).json({ error: 'amount is required' });

    const entry = await prisma.costLedger.create({
      data: {
        amount: parseFloat(amount),
        description,
        category: category || 'inference',
        referenceId,
        referenceType,
      },
    });

    // Check budget alerts
    await checkBudgetAlerts();

    res.status(201).json({ entry });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/costs/budgets — Get all budgets
costsRoutes.get('/budgets', authenticate, async (_req, res) => {
  try {
    const budgets = await prisma.budget.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ budgets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/costs/budgets — Create/update budget
costsRoutes.post('/budgets', authenticate, async (req, res) => {
  try {
    const { name, amount, period, alert50, alert80, alert100, isActive } = req.body;
    if (!amount) return res.status(400).json({ error: 'amount is required' });

    // Deactivate existing budgets
    if (isActive) {
      await prisma.budget.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const budget = await prisma.budget.create({
      data: {
        name: name || 'Monthly Budget',
        amount: parseFloat(amount),
        period: period || 'monthly',
        alert50: alert50 ?? true,
        alert80: alert80 ?? true,
        alert100: alert100 ?? true,
        isActive: isActive ?? true,
      },
    });

    logger.info(`Budget created: ${budget.name} — $${budget.amount}/${budget.period}`);
    res.status(201).json({ budget });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/costs/budgets/:id — Update budget
costsRoutes.put('/budgets/:id', authenticate, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { name, amount, period, alert50, alert80, alert100, isActive } = req.body;
    const budget = await prisma.budget.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(period !== undefined && { period }),
        ...(alert50 !== undefined && { alert50 }),
        ...(alert80 !== undefined && { alert80 }),
        ...(alert100 !== undefined && { alert100 }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json({ budget });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/costs/budgets/:id — Delete budget
costsRoutes.delete('/budgets/:id', authenticate, async (req, res) => {
  try {
    const id = req.params.id as string;
    await prisma.budget.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Internal: Check budget thresholds and log warnings
async function checkBudgetAlerts() {
  try {
    const budget = await prisma.budget.findFirst({ where: { isActive: true } });
    if (!budget) return;

    const since = new Date();
    if (budget.period === 'monthly') since.setMonth(since.getMonth() - 1);
    else if (budget.period === 'weekly') since.setDate(since.getDate() - 7);
    else since.setDate(since.getDate() - 30);

    const totalSpend = await prisma.costLedger.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { amount: true },
    });

    const spent = totalSpend._sum.amount || 0;
    const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

    if (budget.alert50 && percentage >= 50 && percentage < 80) {
      logger.warn(`Budget alert: 50% used ($${spent.toFixed(2)} / $${budget.amount})`);
    }
    if (budget.alert80 && percentage >= 80 && percentage < 100) {
      logger.warn(`Budget alert: 80% used ($${spent.toFixed(2)} / $${budget.amount})`);
    }
    if (budget.alert100 && percentage >= 100) {
      logger.warn(`Budget alert: 100% used ($${spent.toFixed(2)} / $${budget.amount}) — LIMIT REACHED`);
    }
  } catch {
    // best-effort
  }
}

// ─── Dark Factory — Database Seed ───────────────────────────────────
// Idempotent, non-destructive backfill. Mirrors the onboarding wizard
// (onboarding.routes.ts) so a company, an owner membership, and a
// chief-of-staff agent always exist — even when the DB is reset or a
// user skipped onboarding. Safe to run repeatedly: it upserts, never
// deletes.
//
//   npm run db:seed
//
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMPANY_NAME = 'Dark Factory';
const COMPANY_MISSION = 'Ship software with an autonomous agent team.';

// Chief-of-staff defaults, matching onboarding.routes.ts POST /agent.
const CHIEF_SKILLS = ['system_design', 'task_planning', 'decision_making'];
const CHIEF_CONFIG = {
  temperature: 0.3,
  maxTokens: 4000,
  model: '[REDACTED]',
};

async function main() {
  // 1. Anchor on a user. Prefer the earliest-created account so seeding is
  //    deterministic; without any user there is nothing to own a company.
  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!user) {
    console.log('[seed] No users found — run signup first, then re-seed. Skipping.');
    return;
  }
  console.log(`[seed] Anchoring on user ${user.email} (${user.id}).`);

  // 2. Company — unique by name, so upsert keeps this idempotent.
  const company = await prisma.company.upsert({
    where: { name: COMPANY_NAME },
    update: {},
    create: { name: COMPANY_NAME, mission: COMPANY_MISSION },
  });
  console.log(`[seed] Company "${company.name}" (${company.id}) ready.`);

  // 3. Owner membership — @@unique([companyId, userId]) gives a compound key.
  await prisma.companyMember.upsert({
    where: { companyId_userId: { companyId: company.id, userId: user.id } },
    update: {},
    create: { companyId: company.id, userId: user.id, role: 'owner' },
  });
  console.log('[seed] Owner membership ready.');

  // 4. Prefer the claude-code adapter if one exists; the agent works without it.
  const adapter = await prisma.adapter.findUnique({ where: { name: 'claude-code' } });
  if (adapter) console.log(`[seed] Linking claude-code adapter (${adapter.id}).`);
  else console.log('[seed] No claude-code adapter found — agent will have none set.');

  // 5. Chief-of-staff agent. No natural unique key beyond id, so we look one
  //    up by (company, type) to avoid creating duplicates on re-run.
  const existing = await prisma.agent.findFirst({
    where: { companyId: company.id, type: 'chief-of-staff' },
  });

  if (existing) {
    console.log(`[seed] Chief-of-staff agent "${existing.name}" (${existing.id}) already present.`);
    // Backfill an adapter link if it was missing and one is now available.
    if (!existing.adapterId && adapter) {
      await prisma.agent.update({
        where: { id: existing.id },
        data: { adapterId: adapter.id },
      });
      console.log('[seed] Backfilled adapter link on existing agent.');
    }
  } else {
    const agent = await prisma.agent.create({
      data: {
        name: 'Chief of Staff',
        type: 'chief-of-staff',
        role: 'orchestrator',
        title: 'Chief of Staff',
        skills: JSON.stringify(CHIEF_SKILLS),
        config: JSON.stringify(CHIEF_CONFIG),
        trustPreset: 'elevated',
        canCreateAgents: true,
        canManageSkills: true,
        canAssignTasks: true,
        isActive: true,
        companyId: company.id,
        adapterId: adapter?.id ?? null,
      },
    });
    console.log(`[seed] Created chief-of-staff agent "${agent.name}" (${agent.id}).`);
  }

  console.log('[seed] Done.');
}

main()
  .catch((err) => {
    console.error('[seed] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

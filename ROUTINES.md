# 🔄 Routines — Recurring Task Definitions

## Overview

Routines are scheduled, recurring tasks that execute automatically. They use `node-cron` for scheduling and support timezone configuration.

---

## Routine Schema

```prisma
model Routine {
  id            String    @id @default(uuid())
  name          String
  description   String?
  schedule      String                   // Cron expression (e.g., "0 21 * * *")
  timezone      String   @default("UTC")
  taskTemplate  String?                  // JSON template for task creation
  projectId     String   @map("project_id")
  agentId       String?  @map("agent_id")
  skillId       String?  @map("skill_id")
  isActive      Boolean  @default(true)  @map("is_active")
  lastRunAt     DateTime? @map("last_run_at")
  nextRunAt     DateTime? @map("next_run_at")
  runCount      Int      @default(0)     @map("run_count")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt      @map("updated_at")
  runs          RoutineRun[]
}
```

### Routine Run History

```prisma
model RoutineRun {
  id         String   @id @default(uuid())
  status     String   @default("pending") // pending, running, completed, failed
  output     String?                      // JSON result
  error      String?
  duration   Int      @default(0)         // Duration in seconds
  startedAt  DateTime? @map("started_at")
  completedAt DateTime? @map("completed_at")
  createdAt  DateTime @default(now()) @map("created_at")

  routineId  String   @map("routine_id")
  routine    Routine  @relation(fields: [routineId], references: [id], onDelete: Cascade)
}
```

---

## API Endpoints

### `GET /api/routines`
List all routines with last run info.

### `POST /api/routines`
Create a new routine.
```json
{
  "name": "Nightly Build",
  "description": "Run nightly pipeline for active project",
  "schedule": "0 21 * * *",
  "timezone": "UTC",
  "projectId": "uuid-here",
  "agentId": "chief-of-staff",
  "taskTemplate": {
    "title": "Nightly: {{date}}",
    "description": "Automated nightly build and test run",
    "priority": "high",
    "type": "maintenance"
  },
  "isActive": true
}
```

### `PUT /api/routines/:id`
Update routine settings.

### `DELETE /api/routines/:id`
Delete routine and its history.

### `POST /api/routines/:id/trigger`
Trigger routine manually (bypasses cron schedule).

### `POST /api/routines/:id/toggle`
Toggle active/inactive.

### `GET /api/routines/:id/runs`
Get run history for a routine.

---

## Built-in Routines

| Name | Schedule | Description |
|------|----------|-------------|
| Nightly Build | `0 21 * * *` (9 PM daily) | Run full pipeline on active projects |
| Weekly Report | `0 9 * * 1` (9 AM Monday) | Generate weekly summary |
| Budget Check | `0 8,18 * * *` (8 AM & 6 PM) | Check cost budgets and send alerts |
| Daily Standup Prep | `30 8 * * 1-5` (8:30 AM weekdays) | Prepare daily standup summary |

---

## Scheduler Service

Located at `backend/src/orchestrator/routine-scheduler.ts`:

```typescript
class RoutineSchedulerService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  async start() {
    const routines = await prisma.routine.findMany({ where: { isActive: true } });
    for (const routine of routines) {
      this.scheduleRoutine(routine);
    }
  }

  scheduleRoutine(routine: Routine) {
    const job = cron.schedule(routine.schedule, async () => {
      await this.executeRoutine(routine.id);
    }, { timezone: routine.timezone || 'UTC' });
    this.jobs.set(routine.id, job);
  }

  async executeRoutine(routineId: string) {
    // Create task from template, assign to agent, log run
  }
}
```

---

## Frontend Components

### Routines Page
- **List** — card grid showing each routine with name, schedule, status toggle, last run
- **Create** — modal with form: name, description, cron input (with helper), timezone, project, agent, task template
- **Detail** — expandable row showing run history table (timestamp, status, duration)
- **Manual Trigger** — button to run immediately

### Cron Helper
- Preset buttons: "Every hour", "Every 6 hours", "Daily at 9 PM", "Weekly Monday 9 AM"
- Human-readable preview: "Daily at 21:00 UTC"
- Next run prediction shown

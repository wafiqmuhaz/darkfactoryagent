-- CreateTable
CREATE TABLE "agent_config_revisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'config',
    "summary" TEXT,
    "snapshot" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agent_id" TEXT NOT NULL,
    "created_by" TEXT,
    CONSTRAINT "agent_config_revisions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_agent_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "trigger" TEXT NOT NULL DEFAULT 'assignment',
    "input" TEXT,
    "output" TEXT,
    "logs" TEXT,
    "error" TEXT,
    "stop_reason" TEXT,
    "exit_code" INTEGER,
    "adapter" TEXT,
    "model" TEXT,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost" REAL NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "task_id" TEXT,
    "project_id" TEXT,
    "agent_id" TEXT,
    CONSTRAINT "agent_runs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "agent_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "agent_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_agent_runs" ("agent_type", "completed_at", "cost", "created_at", "duration", "error", "id", "input", "logs", "output", "project_id", "started_at", "status", "task_id", "tokens_used") SELECT "agent_type", "completed_at", "cost", "created_at", "duration", "error", "id", "input", "logs", "output", "project_id", "started_at", "status", "task_id", "tokens_used" FROM "agent_runs";
DROP TABLE "agent_runs";
ALTER TABLE "new_agent_runs" RENAME TO "agent_runs";
CREATE INDEX "agent_runs_agent_type_status_idx" ON "agent_runs"("agent_type", "status");
CREATE INDEX "agent_runs_agent_id_created_at_idx" ON "agent_runs"("agent_id", "created_at");
CREATE TABLE "new_agents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'chief-of-staff',
    "role" TEXT,
    "title" TEXT,
    "instructions" TEXT,
    "skills" TEXT,
    "config" TEXT,
    "trust_preset" TEXT DEFAULT 'standard',
    "can_create_agents" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_skills" BOOLEAN NOT NULL DEFAULT false,
    "can_assign_tasks" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "company_id" TEXT NOT NULL,
    "adapter_id" TEXT,
    "manager_id" TEXT,
    CONSTRAINT "agents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agents_adapter_id_fkey" FOREIGN KEY ("adapter_id") REFERENCES "adapters" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "agents_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "agents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_agents" ("adapter_id", "company_id", "config", "created_at", "id", "is_active", "name", "role", "skills", "type", "updated_at") SELECT "adapter_id", "company_id", "config", "created_at", "id", "is_active", "name", "role", "skills", "type", "updated_at" FROM "agents";
DROP TABLE "agents";
ALTER TABLE "new_agents" RENAME TO "agents";
CREATE TABLE "new_budgets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Monthly Budget',
    "amount" REAL NOT NULL DEFAULT 10.00,
    "period" TEXT NOT NULL DEFAULT 'monthly',
    "start_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "alert_50" BOOLEAN NOT NULL DEFAULT true,
    "alert_80" BOOLEAN NOT NULL DEFAULT true,
    "alert_100" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "agent_id" TEXT,
    CONSTRAINT "budgets_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_budgets" ("alert_100", "alert_50", "alert_80", "amount", "created_at", "endDate", "id", "is_active", "name", "period", "start_date", "updated_at") SELECT "alert_100", "alert_50", "alert_80", "amount", "created_at", "endDate", "id", "is_active", "name", "period", "start_date", "updated_at" FROM "budgets";
DROP TABLE "budgets";
ALTER TABLE "new_budgets" RENAME TO "budgets";
CREATE INDEX "budgets_agent_id_idx" ON "budgets"("agent_id");
CREATE TABLE "new_cost_ledger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'inference',
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_tokens" INTEGER NOT NULL DEFAULT 0,
    "reference_id" TEXT,
    "reference_type" TEXT,
    "agent_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_cost_ledger" ("amount", "category", "created_at", "currency", "description", "id", "reference_id", "reference_type") SELECT "amount", "category", "created_at", "currency", "description", "id", "reference_id", "reference_type" FROM "cost_ledger";
DROP TABLE "cost_ledger";
ALTER TABLE "new_cost_ledger" RENAME TO "cost_ledger";
CREATE INDEX "cost_ledger_agent_id_created_at_idx" ON "cost_ledger"("agent_id", "created_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "agent_config_revisions_agent_id_created_at_idx" ON "agent_config_revisions"("agent_id", "created_at");

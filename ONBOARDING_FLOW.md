# 🚀 Onboarding Flow — Paperclip.ai Aligned

## Overview

The onboarding wizard guides solo developers through setting up their Dark Factory instance, mirroring the Paperclip.ai flow: **Build a new company** → **Define mission** → **Create team lead** → **Connect a model** → **Review & get started**.

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │                    ONBOARDING WIZARD                                │
 ├─────────────────────────────────────────────────────────────────────┤
 │  Step 1         Step 2          Step 3          Step 4     Step 5  │
 │ ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌────────┐ ┌──────┐  │
 │ │  Build  │→  │  Define  │→  │  Create   │→  │Connect │→ │Review│  │
 │ │ Company │   │ Mission  │   │ Team Lead │   │ Model  │   │      │  │
 │ └─────────┘   └──────────┘   └───────────┘   └────────┘ └──────┘  │
 └─────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Flow

### Step 1: Build a New Company

**UI Mockup:**
```
┌──────────────────────────────────────────────────────────┐
│ 🔧 Build a New Company                                    │
│                                                           │
│ Company name: [________________________]                  │
│                      e.g. "Acme Software"                 │
│                                                           │
│ [Continue →]                                              │
└──────────────────────────────────────────────────────────┘
```

- User provides a **company name** (e.g., "Acme Software")
- System validates uniqueness and creates a local company record
- Company name is used across the dashboard header and settings
- **Backend:** `POST /api/onboarding/company` → creates `Company` record

### Step 2: Define Your Mission

**UI:**
```
┌──────────────────────────────────────────────────────────┐
│ 🎯 Define Your Mission                                    │
│                                                           │
│ [ ] I know my mission                                     │
│     → Show text input: [________________________]         │
│                                                           │
│ [ ] Help me figure it out                                 │
│     → "What kind of projects do you build?"               │
│     → "What's your main tech stack?"                      │
│     → "What problem are you solving?"                     │
│                                                           │
│ Mission: [________________________________________]      │
│                                                           │
│ [← Back]  [Continue →]                                    │
└──────────────────────────────────────────────────────────┘
```

- Two paths: "I know my mission" (direct text input) or "Help me figure it out" (guided questions → AI generates mission statement)
- Mission is stored and used to set agent context and project goals
- **Backend:** `POST /api/onboarding/mission` → creates/updates `Mission` record

### Step 3: Create Your Team Lead

**UI:**
```
┌──────────────────────────────────────────────────────────┐
│ 👤 Create Your Team Lead                                  │
│                                                           │
│ The Team Lead (Chief of Staff) orchestrates all agents.   │
│                                                           │
│ Agent name: [Chief of Staff_________]                     │
│                                                           │
│ Role: Orchestrator — manages task decomposition,          │
│       agent assignments, and quality control.             │
│                                                           │
│ Skills: system_design, task_planning, decision_making     │
│                                                           │
│ [← Back]  [Continue →]                                    │
└──────────────────────────────────────────────────────────┘
```

- Default agent "Chief of Staff" (renameable)
- Role description shown
- Skills listed (pre-configured per agent type)
- **Backend:** `POST /api/onboarding/agent` → creates `Agent` record with type `chief-of-staff`

### Step 4: Connect a Model (Adapter Selection)

**UI:**
```
┌──────────────────────────────────────────────────────────┐
│ 🔌 Connect a Model                                        │
│                                                           │
│ Select adapter:                                           │
│                                                           │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ ○ Claude Code CLI    🟢 Ready   [Test now]           │  │
│ │   Local CLI for Anthropic Claude                     │  │
│ ├──────────────────────────────────────────────────────┤  │
│ │ ○ Codex              ⚪ Not tested  [Test now]       │  │
│ │   OpenAI Codex CLI for code generation               │  │
│ ├──────────────────────────────────────────────────────┤  │
│ │ ○ Gemini CLI         ⚪ Not configured               │  │
│ ├──────────────────────────────────────────────────────┤  │
│ │ ○ Hermes             ⚪ Not configured               │  │
│ ├──────────────────────────────────────────────────────┤  │
│ │ ○ Ollama (Local)     ⚪ Not configured               │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                           │
│ [← Back]  [Continue →]                                    │
└──────────────────────────────────────────────────────────┘
```

- Adapter list with status indicators: 🟢 Ready, 🟡 Warning, 🔴 Error, ⚪ Not tested
- "Test now" button triggers `POST /api/adapters/probe` with adapter ID
- Probe checks:
  - CLI installed (`which claude`, `which codex`)
  - Version compatibility (`claude --version`, `codex --version`)
  - API key validity (if applicable)
  - Network connectivity (for remote APIs)
- Result displayed inline with clear pass/fail message

### Step 5: Review & Get Started

**UI:**
```
┌──────────────────────────────────────────────────────────┐
│ ✅ Review Your Setup                                      │
│                                                           │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ Company:  Acme Software                              │  │
│ │ Mission:  Build developer tools for solo devs        │  │
│ │ Lead:     Chief of Staff                             │  │
│ │ Model:    Claude Code CLI (claude v0.8.0) — Ready    │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                           │
│ [Edit]                              [Get Started →]       │
└──────────────────────────────────────────────────────────┘
```

- Summary of all settings
- "Edit" links back to previous steps
- "Get started" finalizes onboarding → transitions to Dashboard
- **Backend:** `POST /api/onboarding/review` → finalizes setup, creates project

---

## State Persistence

- Wizard state persists in `localStorage` (frontend) and `OnboardingSession` (backend)
- If user exits mid-flow, resume from last completed step on next visit
- Backend stores partial state in `OnboardingSession` model

## Data Models

### Company
```prisma
model Company {
  id        String   @id @default(uuid())
  name      String   @unique
  mission   String?
  createdAt DateTime @default(now())
}
```

### Agent
```prisma
model Agent {
  id         String   @id @default(uuid())
  name       String
  type       String                  // chief-of-staff, spec-writer, code-writer, etc.
  role       String?
  skills     String?                 // JSON array of skill IDs
  config     String?                 // JSON config (temperature, maxTokens, etc.)
  adapterId  String?                 // Connected adapter
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  companyId  String
}
```

### Adapter
```prisma
model Adapter {
  id          String   @id @default(uuid())
  name        String   @unique       // "claude-code", "codex", etc.
  displayName String
  type        String                  // "cli", "api"
  command     String?                 // CLI command path
  envVars     String?                 // JSON of required env vars
  isConnected Boolean  @default(false)
  lastProbeAt DateTime?
  probeStatus String?                 // "ready", "error", "not_tested"
  probeError  String?
  createdAt   DateTime @default(now())
}
```

# 🏭 Dark Factory — AI Agent System for Solo Developers

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.7-3178c6.svg)
![React](https://img.shields.io/badge/react-19-61dafb.svg)
![Docker](https://img.shields.io/badge/docker-compose-2496ed.svg)

Dark Factory is a **local-first, mission-driven AI development factory**. You describe a company
and a mission, the system creates a team lead agent, and every task you drop on the board is
executed by a real coding CLI (Claude Code or Codex) running on your own machine — with the
queue, cost ledger, activity log, and artifacts all stored locally.

There is no hosted orchestrator. The database is SQLite on disk, the queue is a local Redis, and
the model is reached through a CLI adapter that reuses the credentials already on your machine.

---

## Table of Contents

- [Interface Tour](#interface-tour)
- [The Paperclip.ai Workflow](#the-paperclipai-workflow)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [First-Time Setup](#first-time-setup)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Pages Reference](#pages-reference)
- [Agent Architecture](#agent-architecture)
- [Adapters](#adapters)
- [Skills](#skills)
- [Routines](#routines)
- [Cost Management](#cost-management)
- [API Reference](#api-reference)
- [WebSocket Events](#websocket-events)
- [Data Model](#data-model)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Interface Tour

### Dashboard

The landing page after login. It shows the company name and mission as the header, four quick
action tiles (Task Board, Routines, Costs, Activity), four stat cards (Total Tasks, In Progress,
Failed, Monthly Spend), a live **Recent Activity** feed, and the **Active Adapter** panel with
current run, last run, and queue counters (Waiting / Active / Failed jobs). Everything refreshes
over WebSocket as tasks are created, updated, or completed.

![Dashboard](assets/docs/dashboard.png)

### Task Board

A six-column Kanban board: **Backlog → To Do → In Progress → Review → Done → Needs Recovery**.
Cards carry a priority, an assigned agent, and a project scope. Moving a card changes task status
through `PATCH /api/tasks/:id/status`; running a card enqueues it on the BullMQ task queue.

![Task Board](assets/docs/task_board.png)

### Agents

Your company roster on top — each row shows the agent name, status badge, role/title, adapter,
model, run count, success rate, and total spend — then the instance-wide adapter panel below with
runtime detection, last probe time, and a **Test now** button. Clicking a roster row opens that
agent's detail tabs (Dashboard, Runs, Instructions, Skills, Configuration, Budget).

![Agent Status](assets/docs/agent_status.png)

### Activity

A filterable timeline of every event the system emits: task created, task status changed, task
success/failure, agent runs, adapter probes, skill executions, and errors. Each entry is typed and
colour-coded, and the feed is backed by the `Activity` table via `GET /api/activities`.

![Activity](assets/docs/activity.png)

### Projects

Local repository management. A project points at a real directory on your machine (validated with
`POST /api/projects/validate-path`) so adapters can execute with the correct `cwd`. Projects scope
the dashboard metrics, the task board, and the WebSocket rooms.

![Projects](assets/docs/projects.png)

### Skills

The installed-skill inventory. Every skill can be toggled on/off per instance, inspected for its
declared category and parameters, or executed ad hoc through
`POST /api/skills/:name/execute` for testing.

![Skills](assets/docs/skills.png)

### Skills Store

Browse the catalog by category and install skills into your instance. Installing writes a `Skill`
row and makes the skill available to every agent whose skill list includes it.

![Skills Store](assets/docs/skill_store.png)

---

## The Paperclip.ai Workflow

```
 ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
 │  Build   │→  │  Define  │→  │  Create  │→  │  Connect │→  │  Review  │
 │  Company │   │  Mission │   │  Team    │   │  Model   │   │  & Start │
 │          │   │          │   │  Lead    │   │          │   │          │
 └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
   step 1          step 2         step 3         step 4         step 5
```

Onboarding is a five-step wizard, and each step persists to `OnboardingSession` so you can close
the tab and resume where you left off (`GET /api/onboarding/session`).

| Step | Endpoint | What it creates |
|------|----------|-----------------|
| 1. Build a New Company | `POST /api/onboarding/company` | `Company` + `CompanyMember` with role `owner` |
| 2. Define Your Mission | `POST /api/onboarding/mission` | Sets `company.mission`; `missionMode` is `i-know` or AI-guided |
| 3. Create Your Team Lead | `POST /api/onboarding/agent` | `Agent` of type `chief-of-staff`, role `orchestrator` |
| 4. Connect a Model | `POST /api/onboarding/adapter` | Stores `adapterId` + `adapterModel` on the lead agent config |
| 5. Review & Get Started | `POST /api/onboarding/review` | Marks complete, creates `<company>-workspace` project and a $10/month budget |

The team lead is seeded with skills `system_design`, `task_planning`, `decision_making` and a
config of `{ temperature: 0.3, maxTokens: 4000 }`. Before finishing step 4 you can press
**Test now** to probe the adapter, so onboarding never completes against a CLI that isn't installed.

---

## Architecture

```
                       ┌──────────────────────────────┐
                       │  Browser (React 19 + Vite)   │
                       │  :3000 (docker) / :5173 dev  │
                       └───────────────┬──────────────┘
                                       │ REST + WebSocket
                       ┌───────────────▼──────────────┐
                       │  nginx api-gateway  :3001    │
                       │  700s proxy timeouts         │
                       └───────────────┬──────────────┘
                                       │
             ┌─────────────────────────┴────────────────────────┐
             │                                                  │
   ┌─────────▼──────────┐                          ┌────────────▼───────────┐
   │  backend-api       │                          │  backend-worker  x2    │
   │  PROCESS_MODE=api  │                          │  PROCESS_MODE=worker   │
   │  routes + socket.io│                          │  BullMQ consumer       │
   └─────────┬──────────┘                          └────────────┬───────────┘
             │                                                  │
             ├──────────────► Redis 7 (BullMQ queue) ◄──────────┤
             │                                                  │
             ├──────────────► SQLite via Prisma ◄───────────────┤
             │                                                  │
             └──────────────► Adapter CLI (claude / codex) ◄─────┘
                                  executes in your repo cwd
```

### Process modes

`backend/src/index.ts` reads `PROCESS_MODE` and boots only what that role needs:

| Mode | Mounts HTTP routes | Starts WebSocket | Starts BullMQ worker |
|------|--------------------|------------------|----------------------|
| `monolith` (default) | yes | yes | yes |
| `api` | yes | yes | no |
| `worker` | no | no | yes |

`GET /api/health` echoes the active mode, which makes it easy to confirm which container you hit:

```json
{ "status": "ok", "mode": "api", "timestamp": "2026-01-01T00:00:00.000Z" }
```

### Request path

1. The React app calls `VITE_API_URL` (default `http://localhost:3001/api`).
2. nginx re-resolves `backend-api` per request (`resolver 127.0.0.11`) so container restarts don't
   leave a stale upstream, and holds connections open for up to 700s because adapter CLI runs can
   take minutes.
3. `backend-api` authenticates the JWT, writes an audit-log entry and a `datalake` event, then
   handles the route.
4. Task execution is pushed onto the BullMQ `task` queue instead of running inline.
5. `backend-worker` picks it up, invokes the adapter CLI in the project directory, streams progress
   over WebSocket, and records an `AgentRun`, a `CostLedger` entry, and `Activity` rows.

### Security middleware

`helmet`, `cors` restricted to `config.frontendUrl` with credentials, `express-rate-limit` on all
`/api` traffic, JWT bearer auth on every route except `/api/auth/register`, `/api/auth/login`, and
the webhook/OAuth callbacks, plus an `auditLogger` that records mutating requests.

<!-- CHUNK -->

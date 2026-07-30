# 🔌 Adapter Integration — Claude Code CLI & Codex

## Overview

Adapters give agents a single way to run work through different CLI harnesses. Each adapter extends `BaseAdapter`, which handles runtime detection, the live probe, and task execution; the adapter itself only declares its binary name, argv shape, and pricing.

```
 ┌───────────────────────────────────────────────────────────┐
 │                    ADAPTER LAYER                           │
 ├───────────────────────────────────────────────────────────┤
 │  ┌─────────────┐  ┌─────────────┐                         │
 │  │ Claude Code │  │   Codex     │   ← declare argv + cost  │
 │  └──────┬──────┘  └──────┬──────┘                         │
 │         │                │                                 │
 │  ┌──────▼────────────────▼──────────────────────────────┐  │
 │  │                  BaseAdapter                          │  │
 │  │  detectRuntime()  local PATH → docker ps → none      │  │
 │  │  probe()          version + live "hello" round-trip   │  │
 │  │  execute(task)    runs in the project's cwd           │  │
 │  └───────────────────────────────────────────────────────┘  │
 │         │                                                   │
 │  ┌──────▼──────────────────────────────────────────────┐   │
 │  │ AdapterManager — registry + executeWithFallback()    │   │
 │  └──────────────────────────────────────────────────────┘   │
 └───────────────────────────────────────────────────────────┘
```

---

## Runtime detection (local vs Docker)

The probe never assumes where the CLI lives. `detectRuntime()` checks, in order:

1. **Host PATH** — `command -v claude` / `command -v codex`. Result: `runtime: "local"`.
2. **Running containers** — `docker ps`, then `docker exec <name> sh -lc 'command -v <cli>'` for each. First hit wins. Result: `runtime: "docker"`, with the container name recorded.
3. **Neither** — `runtime: "none"`, and the probe returns an install hint instead of a generic failure.

When the CLI is only in a container, every subsequent command is wrapped:

```
docker exec -w <project path> <container> sh -lc '<cli> …'
```

The backend image installs both CLIs directly (see `backend/Dockerfile`), so in Docker Compose mode the adapters resolve as `local` *inside* the backend container. The container-scanning path covers setups where the CLIs live in a separate sidecar instead.

---

## The live probe ("Test now")

A probe reports `ready` only when the CLI actually answered — not merely when the binary exists.

| Step | What runs | Failure handling |
|------|-----------|------------------|
| 1. Locate | `command -v <cli>`, then container scan | `none` → install hint |
| 2. Version | `<cli> --version` | informational only; never fails the probe |
| 3. Live check | one-shot prompt: *"Respond with exactly the single word: hello"* | any error → `status: error` with a mapped message |

Two details make this reliable:

- **stdin is closed** (`< /dev/null`). Codex reads stdin when no prompt is detected, which otherwise hangs the probe until timeout.
- **The answer is read from a file, not scraped from stdout**, for CLIs that stream progress logs. An adapter puts `OUTPUT_FILE_TOKEN` in its argv and `BaseAdapter` substitutes a temp path, reads it back, and deletes it.

Probes run **read-only**. Only real task execution passes `allowWrites: true`.

### Response shape

```json
{
  "status": "ready",
  "version": "2.0.71 (Claude Code)",
  "path": "/opt/homebrew/bin/claude",
  "runtime": "local",
  "message": "Claude Code v2.0.71 responded via local.",
  "helloResponse": "hello",
  "models": ["auto", "opus", "sonnet", "haiku"]
}
```

On failure the same shape carries `error`, a human-readable `message`, and `installHint`.

---

## Adapter reference

| | Claude Code | Codex |
|---|---|---|
| Binary | `claude` | `codex` |
| One-shot mode | `claude -p <prompt>` | `codex exec <prompt>` |
| Answer channel | stdout | `-o <file>` |
| System prompt | `--append-system-prompt` | prepended to the prompt |
| Model flag | `--model` | `--model` |
| Write access | `--permission-mode acceptEdits --add-dir <cwd>` | `--sandbox workspace-write` |
| Read-only | default | `--sandbox read-only` |
| Install | `npm i -g @anthropic-ai/claude-code` | `npm i -g @openai/codex` |

Models are listed per adapter with `auto` first, which lets the CLI pick its own default.

---

## Task execution

`TaskExecutionService.executeTask(taskId)` is the path from a board card to a code change:

```
 task created ──→ BullMQ "adapter-exec" ──→ TaskExecutionService
                        │ (Redis down? runs inline instead)
                        ▼
        budget check ──→ AgentRun(running) ──→ adapter CLI in project.path
                        │
                        ▼
        artifact + CostLedger + Activity ──→ task status: review | failed
```

- The CLI's working directory is the project's `path`, so the agent edits the real repository.
- `allowWrites: true` is set here and only here.
- The reply is stored as an `Artifact` attached to the task, so it is visible in the UI.
- Token counts are estimated from character length (CLI harnesses do not report usage), and the cost is written to `CostLedger`.
- If the active budget is already exhausted, the task is failed before any spend occurs.

---

## Error mapping

Raw CLI stderr is noisy — banners, `workdir:` lines, reconnect spam. `extractFailureLine()` strips that preamble and picks the line that actually explains the failure, then `describeCliFailure()` maps it:

| Signal in stderr | Message shown to the user |
|---|---|
| `402`, `insufficient balance`, `insufficient_quota` | insufficient balance or quota — top up or switch adapters |
| `401`, `unauthorized`, `invalid api key`, `not logged in` | re-authenticate the CLI (`claude login` / `codex login`) or update the key in Settings → Secrets |
| `429`, `rate limit` | rate limited — retry or switch adapters |
| `econnrefused`, `error sending request`, `stream disconnected` | cannot reach the configured API endpoint — check the CLI's provider config |
| `etimedout`, `sigterm` | timed out — raise the timeout or check the network |
| `enotfound`, `network` | cannot resolve the API host |
| command not found | install hint for that adapter |

---

## Fallback

`AdapterManager.executeWithFallback(preferredId, task)` tries the project's adapter first, then every other registered adapter in turn. The result reports `adapterUsed` and `fellBack`, and the activity log records the substitution so a silent switch is never invisible.

| Primary | Falls back to |
|---------|---------------|
| Claude Code | Codex |
| Codex | Claude Code |

---

## Configuration

```env
ADAPTER_DEFAULT=claude-code   # used when a project has no adapter set
```

Per-project overrides live on the `Project` record (`adapterType`, `adapterModel`) and are set in the project wizard's "Connect a model" step.

In Docker Compose mode, host CLI credentials are shared into the containers:

```yaml
volumes:
  - ${HOME}/.claude:/root/.claude
  - ${HOME}/.codex:/root/.codex
environment:
  - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
  - OPENAI_API_KEY=${OPENAI_API_KEY:-}
```

Project paths must also be mounted into the backend container, or the CLI will run against a directory that does not exist inside it.


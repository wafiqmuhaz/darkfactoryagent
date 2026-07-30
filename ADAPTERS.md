# 🔌 Adapter Integration — Claude Code CLI & Codex

## Overview

Adapters provide a unified interface for executing AI agent tasks through different backends. Each adapter implements the `BaseAdapter` interface with `probe()`, `execute()`, and `getModels()` methods.

```
 ┌───────────────────────────────────────────────────────────┐
 │                    ADAPTER LAYER                           │
 ├───────────────────────────────────────────────────────────┤
 │                                                           │
 │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
 │  │ Claude Code │  │   Codex     │  │  Other Adapters  │  │
 │  │   Adapter   │  │  Adapter    │  │  (Gemini, etc.)  │  │
 │  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
 │         │                │                   │           │
 │  ┌──────▼────────────────▼───────────────────▼────────┐  │
 │  │                BaseAdapter Interface                │  │
 │  │  probe(): ProbeResult                              │  │
 │  │  execute(task): ExecutionResult                     │  │
 │  │  getModels(): string[]                              │  │
 │  └─────────────────────────────────────────────────────┘  │
 │                                                           │
 └───────────────────────────────────────────────────────────┘
```

---

## Supported Adapters

| Adapter | Type | Command | Probe Method |
|---------|------|---------|-------------|
| Claude Code CLI | CLI | `claude` | `claude --version` |
| Codex | CLI | `codex` | `codex --version` |
| Gemini CLI | CLI | `gemini` | `which gemini` |
| Hermes | CLI | `hermes` | Accessible via Claude Code |
| Ollama | API | N/A | `curl localhost:11434` |
| OpenCode | CLI | `opencode` | `which opencode` |
| Cursor | API | N/A | Check config |

---

## Claude Code CLI Adapter

### Location: `backend/src/adapters/claude-code/`

### Probe Implementation
```typescript
// Probe checks:
// 1. CLI installed: which claude
// 2. Version: claude --version
// 3. Can respond: claude --print "hello"
// 4. API access: claude list-models (or similar)

export class ClaudeCodeAdapter extends BaseAdapter {
  async probe(): Promise<ProbeResult> {
    try {
      const whichResult = execSync('which claude', { encoding: 'utf8' });
      const versionResult = execSync('claude --version', { encoding: 'utf8' });
      const helloResult = execSync('echo "hello" | claude --print -', { 
        encoding: 'utf8', 
        timeout: 30000 
      });

      return {
        status: 'ready',
        version: versionResult.trim(),
        path: whichResult.trim(),
        message: `Claude Code CLI v${versionResult.trim()} ready`,
      };
    } catch (error: any) {
      return {
        status: 'error',
        version: null,
        path: null,
        message: `Claude CLI not found or not responding: ${error.message}`,
        error: error.message,
      };
    }
  }

  async execute(task: AdapterTask): Promise<ExecutionResult> {
    // Execute a task through Claude Code CLI
    const prompt = buildPrompt(task);
    const result = execSync(`echo "${escape(prompt)}" | claude --print -`, {
      encoding: 'utf8',
      timeout: 120000,
    });

    return {
      success: true,
      output: result,
      tokenUsage: { input: 0, output: 0 }, // estimate or parse
    };
  }
}
```

### Error Handling
| Error | Cause | Recovery |
|-------|-------|----------|
| `CLI not found` | `claude` not in PATH | Prompt to install (`npm i -g @anthropic-ai/claude-code`) |
| `402 insufficient balance` | API quota exhausted | Display error, suggest fallback adapter |
| `Command timeout` | Task too long | Increase timeout, or split task |
| `Authorization error` | API key invalid | Re-enter API key in Settings |

---

## Codex CLI Adapter

### Location: `backend/src/adapters/codex/`

### Probe Implementation
```typescript
export class CodexAdapter extends BaseAdapter {
  async probe(): Promise<ProbeResult> {
    try {
      const whichResult = execSync('which codex', { encoding: 'utf8' });
      const versionResult = execSync('codex --version', { encoding: 'utf8' });

      return {
        status: 'ready',
        version: versionResult.trim(),
        path: whichResult.trim(),
        message: `Codex CLI v${versionResult.trim()} ready`,
      };
    } catch (error: any) {
      return {
        status: 'error',
        version: null,
        path: null,
        message: `Codex CLI not found: ${error.message}`,
        error: error.message,
      };
    }
  }
}
```

### Environment Variables
```env
# Codex Configuration
CODEX_API_KEY=           # Optional, uses default auth if empty
CODEX_MODEL=gpt-4o       # Model override
CODEX_TIMEOUT=120000     # Execution timeout in ms
```

---

## Probe API

### `POST /api/adapters/probe`

```json
{
  "adapterId": "claude-code",
  "timeout": 30000
}
```

**Response (Success):**
```json
{
  "status": "ready",
  "version": "0.8.0",
  "path": "/usr/local/bin/claude",
  "message": "Claude Code CLI v0.8.0 ready",
  "models": ["claude-sonnet-4", "claude-haiku-3.5"]
}
```

**Response (Error):**
```json
{
  "status": "error",
  "version": null,
  "path": null,
  "message": "Claude CLI not found. Install with: npm i -g @anthropic-ai/claude-code",
  "error": "Command failed: which claude"
}
```

---

## Execution Flow

```
 ┌──────────┐    ┌───────────┐    ┌──────────────┐    ┌────────────┐
 │   Task    │───→│  Adapter  │───→│  CLI/Process │───→│  Result    │
 │  Created  │    │  Manager  │    │  Execution   │    │  Parsed    │
 └──────────┘    └───────────┘    └──────────────┘    └────────────┘
                      │                   │                   │
                      ▼                   ▼                   ▼
                 ┌──────────┐      ┌──────────────┐     ┌──────────┐
                 │  Probe   │      │  stdout/     │     │ Cost     │
                 │  Check   │      │  stderr      │     │ Tracked  │
                 └──────────┘      └──────────────┘     └──────────┘
```

---

## Fallback Strategy

| Primary | Fallback 1 | Fallback 2 |
|---------|-----------|------------|
| Claude Code CLI | Codex CLI | Ollama (local) |
| Codex CLI | Hermes | Ollama (local) |
| Gemini CLI | Claude Code CLI | Ollama (local) |

The fallback chain is configurable in Settings → Adapters.

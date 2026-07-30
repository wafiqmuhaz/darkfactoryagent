import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { logger } from '../utils/logger';
import { adapterEnvOverrides } from './container-env';

export type ProbeStatus = 'ready' | 'error' | 'not_tested';
export type RuntimeLocation = 'local' | 'docker' | 'none';

export interface ProbeResult {
  status: ProbeStatus;
  version: string | null;
  path: string | null;
  /** Where the CLI was found: on the host PATH, inside a docker container, or nowhere. */
  runtime: RuntimeLocation;
  message: string;
  /** Response from the live "say hello" probe, when it ran. */
  helloResponse?: string;
  error?: string;
  models?: string[];
  /** Actionable install hint shown in the UI when status is 'error'. */
  installHint?: string;
}

export interface AdapterTask {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  /** Working directory the CLI runs in — the project's local repo path. */
  cwd?: string;
  /**
   * Allow the CLI to modify files under `cwd`. Off for probes and read-only
   * questions; on for real task execution, where the agent is expected to edit code.
   */
  allowWrites?: boolean;
  timeout?: number;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  runtime?: RuntimeLocation;
  tokenUsage?: { input: number; output: number };
  cost?: number;
  error?: string;
  durationMs?: number;
}

/**
 * Placeholder an adapter can put in its argv when the CLI writes its final
 * answer to a file instead of stdout. The base class substitutes a temp path
 * and reads that file back after the run.
 */
export const OUTPUT_FILE_TOKEN = '{{OUTPUT_FILE}}';

export abstract class BaseAdapter {
  protected abstract name: string;
  protected abstract displayName: string;
  /** The CLI binary name, e.g. "claude" or "codex". */
  protected abstract command: string;
  protected abstract installHint: string;

  abstract getModels(): Promise<string[]>;
  /** Build the argv used to send a one-shot prompt and read the reply from stdout. */
  protected abstract buildPromptArgs(task: AdapterTask): string[];
  protected abstract estimateCost(inputTokens: number, outputTokens: number): number;

  /**
   * Look for the CLI on the host PATH first, then inside any running container
   * that has it. Returns 'none' when neither has it.
   */
  protected detectRuntime(): { runtime: RuntimeLocation; path: string | null; container?: string } {
    // 1. Host PATH
    try {
      const local = execSync(`command -v ${this.command}`, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (local) return { runtime: 'local', path: local };
    } catch {
      // fall through to docker
    }

    // 2. Running docker containers
    try {
      const names = execSync('docker ps --format "{{.Names}}"', {
        encoding: 'utf8',
        timeout: 8000,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean);

      for (const container of names) {
        try {
          const inContainer = execSync(
            `docker exec ${container} sh -lc 'command -v ${this.command}'`,
            { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] }
          ).trim();
          if (inContainer) {
            return { runtime: 'docker', path: inContainer, container };
          }
        } catch {
          // this container doesn't have it — keep looking
        }
      }
    } catch {
      // docker not installed or daemon down
    }

    return { runtime: 'none', path: null };
  }

  /**
   * Run the CLI for one prompt and return only its final answer.
   *
   * stdin is closed so CLIs that fall back to reading it don't hang, and when the
   * adapter asked for an output file the answer is read from there rather than
   * scraped out of progress logs.
   */
  protected runCli(
    task: AdapterTask,
    detected: { runtime: RuntimeLocation; container?: string }
  ): string {
    const args = this.buildPromptArgs(task);
    const usesOutputFile = args.some((a) => a.includes(OUTPUT_FILE_TOKEN));
    const outputFile = usesOutputFile
      ? path.join(os.tmpdir(), `df-${this.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`)
      : null;

    const resolvedArgs = outputFile
      ? args.map((a) => a.split(OUTPUT_FILE_TOKEN).join(outputFile))
      : args;

    let inner = `${this.command} ${resolvedArgs.join(' ')} < /dev/null`;
    if (outputFile) {
      // Keep the CLI's own chatter off stdout, then emit just the final answer.
      inner = `${inner} > /dev/null; __st=$?; cat ${shellQuote(outputFile)} 2>/dev/null; rm -f ${shellQuote(outputFile)}; exit $__st`;
    }

    const command = this.wrapForRuntime(inner, detected, task.cwd);

    // Inside a container, CLI configs pointing at loopback need rewriting to the
    // host gateway; on a host this is an empty object.
    const envOverrides = adapterEnvOverrides();

    try {
      return execSync(command, {
        encoding: 'utf8',
        timeout: task.timeout ?? 300000,
        maxBuffer: 32 * 1024 * 1024,
        cwd: detected.runtime === 'local' ? task.cwd : undefined,
        env: Object.keys(envOverrides).length ? { ...process.env, ...envOverrides } : process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } finally {
      if (outputFile && detected.runtime === 'local') {
        try { fs.rmSync(outputFile, { force: true }); } catch { /* already gone */ }
      }
    }
  }

  /** Wrap a command so it runs wherever the CLI actually lives. */
  protected wrapForRuntime(
    innerCommand: string,
    detected: { runtime: RuntimeLocation; container?: string },
    cwd?: string
  ): string {
    if (detected.runtime === 'docker' && detected.container) {
      const workdir = cwd ? `-w ${shellQuote(cwd)} ` : '';
      return `docker exec ${workdir}${detected.container} sh -lc ${shellQuote(innerCommand)}`;
    }
    return innerCommand;
  }

  /**
   * Live probe: find the CLI, read its version, then ask it to reply with "hello".
   * A probe only reports 'ready' when the CLI actually answered.
   */
  async probe(): Promise<ProbeResult> {
    const detected = this.detectRuntime();

    if (detected.runtime === 'none') {
      const message = `${this.displayName} not found on the host PATH or in any running container.`;
      logger.warn(`[${this.name}] probe: ${message}`);
      return {
        status: 'error',
        version: null,
        path: null,
        runtime: 'none',
        message,
        error: `command not found: ${this.command}`,
        installHint: this.installHint,
      };
    }

    // Version — informational only, never fails the probe.
    let version: string | null = null;
    try {
      const raw = execSync(
        this.wrapForRuntime(`${this.command} --version`, detected),
        { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      version = raw.split('\n')[0]?.trim() || null;
    } catch {
      version = null;
    }

    // The actual live check: ask the adapter to respond with hello.
    const helloTask: AdapterTask = {
      prompt: 'Respond with exactly the single word: hello',
      timeout: 60000,
    };

    try {
      const raw = this.runCli(helloTask, detected);
      const helloResponse = raw.trim();

      if (!helloResponse) {
        return {
          status: 'error',
          version,
          path: detected.path,
          runtime: detected.runtime,
          message: `${this.displayName} was found but returned an empty response.`,
          error: 'empty response from CLI',
          installHint: this.installHint,
        };
      }

      const where = detected.runtime === 'docker' ? `docker (${detected.container})` : 'local';
      logger.info(`[${this.name}] probe ok via ${where}: "${helloResponse.slice(0, 60)}"`);

      return {
        status: 'ready',
        version,
        path: detected.path,
        runtime: detected.runtime,
        message: `${this.displayName}${version ? ` v${version}` : ''} responded via ${where}.`,
        helloResponse: helloResponse.slice(0, 400),
        models: await this.getModels(),
      };
    } catch (error: any) {
      const stderr = (error.stderr || '').toString().trim();
      const raw = stderr || error.message || 'unknown error';
      logger.error(`[${this.name}] probe failed: ${raw}`);
      return {
        status: 'error',
        version,
        path: detected.path,
        runtime: detected.runtime,
        message: describeCliFailure(this.displayName, raw),
        error: raw.slice(0, 600),
        installHint: this.installHint,
      };
    }
  }

  /** Run a real task through the CLI, in the project's working directory. */
  async execute(task: AdapterTask): Promise<ExecutionResult> {
    const started = Date.now();
    const detected = this.detectRuntime();

    if (detected.runtime === 'none') {
      return {
        success: false,
        output: '',
        runtime: 'none',
        error: `${this.displayName} not available. ${this.installHint}`,
        durationMs: Date.now() - started,
      };
    }

    // A missing cwd otherwise surfaces as `spawnSync /bin/sh ENOENT`, which says
    // nothing about the actual problem. In Docker this usually means the project
    // path is not mounted into the container that picked up the job.
    if (task.cwd && detected.runtime === 'local' && !fs.existsSync(task.cwd)) {
      return {
        success: false,
        output: '',
        runtime: detected.runtime,
        error: `Working directory not found: ${task.cwd}. In Docker mode the project path must be mounted into every backend container.`,
        durationMs: Date.now() - started,
      };
    }

    try {
      const output = this.runCli(task, detected);

      const promptChars = (task.systemPrompt?.length ?? 0) + task.prompt.length;
      const inputTokens = Math.ceil(promptChars / 4);
      const outputTokens = Math.ceil(output.length / 4);

      return {
        success: true,
        output: output.trim(),
        runtime: detected.runtime,
        tokenUsage: { input: inputTokens, output: outputTokens },
        cost: this.estimateCost(inputTokens, outputTokens),
        durationMs: Date.now() - started,
      };
    } catch (error: any) {
      const stderr = (error.stderr || '').toString().trim();
      const raw = stderr || error.message || 'unknown error';
      logger.error(`[${this.name}] execution failed: ${raw}`);
      return {
        success: false,
        output: (error.stdout || '').toString().trim(),
        runtime: detected.runtime,
        error: describeCliFailure(this.displayName, raw),
        durationMs: Date.now() - started,
      };
    }
  }

  get nameId(): string {
    return this.name;
  }

  get displayNameId(): string {
    return this.displayName;
  }
}

/** Single-quote a string for safe use inside `sh -lc '...'`. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * CLIs interleave banners and progress logs with real errors, so pick the line
 * that actually explains the failure instead of whatever came out first.
 */
export function extractFailureLine(raw: string): string {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    // Drop the CLI's own preamble and progress noise.
    .filter((l) => !/^(reading additional input|openai codex|claude code|-{3,}|workdir:|model:|provider:|approval:|sandbox:|reasoning|tokens used)/i.test(l))
    .filter((l) => !/^reconnecting\b/i.test(l) && !/^ERROR: Reconnecting/i.test(l));

  const signal = lines.filter((l) => /error|fail|denied|unauthor|invalid|quota|limit|refus|timeout|not found|insufficient/i.test(l));
  const chosen = signal[signal.length - 1] || lines[lines.length - 1] || raw.trim();
  return chosen.replace(/^ERROR:\s*/i, '');
}

/** Turn raw CLI stderr into something a user can act on. */
export function describeCliFailure(displayName: string, raw: string): string {
  const lower = raw.toLowerCase();

  if (lower.includes('402') || lower.includes('insufficient balance') || lower.includes('insufficient_quota')) {
    return `${displayName} rejected the request: insufficient balance or quota. Top up the account or switch adapters.`;
  }
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid api key') || lower.includes('not logged in')) {
    return `${displayName} rejected the credentials. Re-authenticate the CLI (e.g. \`${displayName === 'Codex' ? 'codex login' : 'claude login'}\`) or update the API key in Settings → Secrets.`;
  }
  if (lower.includes('429') || lower.includes('rate limit')) {
    return `${displayName} is rate limited. Retry shortly or switch adapters.`;
  }
  if (lower.includes('econnrefused') || lower.includes('error sending request') || lower.includes('stream disconnected')) {
    return `${displayName} could not reach its configured API endpoint — check the provider setting in the CLI's own config and that the endpoint is reachable. (${extractFailureLine(raw).slice(0, 160)})`;
  }
  if (lower.includes('etimedout') || lower.includes('timed out') || lower.includes('sigterm')) {
    return `${displayName} timed out before replying. Increase the timeout or check network connectivity.`;
  }
  if (lower.includes('enotfound') || lower.includes('network')) {
    return `${displayName} could not resolve its API host. Check network connectivity.`;
  }
  return `${displayName} failed: ${extractFailureLine(raw).slice(0, 240)}`;
}

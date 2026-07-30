import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { SkillDefinition } from '../skill-registry';
import { logger } from '../../utils/logger';

export interface ShellSkillInput {
  command: string;
  /** Directory the command runs in. Must exist; the command cannot escape it via cwd. */
  cwd: string;
  timeout?: number;
  env?: Record<string, string>;
}

/**
 * Commands that are refused outright. These are not "dangerous if misused" —
 * they are destructive or exfiltrating in ways no agent task needs, and an
 * allowlist would be too restrictive to be useful for real build/test work.
 */
const BLOCKED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\brm\s+(-[a-zA-Z]*\s+)*(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\s+\/(?:\s|$)/, reason: 'recursive delete of the filesystem root' },
  { pattern: /\brm\s+(-[a-zA-Z]+\s+)*(~|\$HOME)(\/\s*)?(?:\s|$)/, reason: 'recursive delete of the home directory' },
  { pattern: /\b(mkfs|fdisk|parted)\b/, reason: 'disk formatting/partitioning' },
  { pattern: /\bdd\s+.*\bof=\/dev\//, reason: 'raw write to a block device' },
  { pattern: />\s*\/dev\/(sd|nvme|disk)/, reason: 'raw write to a block device' },
  { pattern: /\b(shutdown|reboot|halt|poweroff)\b/, reason: 'host power control' },
  { pattern: /\bchmod\s+(-[a-zA-Z]+\s+)*777\s+\/(?:\s|$)/, reason: 'permission change on the filesystem root' },
  { pattern: /\b(curl|wget)\b[^|;]*\|\s*(sudo\s+)?(ba)?sh/, reason: 'piping a remote script straight into a shell' },
  { pattern: /\bsudo\b/, reason: 'privilege escalation' },
  { pattern: /:\(\)\s*\{.*\}\s*;\s*:/, reason: 'fork bomb' },
  { pattern: /\b(shred|wipefs)\b/, reason: 'secure erase' },
  { pattern: /\bgit\s+push\b[^;|&]*--force\b/, reason: 'force push' },
  { pattern: /\bgit\s+push\b[^;|&]*\s-f\b/, reason: 'force push' },
  { pattern: /\bhistory\s+-c\b/, reason: 'history tampering' },
];

/** Environment variables never passed through to a spawned command. */
const SECRET_ENV_PATTERN = /(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|JWT)/i;

export function screenCommand(command: string): { allowed: boolean; reason?: string } {
  const normalized = command.replace(/\s+/g, ' ').trim();
  if (!normalized) return { allowed: false, reason: 'empty command' };

  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      return { allowed: false, reason };
    }
  }
  return { allowed: true };
}

/**
 * Runs a shell command confined to a given working directory.
 *
 * Confinement is by cwd plus a blocklist, not a kernel sandbox — a determined
 * command can still reach outside `cwd` with absolute paths. Keep this skill
 * disabled unless the tasks you run genuinely need shell access.
 */
export const shellExecutorSkill: SkillDefinition = {
  name: 'shell-executor',
  description: 'Execute shell commands in sandboxed environment',
  category: 'shell',
  version: '1.0.0',
  defaultEnabled: true,
  warning: 'Runs arbitrary shell commands. Confinement is by working directory plus a blocklist, not a kernel sandbox — absolute paths can still reach outside it.',

  execute: async (input: ShellSkillInput) => {
    if (!input?.command) throw new Error('`command` is required');
    if (!input.cwd) throw new Error('`cwd` is required — refusing to run in an implicit directory');

    const cwd = path.resolve(input.cwd);
    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      throw new Error(`Working directory does not exist: ${cwd}`);
    }

    const screening = screenCommand(input.command);
    if (!screening.allowed) {
      logger.warn(`[shell-executor] refused command (${screening.reason}): ${input.command.slice(0, 120)}`);
      throw new Error(`Command refused — ${screening.reason}. Run it manually if this is intended.`);
    }

    // Strip secrets from the inherited environment so a command cannot echo them out.
    const safeEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && !SECRET_ENV_PATTERN.test(key)) safeEnv[key] = value;
    }
    Object.assign(safeEnv, input.env ?? {});

    const timeout = Math.min(input.timeout ?? 120000, 600000);
    logger.info(`[shell-executor] running in ${cwd}: ${input.command.slice(0, 160)}`);

    return new Promise((resolve, reject) => {
      const child = spawn(input.command, {
        shell: '/bin/sh',
        cwd,
        env: safeEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const MAX_OUTPUT = 1024 * 1024; // 1 MB per stream

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeout);

      child.stdout.on('data', (chunk) => {
        if (stdout.length < MAX_OUTPUT) stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        if (stderr.length < MAX_OUTPUT) stderr += chunk.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to start command: ${err.message}`));
      });

      child.on('close', (code) => {
        clearTimeout(timer);

        if (timedOut) {
          return reject(new Error(`Command timed out after ${timeout}ms and was killed`));
        }

        resolve({
          success: code === 0,
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          truncated: stdout.length >= MAX_OUTPUT || stderr.length >= MAX_OUTPUT,
          cwd,
        });
      });
    });
  },
};

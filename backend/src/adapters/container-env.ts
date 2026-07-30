import fs from 'fs';
import os from 'os';
import path from 'path';
import { logger } from '../utils/logger';

/**
 * Adapter CLIs read their endpoint configuration from the user's home directory.
 * When those configs point at a loopback address (a local proxy or router), they
 * are correct on the host but unreachable from inside a container — 127.0.0.1
 * there is the container itself.
 *
 * This module detects the container case and, once per process, writes rewritten
 * copies of the CLI configs with loopback hosts pointed at the Docker host
 * gateway. The originals are mounted read-only in spirit and never modified.
 */

const HOST_GATEWAY = 'host.docker.internal';
const LOOPBACK_PATTERN = /\b(127\.0\.0\.1|localhost|0\.0\.0\.0)\b/g;

let cachedEnv: Record<string, string> | null = null;

/** True when this process is running inside a container. */
export function isContainerized(): boolean {
  if (fs.existsSync('/.dockerenv')) return true;
  try {
    return /docker|containerd|kubepods/.test(fs.readFileSync('/proc/1/cgroup', 'utf8'));
  } catch {
    return false;
  }
}

function rewriteLoopback(value: string): string {
  return value.replace(LOOPBACK_PATTERN, HOST_GATEWAY);
}

/** Copy a file or directory, ignoring anything unreadable. */
function copyInto(source: string, destination: string): void {
  try {
    if (!fs.existsSync(source)) return;
    fs.cpSync(source, destination, { recursive: true, dereference: true });
  } catch {
    // A partially readable config is still better than none.
  }
}

/**
 * Build a Claude config dir whose `settings.json` env block has loopback hosts
 * rewritten. Returns the directory, or null if there was nothing to rewrite.
 */
function prepareClaudeHome(): string | null {
  const sourceDir = path.join(os.homedir(), '.claude');
  const sourceJson = path.join(os.homedir(), '.claude.json');
  if (!fs.existsSync(sourceDir)) return null;

  const settingsPath = path.join(sourceDir, 'settings.json');
  let settings: any = null;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return null; // no settings to rewrite — the CLI's defaults are fine
  }

  const env = settings?.env;
  if (!env || typeof env !== 'object') return null;

  let rewroteAny = false;
  for (const key of Object.keys(env)) {
    const value = env[key];
    if (typeof value !== 'string') continue;
    const next = rewriteLoopback(value);
    if (next !== value) {
      env[key] = next;
      rewroteAny = true;
      logger.info(`[adapter-env] rewrote loopback host in ${key} for container access`);
    }
  }
  if (!rewroteAny) return null;

  const target = path.join(os.tmpdir(), 'df-claude-home');
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir)) {
    if (entry === 'settings.json') continue;
    copyInto(path.join(sourceDir, entry), path.join(target, entry));
  }
  // The CLI expects .claude.json inside its config dir.
  copyInto(sourceJson, path.join(target, '.claude.json'));
  fs.writeFileSync(path.join(target, 'settings.json'), JSON.stringify(settings, null, 2));

  return target;
}

/**
 * Build a Codex home whose `config.toml` base_url values have loopback hosts
 * rewritten. Returns the directory, or null if there was nothing to rewrite.
 */
function prepareCodexHome(): string | null {
  const sourceDir = path.join(os.homedir(), '.codex');
  const configPath = path.join(sourceDir, 'config.toml');
  if (!fs.existsSync(configPath)) return null;

  let config: string;
  try {
    config = fs.readFileSync(configPath, 'utf8');
  } catch {
    return null;
  }

  // Only touch base_url assignments, not arbitrary text elsewhere in the file.
  let rewroteAny = false;
  const rewritten = config.replace(
    /(base_url\s*=\s*")([^"]+)(")/g,
    (_match, prefix: string, url: string, suffix: string) => {
      const next = rewriteLoopback(url);
      if (next !== url) rewroteAny = true;
      return `${prefix}${next}${suffix}`;
    }
  );
  if (!rewroteAny) return null;

  logger.info('[adapter-env] rewrote loopback base_url values in codex config for container access');

  const target = path.join(os.tmpdir(), 'df-codex-home');
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir)) {
    if (entry === 'config.toml') continue;
    copyInto(path.join(sourceDir, entry), path.join(target, entry));
  }
  fs.writeFileSync(path.join(target, 'config.toml'), rewritten);

  return target;
}

/**
 * Environment overrides to apply when invoking an adapter CLI. Empty on a host,
 * and empty inside a container when no config pointed at loopback.
 */
export function adapterEnvOverrides(): Record<string, string> {
  if (cachedEnv) return cachedEnv;

  if (!isContainerized()) {
    cachedEnv = {};
    return cachedEnv;
  }

  const overrides: Record<string, string> = {};
  try {
    const claudeHome = prepareClaudeHome();
    if (claudeHome) overrides.CLAUDE_CONFIG_DIR = claudeHome;

    const codexHome = prepareCodexHome();
    if (codexHome) overrides.CODEX_HOME = codexHome;
  } catch (error: any) {
    logger.warn(`[adapter-env] could not prepare rewritten CLI configs: ${error.message}`);
  }

  cachedEnv = overrides;
  return overrides;
}

/** Rebuild the rewritten configs on the next call (used after a config change). */
export function resetAdapterEnvCache(): void {
  cachedEnv = null;
}

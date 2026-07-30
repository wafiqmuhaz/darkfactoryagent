import { useEffect, useState } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import {
  useAgentConfig,
  useAgentRevisions,
  useSaveConfig,
  useSaveIdentity,
} from '../../hooks/useAgents';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';
import { Badge } from '../common/Badge';
import { EmptyState, NextRunNotice } from './primitives';
import { Field, NumberInput, Panel, Select, TextInput, Toggle } from './fields';
import { formatRelativeTime } from '../../utils/helpers';
import type { AgentConfigInput, AgentConfigPayload } from '../../api/agents';

interface EnvRow {
  key: string;
  secretKey: string;
  value: string;
}

/** Editable copy of everything both forms on this tab own. */
interface Draft {
  name: string;
  title: string;
  managerId: string;
  trustPreset: string;
  canCreateAgents: boolean;
  canManageSkills: boolean;
  adapterType: string;
  command: string;
  model: string;
  cheapModel: string;
  baseUrl: string;
  thinkingEffort: string;
  enableChrome: boolean;
  skipPermissions: boolean;
  maxTurns: number;
  extraArgs: string;
  envVars: EnvRow[];
  timeoutSec: number;
  interruptGraceSec: number;
  heartbeatEnabled: boolean;
  heartbeatIntervalMin: number;
  apiKey: string;
}

function toDraft(payload: AgentConfigPayload): Draft {
  return {
    name: payload.identity.name,
    title: payload.identity.title ?? '',
    managerId: payload.identity.managerId ?? '',
    trustPreset: payload.trust.preset,
    canCreateAgents: payload.trust.canCreateAgents,
    canManageSkills: payload.trust.canManageSkills,
    adapterType: payload.config.adapterType,
    command: payload.config.command,
    model: payload.config.model,
    cheapModel: payload.config.cheapModel ?? '',
    baseUrl: payload.config.baseUrl ?? '',
    thinkingEffort: payload.config.thinkingEffort,
    enableChrome: payload.config.enableChrome,
    skipPermissions: payload.config.skipPermissions,
    maxTurns: payload.config.maxTurns,
    extraArgs: payload.config.extraArgs.join(', '),
    envVars: payload.config.envVars.map((v) => ({
      key: v.key,
      secretKey: v.secretKey ?? '',
      value: '',
    })),
    timeoutSec: payload.config.timeoutSec,
    interruptGraceSec: payload.config.interruptGraceSec,
    heartbeatEnabled: payload.config.heartbeatEnabled,
    heartbeatIntervalMin: payload.config.heartbeatIntervalMin,
    apiKey: '',
  };
}

const TRUST_COPY: Record<string, string> = {
  restricted: 'Limited to its own tasks. Use for agents that should not touch shared state.',
  standard: 'Company-visible collaboration. This is the default for normal work.',
  elevated: 'Broad access across the company, including other agents’ work.',
};

/**
 * Configuration tab. Two independent saves: identity/trust (PUT /identity) and
 * the adapter runtime config (PUT /config). The API key is write-only — the
 * server reports only whether one is stored, so nothing sensitive round-trips.
 */
export const ConfigurationTab = ({ agentId }: { agentId: string }) => {
  const { data, isLoading } = useAgentConfig(agentId);
  const { data: revisions } = useAgentRevisions(agentId);
  const saveConfig = useSaveConfig(agentId);
  const saveIdentity = useSaveIdentity(agentId);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [clearKey, setClearKey] = useState(false);

  // Seed once; a background refetch must not discard an in-progress edit.
  useEffect(() => {
    if (data && !draft) setDraft(toDraft(data));
  }, [data, draft]);

  if (isLoading || !data || !draft) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  }

  const pristine = toDraft(data);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const identityDirty =
    draft.name !== pristine.name ||
    draft.title !== pristine.title ||
    draft.managerId !== pristine.managerId ||
    draft.trustPreset !== pristine.trustPreset ||
    draft.canCreateAgents !== pristine.canCreateAgents ||
    draft.canManageSkills !== pristine.canManageSkills;

  const configDirty =
    draft.adapterType !== pristine.adapterType ||
    draft.command !== pristine.command ||
    draft.model !== pristine.model ||
    draft.cheapModel !== pristine.cheapModel ||
    draft.baseUrl !== pristine.baseUrl ||
    draft.thinkingEffort !== pristine.thinkingEffort ||
    draft.enableChrome !== pristine.enableChrome ||
    draft.skipPermissions !== pristine.skipPermissions ||
    draft.maxTurns !== pristine.maxTurns ||
    draft.extraArgs !== pristine.extraArgs ||
    draft.timeoutSec !== pristine.timeoutSec ||
    draft.interruptGraceSec !== pristine.interruptGraceSec ||
    draft.heartbeatEnabled !== pristine.heartbeatEnabled ||
    draft.heartbeatIntervalMin !== pristine.heartbeatIntervalMin ||
    draft.apiKey.length > 0 ||
    clearKey ||
    JSON.stringify(draft.envVars) !== JSON.stringify(pristine.envVars);

  const handleSaveConfig = () => {
    const input: AgentConfigInput = {
      adapterType: draft.adapterType,
      command: draft.command,
      model: draft.model,
      cheapModel: draft.cheapModel || null,
      baseUrl: draft.baseUrl || null,
      thinkingEffort: draft.thinkingEffort,
      enableChrome: draft.enableChrome,
      skipPermissions: draft.skipPermissions,
      maxTurns: draft.maxTurns,
      extraArgs: draft.extraArgs
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      envVars: draft.envVars
        .filter((v) => v.key.trim().length > 0)
        .map((v) => ({
          key: v.key.trim(),
          ...(v.secretKey.trim() && { secretKey: v.secretKey.trim() }),
          ...(v.value && { value: v.value }),
        })),
      timeoutSec: draft.timeoutSec,
      interruptGraceSec: draft.interruptGraceSec,
      heartbeatEnabled: draft.heartbeatEnabled,
      heartbeatIntervalMin: draft.heartbeatIntervalMin,
      ...(draft.apiKey && { apiKey: draft.apiKey }),
      ...(clearKey && { clearApiKey: true }),
    };

    saveConfig.mutate(input, {
      onSuccess: (fresh) => {
        setDraft(toDraft(fresh));
        setClearKey(false);
      },
    });
  };

  const handleSaveIdentity = () => {
    saveIdentity.mutate(
      {
        name: draft.name,
        title: draft.title || null,
        managerId: draft.managerId || null,
        trustPreset: draft.trustPreset,
        canCreateAgents: draft.canCreateAgents,
        canManageSkills: draft.canManageSkills,
      },
      { onSuccess: (fresh) => setDraft(toDraft(fresh)) }
    );
  };
  return (
    <div className="space-y-5 max-w-3xl">
      <Panel title="Identity" description="How this agent is addressed and who it reports to.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            {(id) => <TextInput id={id} value={draft.name} onChange={(v) => set('name', v)} />}
          </Field>
          <Field label="Title">
            {(id) => (
              <TextInput
                id={id}
                value={draft.title}
                placeholder="e.g. VP of Engineering"
                onChange={(v) => set('title', v)}
              />
            )}
          </Field>
          <Field label="Reports to">
            {(id) => (
              <Select
                id={id}
                value={draft.managerId}
                onChange={(v) => set('managerId', v)}
                options={[
                  { value: '', label: 'Choose manager…' },
                  ...data.options.managers.map((m) => ({
                    value: m.id,
                    label: m.title ? `${m.name} · ${m.title}` : m.name,
                  })),
                ]}
              />
            )}
          </Field>
          <Field label="Type">
            {(id) => (
              <TextInput id={id} value={data.identity.type} onChange={() => undefined} readOnly disabled />
            )}
          </Field>
        </div>
      </Panel>

      <Panel title="Trust" description={TRUST_COPY[draft.trustPreset] ?? ''}>
        <Field label="Trust preset">
          {(id) => (
            <Select
              id={id}
              value={draft.trustPreset}
              onChange={(v) => set('trustPreset', v)}
              options={data.options.trustPresets.map((p) => ({
                value: p,
                label: p.charAt(0).toUpperCase() + p.slice(1),
              }))}
            />
          )}
        </Field>

        <div className="space-y-3 pt-1">
          <Toggle
            label="Can create new agents"
            description="Lets this agent create or hire agents. This also grants task assignment authority."
            checked={draft.canCreateAgents}
            onChange={(v) => set('canCreateAgents', v)}
          />
          <Toggle
            label="Can create/import skills"
            description="Lets this agent install, import, create, and scan company skills without creating agents."
            checked={draft.canManageSkills}
            onChange={(v) => set('canManageSkills', v)}
          />
          <Toggle
            label="Can assign tasks"
            description={
              data.identity.type === 'chief-of-staff'
                ? 'Enabled automatically for chief-of-staff agents.'
                : 'Granted through "Can create new agents".'
            }
            checked={data.trust.canAssignTasks}
            onChange={() => undefined}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          {identityDirty && <span className="text-xs text-muted-foreground mr-auto">Unsaved changes</span>}
          <Button
            variant="outline"
            size="sm"
            disabled={!identityDirty || saveIdentity.isPending}
            onClick={() => setDraft(pristine)}
          >
            Revert
          </Button>
          <Button size="sm" isLoading={saveIdentity.isPending} disabled={!identityDirty} onClick={handleSaveIdentity}>
            Save identity
          </Button>
        </div>
        {saveIdentity.isError && (
          <p className="text-xs text-destructive">{(saveIdentity.error as Error).message}</p>
        )}
      </Panel>
      <Panel title="Adapter" description="Which CLI runs this agent, and how it is invoked.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Adapter type">
            {(id) => (
              <Select
                id={id}
                value={draft.adapterType}
                onChange={(v) => set('adapterType', v)}
                options={data.options.adapters.map((a) => ({ value: a.id, label: a.name }))}
              />
            )}
          </Field>
          <Field label="Command" hint="Binary the adapter process spawns.">
            {(id) => <TextInput id={id} value={draft.command} onChange={(v) => set('command', v)} />}
          </Field>
          <Field label="Primary model">
            {(id) => (
              <Select
                id={id}
                value={draft.model}
                onChange={(v) => set('model', v)}
                options={[
                  { value: 'auto', label: 'Default' },
                  ...data.options.models.map((m) => ({ value: m, label: m })),
                ]}
              />
            )}
          </Field>
          <Field
            label="Cheap model"
            hint={
              draft.cheapModel
                ? 'Used when a run requests the cheap profile. The primary model stays unchanged.'
                : 'No explicit cheap model selected — the runtime falls back to the adapter default.'
            }
          >
            {(id) => (
              <Select
                id={id}
                value={draft.cheapModel}
                onChange={(v) => set('cheapModel', v)}
                options={[
                  { value: '', label: 'Adapter default' },
                  ...data.options.models.map((m) => ({ value: m, label: m })),
                ]}
              />
            )}
          </Field>
          <Field label="Base URL" hint="Overrides the provider endpoint for this agent only.">
            {(id) => (
              <TextInput
                id={id}
                value={draft.baseUrl}
                placeholder="https://api.anthropic.com"
                onChange={(v) => set('baseUrl', v)}
              />
            )}
          </Field>
          <Field label="Thinking effort">
            {(id) => (
              <Select
                id={id}
                value={draft.thinkingEffort}
                onChange={(v) => set('thinkingEffort', v)}
                options={data.options.thinkingEfforts.map((e) => ({
                  value: e,
                  label: e.charAt(0).toUpperCase() + e.slice(1),
                }))}
              />
            )}
          </Field>
        </div>

        <Field
          label="API key"
          hint={
            data.apiKey.isSet
              ? `A key is stored${data.apiKey.updatedAt ? ` (updated ${formatRelativeTime(data.apiKey.updatedAt)})` : ''}. Enter a new value to replace it; the stored value is never displayed.`
              : 'No key stored for this agent — the instance-level provider key is used.'
          }
        >
          {(id) => (
            <div className="flex gap-2">
              <TextInput
                id={id}
                type="password"
                value={draft.apiKey}
                autoComplete="off"
                placeholder={data.apiKey.isSet ? '•••••••• (stored)' : 'sk-…'}
                onChange={(v) => {
                  set('apiKey', v);
                  if (v) setClearKey(false);
                }}
              />
              {data.apiKey.isSet && (
                <Button
                  variant={clearKey ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setClearKey((v) => !v);
                    set('apiKey', '');
                  }}
                  title={clearKey ? 'Key will be removed on save' : 'Remove the stored key'}
                >
                  {clearKey ? <Trash2 className="w-3.5 h-3.5" /> : <KeyRound className="w-3.5 h-3.5" />}
                  {clearKey ? 'Will clear' : 'Clear'}
                </Button>
              )}
            </div>
          )}
        </Field>

        <div className="space-y-3">
          <Toggle label="Enable Chrome" checked={draft.enableChrome} onChange={(v) => set('enableChrome', v)} />
          <Toggle
            label="Skip permissions"
            description="Runs the CLI without its interactive approval prompts."
            checked={draft.skipPermissions}
            onChange={(v) => set('skipPermissions', v)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Max turns per run">
            {(id) => <NumberInput id={id} value={draft.maxTurns} min={1} max={10000} onChange={(v) => set('maxTurns', v)} />}
          </Field>
          <Field label="Extra args (comma-separated)">
            {(id) => (
              <TextInput
                id={id}
                value={draft.extraArgs}
                placeholder="e.g. --verbose, --foo=bar"
                onChange={(v) => set('extraArgs', v)}
              />
            )}
          </Field>
          <Field label="Timeout (sec)" hint="0 disables the timeout.">
            {(id) => <NumberInput id={id} value={draft.timeoutSec} min={0} max={86400} onChange={(v) => set('timeoutSec', v)} />}
          </Field>
          <Field label="Interrupt grace period (sec)">
            {(id) => (
              <NumberInput id={id} value={draft.interruptGraceSec} min={0} max={3600} onChange={(v) => set('interruptGraceSec', v)} />
            )}
          </Field>
        </div>
      </Panel>
      <Panel
        title="Environment variables"
        description="Set KEY to the name the process expects, e.g. GH_TOKEN. Point it at a stored secret to resolve the value at run start."
      >
        {draft.envVars.length === 0 ? (
          <p className="text-sm text-muted-foreground">No environment variables</p>
        ) : (
          <ul className="space-y-2">
            {draft.envVars.map((row, i) => (
              <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-start">
                <TextInput
                  id={`env-key-${i}`}
                  value={row.key}
                  placeholder="KEY"
                  onChange={(v) =>
                    set('envVars', draft.envVars.map((r, ri) => (ri === i ? { ...r, key: v } : r)))
                  }
                />
                <TextInput
                  id={`env-secret-${i}`}
                  value={row.secretKey}
                  placeholder="Secret key (optional)"
                  onChange={(v) =>
                    set('envVars', draft.envVars.map((r, ri) => (ri === i ? { ...r, secretKey: v } : r)))
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => set('envVars', draft.envVars.filter((_, ri) => ri !== i))}
                  aria-label={`Remove ${row.key || 'variable'}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => set('envVars', [...draft.envVars, { key: '', secretKey: '', value: '' }])}
        >
          Add variable
        </Button>
      </Panel>

      <Panel title="Run policy" description="When the agent wakes up on its own.">
        <Toggle
          label="Heartbeat on interval"
          description="Wakes the agent periodically to check for assigned work."
          checked={draft.heartbeatEnabled}
          onChange={(v) => set('heartbeatEnabled', v)}
        />
        {draft.heartbeatEnabled && (
          <Field label="Heartbeat interval (min)">
            {(id) => (
              <NumberInput
                id={id}
                value={draft.heartbeatIntervalMin}
                min={1}
                max={1440}
                onChange={(v) => set('heartbeatIntervalMin', v)}
              />
            )}
          </Field>
        )}
      </Panel>

      <NextRunNotice>
        Saved adapter config affects the next run. Active runs keep the config they started with,
        and config changes may start a fresh adapter session.
      </NextRunNotice>

      <div className="flex items-center justify-end gap-2">
        {configDirty && <span className="text-xs text-muted-foreground mr-auto">Unsaved changes</span>}
        <Button
          variant="outline"
          size="sm"
          disabled={!configDirty || saveConfig.isPending}
          onClick={() => {
            setDraft(pristine);
            setClearKey(false);
          }}
        >
          Revert
        </Button>
        <Button size="sm" isLoading={saveConfig.isPending} disabled={!configDirty} onClick={handleSaveConfig}>
          Save
        </Button>
      </div>
      {saveConfig.isError && (
        <p className="text-xs text-destructive text-right">{(saveConfig.error as Error).message}</p>
      )}

      <Panel title={`Configuration Revisions (${data.revisionCount})`}>
        {revisions && revisions.length > 0 ? (
          <ul className="divide-y divide-border">
            {revisions.map((rev) => (
              <li key={rev.id} className="py-2.5 flex items-start gap-3">
                <Badge variant="outline">{rev.kind}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{rev.summary ?? 'Saved'}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(rev.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<KeyRound className="w-8 h-8" />} title="No revisions recorded yet." />
        )}
      </Panel>
    </div>
  );
};

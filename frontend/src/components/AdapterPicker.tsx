import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Loader2, CheckCircle, XCircle, Terminal, Container, Sparkles } from 'lucide-react';

export interface AdapterInfo {
  id: string;
  name: string;
  description: string;
  type: string;
  recommended?: boolean;
  installHint?: string;
  probeStatus?: 'ready' | 'error' | 'not_tested';
  probeError?: string | null;
  runtime?: 'local' | 'docker' | 'none' | null;
  version?: string | null;
  models?: string[];
}

export interface ProbeResult {
  status: 'ready' | 'error' | 'not_tested';
  version: string | null;
  path: string | null;
  runtime: 'local' | 'docker' | 'none';
  message: string;
  helloResponse?: string;
  error?: string;
  models?: string[];
  installHint?: string;
}

interface Props {
  selectedAdapter: string | null;
  onSelectAdapter: (id: string) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  /** Probe results keyed by adapter id, owned by the parent so it survives step changes. */
  probeResults: Record<string, ProbeResult>;
  onProbeResult: (adapterId: string, result: ProbeResult) => void;
}

const FALLBACK_ADAPTERS: AdapterInfo[] = [
  { id: 'claude-code', name: 'Claude Code', description: 'Claude Code CLI harness', type: 'cli', recommended: true, probeStatus: 'not_tested' },
  { id: 'codex', name: 'Codex', description: 'Codex CLI harness', type: 'cli', recommended: true, probeStatus: 'not_tested' },
];

/**
 * Adapter + model picker with a live environment check. Shared by the onboarding
 * wizard and the project setup wizard so both behave identically.
 */
export const AdapterPicker = ({
  selectedAdapter,
  onSelectAdapter,
  selectedModel,
  onSelectModel,
  probeResults,
  onProbeResult,
}: Props) => {
  const [adapters, setAdapters] = useState<AdapterInfo[]>([]);
  const [probing, setProbing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/adapters')
      .then((res) => {
        if (!cancelled) setAdapters(res.data.adapters?.length ? res.data.adapters : FALLBACK_ADAPTERS);
      })
      .catch(() => {
        if (!cancelled) setAdapters(FALLBACK_ADAPTERS);
      });
    return () => { cancelled = true; };
  }, []);

  const active = adapters.find((a) => a.id === selectedAdapter);
  const activeProbe = selectedAdapter ? probeResults[selectedAdapter] : undefined;
  const models = activeProbe?.models ?? active?.models ?? ['auto'];

  const handleProbe = async () => {
    if (!selectedAdapter) return;
    setProbing(selectedAdapter);
    try {
      const res = await apiClient.post('/adapters/probe', { adapterId: selectedAdapter });
      onProbeResult(selectedAdapter, res.data);
    } catch (err: any) {
      onProbeResult(selectedAdapter, {
        status: 'error',
        version: null,
        path: null,
        runtime: 'none',
        message: err.response?.data?.message || err.response?.data?.error || 'Probe request failed',
        error: err.message,
      });
    } finally {
      setProbing(null);
    }
  };

  const runtimeLabel = (runtime?: string | null) => {
    if (runtime === 'docker') return { icon: Container, text: 'Found in Docker' };
    if (runtime === 'local') return { icon: Terminal, text: 'Found locally' };
    return null;
  };

  return (
    <div className="space-y-5">
      {/* Adapter type */}
      <div>
        <label className="block text-sm font-medium mb-2">Adapter type</label>
        <div className="grid gap-2 sm:grid-cols-2">
          {adapters.map((adapter) => {
            const isSelected = selectedAdapter === adapter.id;
            const probe = probeResults[adapter.id];
            const status = probe?.status ?? adapter.probeStatus ?? 'not_tested';
            const rt = runtimeLabel(probe?.runtime ?? adapter.runtime);

            return (
              <button
                key={adapter.id}
                type="button"
                onClick={() => onSelectAdapter(adapter.id)}
                className={`relative p-3 rounded-lg border text-left transition-all ${
                  isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
                }`}
              >
                {adapter.recommended && (
                  <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                    <Sparkles className="w-2.5 h-2.5" /> Recommended
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-primary' : 'border-muted-foreground'}`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <span className="font-medium text-sm">{adapter.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">{adapter.description}</p>
                <div className="ml-6 mt-1.5 flex items-center gap-2">
                  {status === 'ready' && (
                    <span className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
                      <CheckCircle className="w-3 h-3" /> Ready
                    </span>
                  )}
                  {status === 'error' && (
                    <span className="flex items-center gap-1 text-[11px] text-destructive">
                      <XCircle className="w-3 h-3" /> Not available
                    </span>
                  )}
                  {status === 'not_tested' && (
                    <span className="text-[11px] text-muted-foreground">Not checked</span>
                  )}
                  {rt && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <rt.icon className="w-3 h-3" /> {rt.text}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Model */}
      <div>
        <label className="block text-sm font-medium mb-2">Model</label>
        <select
          value={selectedModel}
          onChange={(e) => onSelectModel(e.target.value)}
          disabled={!selectedAdapter}
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          {models.map((m) => (
            <option key={m} value={m}>{m === 'auto' ? 'Auto' : m}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          Auto lets the CLI pick its own default model.
        </p>
      </div>

      {/* Environment check */}
      <div className="p-4 rounded-lg border border-border bg-secondary/20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Adapter environment check</div>
            <p className="text-xs text-muted-foreground mt-1">
              Runs a live probe that asks the adapter CLI to respond with <code className="font-mono">hello</code>.
              Looks on this machine first, then inside running Docker containers.
            </p>
          </div>
          <button
            type="button"
            onClick={handleProbe}
            disabled={!selectedAdapter || probing !== null}
            className="shrink-0 text-xs px-3 py-1.5 rounded-md border border-border bg-background hover:bg-secondary transition-colors disabled:opacity-50"
          >
            {probing ? 'Testing…' : 'Test now'}
          </button>
        </div>

        {probing && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Probing {active?.name}…
          </div>
        )}

        {!probing && activeProbe?.status === 'ready' && (
          <div className="mt-3 p-3 rounded-md bg-green-500/5 border border-green-500/20 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-300">
              <CheckCircle className="w-3.5 h-3.5" /> {activeProbe.message}
            </div>
            {activeProbe.helloResponse && (
              <div className="text-xs text-muted-foreground font-mono truncate">
                → {activeProbe.helloResponse}
              </div>
            )}
            {activeProbe.path && (
              <div className="text-[11px] text-muted-foreground font-mono truncate">{activeProbe.path}</div>
            )}
          </div>
        )}

        {!probing && activeProbe?.status === 'error' && (
          <div className="mt-3 p-3 rounded-md bg-destructive/5 border border-destructive/20 space-y-1">
            <div className="flex items-start gap-1.5 text-xs font-medium text-destructive">
              <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {activeProbe.message}
            </div>
            {activeProbe.installHint && (
              <div className="text-xs text-muted-foreground font-mono">{activeProbe.installHint}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

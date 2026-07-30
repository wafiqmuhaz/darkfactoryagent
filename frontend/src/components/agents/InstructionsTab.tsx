import { useEffect, useState } from 'react';
import { Copy, Check, FileText } from 'lucide-react';
import { useAgentInstructions, useSaveInstructions } from '../../hooks/useAgents';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';
import { NextRunNotice } from './primitives';
import { formatRelativeTime } from '../../utils/helpers';

/**
 * Instructions tab. The saved text becomes the leading part of the next run's
 * system prompt (see backend task-execution service), so the notice about active
 * runs is literal, not decorative.
 */
export const InstructionsTab = ({ agentId }: { agentId: string }) => {
  const { data, isLoading } = useAgentInstructions(agentId);
  const save = useSaveInstructions(agentId);

  const [draft, setDraft] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Seed the editor once, so a background refetch cannot discard typing.
  useEffect(() => {
    if (data && !loaded) {
      setDraft(data.instructions);
      setLoaded(true);
    }
  }, [data, loaded]);

  if (isLoading || !data) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  }

  const dirty = draft !== data.instructions;
  const bytes = new TextEncoder().encode(draft).length;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <NextRunNotice>
        Saved instructions affect the next run. Active runs keep the instructions they started
        with, and instruction changes may start a fresh adapter session.
      </NextRunNotice>

      <div className="flex flex-col lg:flex-row gap-4">
        <aside className="lg:w-56 shrink-0">
          <div className="text-xs font-medium text-muted-foreground mb-2">Files</div>
          <ul className="space-y-1">
            {data.files.map((file) => (
              <li
                key={file.name}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-secondary/60 text-sm"
              >
                <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {file.label ?? `${file.bytes}b`}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground mt-2">
            Last saved {formatRelativeTime(data.updatedAt)}
          </p>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="agent-instructions" className="text-sm font-medium">
              AGENTS.md
              <span className="text-muted-foreground font-normal"> · markdown</span>
            </label>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <textarea
            id="agent-instructions"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            rows={22}
            placeholder="Describe the agent's role, priorities, boundaries, and output conventions."
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          />

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-foreground">
              {bytes.toLocaleString()} bytes
              {dirty && <span className="text-foreground"> · unsaved changes</span>}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!dirty || save.isPending}
                onClick={() => setDraft(data.instructions)}
              >
                Revert
              </Button>
              <Button
                size="sm"
                isLoading={save.isPending}
                disabled={!dirty}
                onClick={() => save.mutate(draft)}
              >
                Save
              </Button>
            </div>
          </div>

          {save.isError && (
            <p className="text-xs text-destructive mt-2">
              Save failed. {(save.error as Error).message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

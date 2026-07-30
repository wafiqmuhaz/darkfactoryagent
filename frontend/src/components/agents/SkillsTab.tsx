import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Puzzle, Plus, Minus } from 'lucide-react';
import { useAgentSkills, useSaveSkills } from '../../hooks/useAgents';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';
import { Badge } from '../common/Badge';
import { EmptyState, NextRunNotice } from './primitives';
import type { AgentSkillRow } from '../../api/agents';

/**
 * Skills tab. The applied set is Agent.skills (a JSON array of skill ids);
 * catalog rows come from the built-in registry plus the Skills Store.
 */
export const SkillsTab = ({ agentId }: { agentId: string }) => {
  const { data, isLoading } = useAgentSkills(agentId);
  const save = useSaveSkills(agentId);

  const [selected, setSelected] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (data && !loaded) {
      setSelected(data.selected);
      setLoaded(true);
    }
  }, [data, loaded]);

  if (isLoading || !data) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  }

  const dirty =
    selected.length !== data.selected.length ||
    selected.some((id) => !data.selected.includes(id));

  const catalog = [...data.installed, ...data.available];
  const installed = catalog.filter((s) => selected.includes(s.id));
  const others = catalog.filter((s) => !selected.includes(s.id));

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const Row = ({ skill, applied }: { skill: AgentSkillRow; applied: boolean }) => (
    <li className="flex items-start gap-3 px-4 py-3 bg-background">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{skill.displayName}</span>
          <Badge variant="outline">{skill.source}</Badge>
          <span className="text-xs text-muted-foreground font-mono">v{skill.version}</span>
          {!skill.enabled && <Badge variant="warning">disabled</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{skill.description}</p>
      </div>
      <Button variant={applied ? 'outline' : 'secondary'} size="sm" onClick={() => toggle(skill.id)}>
        {applied ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        {applied ? 'Remove' : 'Apply'}
      </Button>
    </li>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/skills-store" className="text-sm text-primary hover:underline">
          View company skills library →
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Selected skills <span className="text-foreground">{selected.length}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!dirty || save.isPending}
            onClick={() => setSelected(data.selected)}
          >
            Revert
          </Button>
          <Button size="sm" isLoading={save.isPending} disabled={!dirty} onClick={() => save.mutate(selected)}>
            Save
          </Button>
        </div>
      </div>

      <NextRunNotice>Applied skills are attached when the agent next runs.</NextRunNotice>

      {data.unresolved.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Stored on this agent but not matching any known skill:{' '}
          <span className="font-mono">{data.unresolved.join(', ')}</span>. Saving replaces the set
          with what is selected here.
        </p>
      )}

      <section>
        <h3 className="text-sm font-semibold mb-2">Installed skills</h3>
        {installed.length > 0 ? (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {installed.map((skill) => (
              <Row key={skill.id} skill={skill} applied />
            ))}
          </ul>
        ) : (
          <div className="border border-border rounded-lg bg-background">
            <EmptyState
              icon={<Puzzle className="w-8 h-8" />}
              title="No company-library skills installed on this agent."
              hint="Apply one from the list below."
            />
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Other skills</h3>
        {others.length > 0 ? (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {others.map((skill) => (
              <Row key={skill.id} skill={skill} applied={false} />
            ))}
          </ul>
        ) : (
          <div className="border border-border rounded-lg bg-background">
            <EmptyState icon={<Puzzle className="w-8 h-8" />} title="Every available skill is applied." />
          </div>
        )}
      </section>

      {save.isError && (
        <p className="text-xs text-destructive">Save failed. {(save.error as Error).message}</p>
      )}
    </div>
  );
};

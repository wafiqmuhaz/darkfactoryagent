import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useProjectStore } from '../store';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Spinner } from '../components/common/Spinner';
import { Badge } from '../components/common/Badge';
import { AdapterPicker } from '../components/AdapterPicker';
import type { ProbeResult } from '../components/AdapterPicker';
import { Plus, Folder, ExternalLink, AlertCircle, Trash2 } from 'lucide-react';
import { formatDate } from '../utils/helpers';

interface Project {
  id: string;
  name: string;
  description?: string;
  path?: string;
  repoUrl?: string;
  adapterType?: string;
  adapterModel?: string;
  createdAt: string;
}

const STEPS = ['Project Info', 'Local Path', 'Repository', 'Connect a model'];

export const Projects = () => {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [probeResults, setProbeResults] = useState<Record<string, ProbeResult>>({});
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    description: '',
    path: '',
    repoUrl: '',
    adapterType: 'claude-code',
    adapterModel: 'auto',
  });

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiClient.get('/projects');
      return res.data as Project[];
    },
  });

  const createProject = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/projects', {
        name: form.name,
        description: form.description,
        localPath: form.path,
        githubRepoUrl: form.repoUrl || undefined,
        adapterType: form.adapterType,
        adapterModel: form.adapterModel,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      closeWizard();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to create project');
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/projects/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      // The board's selected project is gone; clear it so Kanban shows the picker.
      setCurrentProject(null);
      setConfirmDelete(false);
      setDeleteError(null);
    },
    onError: (err: any) => {
      setConfirmDelete(false);
      setDeleteError(err.response?.data?.error || 'Failed to delete project');
    },
  });

  const closeWizard = () => {
    setIsWizardOpen(false);
    setWizardStep(0);
    setError(null);
    setForm({ name: '', description: '', path: '', repoUrl: '', adapterType: 'claude-code', adapterModel: 'auto' });
  };

  const validatePath = async (): Promise<{ valid: boolean; reason?: string }> => {
    try {
      const res = await apiClient.post('/projects/validate-path', { localPath: form.path });
      return { valid: !!res.data.valid, reason: res.data.reason };
    } catch (err: any) {
      return { valid: false, reason: err.response?.data?.error || 'Could not reach the backend to check the path.' };
    }
  };

  const handleNext = async () => {
    setError(null);

    if (wizardStep === 0 && form.name.trim().length < 3) {
      setError('Project name must be at least 3 characters');
      return;
    }
    if (wizardStep === 1) {
      if (!form.path.trim()) {
        setError('A local project path is required');
        return;
      }
      const check = await validatePath();
      if (!check.valid) {
        setError(check.reason || `Path not found: ${form.path}`);
        return;
      }
    }
    if (wizardStep === 3 && probeResults[form.adapterType]?.status !== 'ready') {
      setError('Run the environment check and make sure the adapter responds before creating the project.');
      return;
    }

    if (wizardStep < STEPS.length - 1) {
      setWizardStep((s) => s + 1);
    } else {
      createProject.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // One project per user: the wizard is only reachable when none exists.
  const project = projects?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Project</h1>
          <p className="text-muted-foreground text-sm mt-1">
            One project per account. Delete the current one to set up a different repository.
          </p>
        </div>
        {!project && (
          <Button onClick={() => setIsWizardOpen(true)}>
            <Plus className="w-4 h-4" /> New Project
          </Button>
        )}
      </div>

      {deleteError && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="text-xs underline shrink-0">dismiss</button>
        </div>
      )}

      {project ? (
        <div className="bg-background border border-border rounded-lg p-6 shadow-sm max-w-2xl">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                <Folder className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{project.name}</h3>
                <div className="text-xs text-muted-foreground">Created {formatDate(project.createdAt)}</div>
              </div>
            </div>
            <Badge variant="secondary">{project.adapterType || 'no adapter'}</Badge>
          </div>

          {project.description && (
            <p className="text-sm text-muted-foreground mb-4">{project.description}</p>
          )}

          <dl className="space-y-2 text-sm pt-4 border-t border-border">
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-24 shrink-0">Local path</dt>
              <dd className="font-mono text-xs break-all">{project.path}</dd>
            </div>
            {project.repoUrl && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-24 shrink-0">Repository</dt>
                <dd className="flex items-center gap-1 text-primary text-xs break-all">
                  <ExternalLink className="w-3 h-3 shrink-0" /> {project.repoUrl}
                </dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-24 shrink-0">Adapter</dt>
              <dd>
                {project.adapterType ?? 'not set'}
                {project.adapterModel && ` · ${project.adapterModel}`}
              </dd>
            </div>
          </dl>

          <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setCurrentProject(project.id)}>
              Open Task Board
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
              isLoading={deleteProject.isPending}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Delete Project
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-background border border-border rounded-lg">
          <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-1">No project yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create one to start queueing tasks</p>
          <Button onClick={() => setIsWizardOpen(true)}>
            <Plus className="w-4 h-4" /> Create Project
          </Button>
        </div>
      )}

      {/* Deleting removes every task, run, and log for the project. */}
      <Modal isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete project?" size="sm">
        <div className="space-y-4">
          <p className="text-sm">
            This deletes <span className="font-medium">{project?.name}</span> along with all of its tasks,
            agent runs, artifacts, and activity logs. Files in the repository itself are not touched.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => project && deleteProject.mutate(project.id)}
              isLoading={deleteProject.isPending}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isWizardOpen} onClose={closeWizard} title={`Step ${wizardStep + 1}: ${STEPS[wizardStep]}`} size="lg">
        <div className="space-y-4">
          <div className="flex gap-2 mb-6">
            {STEPS.map((_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full ${i <= wizardStep ? 'bg-primary' : 'bg-secondary'}`} />
            ))}
          </div>

          {wizardStep === 0 && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Project Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="My Awesome Project"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="A short description..."
                  rows={3}
                />
              </div>
            </>
          )}

          {wizardStep === 1 && (
            <div>
              <label className="block text-sm font-medium mb-1">Local Project Path</label>
              <input
                value={form.path}
                onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="/Users/you/Documents/GitHub/my-repo"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Absolute path to the repository. The adapter CLI runs with this as its working directory,
                so in Docker mode the path must also be mounted into the backend container.
              </p>
            </div>
          )}

          {wizardStep === 2 && (
            <div>
              <label className="block text-sm font-medium mb-1">GitHub Repository URL (optional)</label>
              <input
                value={form.repoUrl}
                onChange={(e) => setForm((f) => ({ ...f, repoUrl: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="https://github.com/user/repo"
              />
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Pick the adapter and model this project's tasks will run on, then check the environment.
              </p>
              <AdapterPicker
                selectedAdapter={form.adapterType}
                onSelectAdapter={(id) => setForm((f) => ({ ...f, adapterType: id, adapterModel: 'auto' }))}
                selectedModel={form.adapterModel}
                onSelectModel={(model) => setForm((f) => ({ ...f, adapterModel: model }))}
                probeResults={probeResults}
                onProbeResult={(id, result) => setProbeResults((prev) => ({ ...prev, [id]: result }))}
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="ghost" onClick={() => (wizardStep > 0 ? setWizardStep((s) => s - 1) : closeWizard())}>
              {wizardStep === 0 ? 'Cancel' : 'Back'}
            </Button>
            <Button onClick={handleNext} isLoading={createProject.isPending}>
              {wizardStep === STEPS.length - 1 ? 'Create Project' : 'Next'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

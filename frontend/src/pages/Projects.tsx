import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useProjectStore } from '../store';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Spinner } from '../components/common/Spinner';
import { Badge } from '../components/common/Badge';
import { Plus, Folder, ExternalLink } from 'lucide-react';
import { formatDate } from '../utils/helpers';

interface Project {
  id: string;
  name: string;
  description?: string;
  path?: string;
  repoUrl?: string;
  aiProvider?: string;
  createdAt: string;
}

const STEPS = ['Project Info', 'Local Path', 'Repository', 'AI Config'];

export const Projects = () => {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    description: '',
    path: '',
    repoUrl: '',
    aiProvider: 'openai',
    apiKey: '',
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
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsWizardOpen(false);
      setWizardStep(0);
      setForm({ name: '', description: '', path: '', repoUrl: '', aiProvider: 'openai', apiKey: '' });
    },
  });

  const validatePath = async () => {
    try {
      const res = await apiClient.post('/projects/validate-path', { localPath: form.path });
      return res.data.valid;
    } catch {
      return false;
    }
  };

  const handleNext = async () => {
    if (wizardStep === 1) {
      const valid = await validatePath();
      if (!valid) return;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your development projects</p>
        </div>
        <Button onClick={() => setIsWizardOpen(true)}>
          <Plus className="w-4 h-4" /> New Project
        </Button>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => setCurrentProject(project.id)}
              className="bg-background border border-border rounded-lg p-5 shadow-sm text-left hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <Folder className="w-5 h-5 text-primary" />
                <Badge variant="secondary">{project.aiProvider || 'N/A'}</Badge>
              </div>
              <h3 className="font-semibold mb-1">{project.name}</h3>
              {project.description && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
              )}
              <div className="text-xs text-muted-foreground">
                Created {formatDate(project.createdAt)}
              </div>
              {project.repoUrl && (
                <div className="flex items-center gap-1 text-xs text-primary mt-1">
                  <ExternalLink className="w-3 h-3" /> {project.repoUrl}
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-background border border-border rounded-lg">
          <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-1">No projects yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first project to get started</p>
          <Button onClick={() => setIsWizardOpen(true)}>
            <Plus className="w-4 h-4" /> Create Project
          </Button>
        </div>
      )}

      <Modal isOpen={isWizardOpen} onClose={() => { setIsWizardOpen(false); setWizardStep(0); }} title={`Step ${wizardStep + 1}: ${STEPS[wizardStep]}`} size="lg">
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
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="/path/to/project"
              />
              <p className="text-xs text-muted-foreground mt-1">Absolute path to the project directory on your machine.</p>
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
            <>
              <div>
                <label className="block text-sm font-medium mb-1">AI Provider</label>
                <select
                  value={form.aiProvider}
                  onChange={(e) => setForm((f) => ({ ...f, aiProvider: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google Gemini</option>
                  <option value="ollama">Ollama (Local)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">API Key</label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="sk-..."
                />
              </div>
            </>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="ghost" onClick={() => wizardStep > 0 ? setWizardStep((s) => s - 1) : setIsWizardOpen(false)}>
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

import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { Timer, Plus, Play, ToggleLeft, ToggleRight, Trash2, Clock, History } from 'lucide-react';
import { useProjectStore } from '../store';

interface Routine {
  id: string;
  name: string;
  description: string;
  schedule: string;
  timezone: string;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  runCount: number;
  projectId: string;
  _count: { runs: number };
}

export const Routines = () => {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formSchedule, setFormSchedule] = useState('0 21 * * *');
  const [formTimezone, setFormTimezone] = useState('UTC');

  useEffect(() => {
    loadRoutines();
  }, []);

  const loadRoutines = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/routines');
      setRoutines(res.data.routines || []);
    } catch {
      setRoutines([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formName || !formSchedule) return;
    try {
      await apiClient.post('/routines', {
        name: formName,
        description: formDesc,
        schedule: formSchedule,
        timezone: formTimezone,
        projectId: currentProjectId || 'default',
      });
      setShowCreate(false);
      setFormName('');
      setFormDesc('');
      setFormSchedule('0 21 * * *');
      await loadRoutines();
    } catch (err: any) {
      console.error('Create routine failed:', err);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await apiClient.post(`/routines/${id}/toggle`);
      await loadRoutines();
    } catch (err: any) {
      console.error('Toggle failed:', err);
    }
  };

  const handleTrigger = async (id: string) => {
    setTriggering(id);
    try {
      await apiClient.post(`/routines/${id}/trigger`);
      await loadRoutines();
    } catch (err: any) {
      console.error('Trigger failed:', err);
    } finally {
      setTriggering(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/routines/${id}`);
      await loadRoutines();
    } catch (err: any) {
      console.error('Delete failed:', err);
    }
  };

  const cronPresets = [
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Daily 9 PM', value: '0 21 * * *' },
    { label: 'Weekly Mon 9 AM', value: '0 9 * * 1' },
  ];

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Routines</h1>
          <p className="text-muted-foreground text-sm mt-1">Scheduled recurring tasks for your agents</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Create Routine
        </Button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold mb-4">Create Routine</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nightly Build"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Run nightly pipeline..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cron Schedule</label>
                <input
                  type="text"
                  value={formSchedule}
                  onChange={(e) => setFormSchedule(e.target.value)}
                  placeholder="0 21 * * *"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {cronPresets.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setFormSchedule(p.value)}
                      className={`px-2 py-1 text-xs rounded-md border transition-all ${
                        formSchedule === p.value ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Timezone</label>
                <input
                  type="text"
                  value={formTimezone}
                  onChange={(e) => setFormTimezone(e.target.value)}
                  placeholder="UTC"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Create</Button>
            </div>
          </div>
        </div>
      )}

      {/* Routine list */}
      {routines.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <Timer className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="mb-4">No routines yet. Create your first scheduled task.</p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Create Routine
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {routines.map((routine) => (
            <div key={routine.id} className="bg-background border border-border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    routine.isActive ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
                  }`}>
                    <Timer className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium">{routine.name}</div>
                    {routine.description && (
                      <div className="text-sm text-muted-foreground">{routine.description}</div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {routine.schedule}</span>
                      <span className="flex items-center gap-1"><History className="w-3 h-3" /> {routine.runCount} runs</span>
                      {routine.lastRunAt && (
                        <span>Last: {new Date(routine.lastRunAt).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(routine.id)}
                    className={`p-1.5 rounded-md transition-colors ${
                      routine.isActive ? 'text-green-500 hover:bg-green-500/10' : 'text-muted-foreground hover:bg-secondary'
                    }`}
                    title={routine.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {routine.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => handleTrigger(routine.id)}
                    disabled={triggering === routine.id}
                    className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground transition-colors"
                    title="Trigger now"
                  >
                    <Play className={`w-4 h-4 ${triggering === routine.id ? 'animate-pulse' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleDelete(routine.id)}
                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { apiClient } from '../api/client';
import { Button } from './common/Button';
import { Spinner } from './common/Spinner';
import {
  Sparkles, Building2, Target, UserCircle, Plug, CheckCircle2,
  ChevronRight, ChevronLeft, HelpCircle, Loader2, AlertCircle,
  CheckCircle, XCircle, Monitor, Globe
} from 'lucide-react';

type Step = 'company' | 'mission' | 'agent' | 'adapter' | 'review';

interface AdapterInfo {
  id: string;
  name: string;
  description: string;
  type: string;
  probeStatus: 'ready' | 'error' | 'not_tested';
  probeError?: string;
  isConnected?: boolean;
  models?: string[];
}

export const OnboardingWizard = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('company');
  const [stepIndex, setStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useAuthStore((s) => s.token);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding);

  // Step 1: Company
  const [companyName, setCompanyName] = useState('');

  // Step 2: Mission
  const [missionMode, setMissionMode] = useState<'i-know' | 'help-me' | null>(null);
  const [mission, setMission] = useState('');
  const [helpAnswers, setHelpAnswers] = useState({ projects: '', stack: '', problem: '' });

  // Step 3: Agent
  const [agentName, setAgentName] = useState('Chief of Staff');

  // Step 4: Adapter
  const [adapters, setAdapters] = useState<AdapterInfo[]>([]);
  const [selectedAdapter, setSelectedAdapter] = useState<string | null>(null);
  const [probingAdapter, setProbingAdapter] = useState<string | null>(null);
  const [probeResults, setProbeResults] = useState<Record<string, any>>({});

  // Check onboarding status on mount
  useEffect(() => {
    if (!hasCompletedOnboarding && token) {
      checkOnboardingStatus();
    }
  }, [token, hasCompletedOnboarding]);

  const checkOnboardingStatus = async () => {
    try {
      const res = await apiClient.get('/onboarding/status');
      const { completed, currentStep: savedStep, session } = res.data;

      if (!completed && session) {
        // Resume from saved step
        if (session.companyName) setCompanyName(session.companyName);
        if (session.mission) {
          setMission(session.mission);
          setMissionMode(session.missionMode || 'i-know');
        }
        if (session.agentName) setAgentName(session.agentName);
        if (session.adapterId) setSelectedAdapter(session.adapterId);

        const steps: Step[] = ['company', 'mission', 'agent', 'adapter', 'review'];
        const stepIdx = Math.min(session.currentStep || 0, 4);
        setCurrentStep(steps[stepIdx]);
        setStepIndex(stepIdx);
        setIsOpen(true);
      } else if (!completed) {
        setIsOpen(true);
      }
    } catch {
      // No session yet — show wizard from start
      setIsOpen(true);
    }
  };

  // Load adapters when step becomes adapter
  useEffect(() => {
    if (currentStep === 'adapter') {
      loadAdapters();
    }
  }, [currentStep]);

  const loadAdapters = async () => {
    try {
      const res = await apiClient.get('/adapters');
      setAdapters(res.data.adapters || []);
    } catch {
      // Fallback adapters list
      setAdapters([
        { id: 'claude-code', name: 'Claude Code CLI', description: 'Anthropic Claude Code CLI — local agent execution with Claude models', type: 'cli', probeStatus: 'not_tested' },
        { id: 'codex', name: 'Codex CLI', description: 'OpenAI Codex CLI — code generation with GPT models', type: 'cli', probeStatus: 'not_tested' },
      ]);
    }
  };

  const handleNext = async () => {
    setError(null);
    setIsLoading(true);
    const steps: Step[] = ['company', 'mission', 'agent', 'adapter', 'review'];
    const currentIdx = steps.indexOf(currentStep);

    try {
      switch (currentStep) {
        case 'company':
          if (!companyName.trim()) { setError('Company name is required'); setIsLoading(false); return; }
          await apiClient.post('/onboarding/company', { companyName });
          break;
        case 'mission':
          if (!mission.trim()) { setError('Mission is required'); setIsLoading(false); return; }
          await apiClient.post('/onboarding/mission', { mission, mode: missionMode });
          break;
        case 'agent':
          if (!agentName.trim()) { setError('Agent name is required'); setIsLoading(false); return; }
          await apiClient.post('/onboarding/agent', { agentName });
          break;
        case 'adapter':
          if (!selectedAdapter) { setError('Please select an adapter'); setIsLoading(false); return; }
          if (probeResults[selectedAdapter]?.status !== 'ready') {
            setError('Please test the adapter first with "Test now"');
            setIsLoading(false);
            return;
          }
          await apiClient.post('/onboarding/adapter', { adapterId: selectedAdapter });
          break;
        case 'review':
          await apiClient.post('/onboarding/review');
          completeOnboarding();
          setIsOpen(false);
          setIsLoading(false);
          return;
      }

      const nextIdx = Math.min(currentIdx + 1, 4);
      setCurrentStep(steps[nextIdx]);
      setStepIndex(nextIdx);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    const steps: Step[] = ['company', 'mission', 'agent', 'adapter', 'review'];
    const currentIdx = steps.indexOf(currentStep);
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      setCurrentStep(steps[prevIdx]);
      setStepIndex(prevIdx);
    }
  };

  const handleProbeAdapter = async (adapterId: string) => {
    setProbingAdapter(adapterId);
    setProbeResults(prev => ({ ...prev, [adapterId]: { status: 'testing' } }));
    try {
      const res = await apiClient.post('/adapters/probe', { adapterId });
      setProbeResults(prev => ({ ...prev, [adapterId]: res.data }));
    } catch (err: any) {
      setProbeResults(prev => ({
        ...prev,
        [adapterId]: { status: 'error', message: err.response?.data?.error || err.message, error: err.message }
      }));
    } finally {
      setProbingAdapter(null);
    }
  };

  const generateMissionFromAnswers = () => {
    const { projects, stack, problem } = helpAnswers;
    const generated = `Build ${projects || 'software projects'} using ${stack || 'modern technologies'} that ${problem || 'solves real problems'}.`;
    setMission(generated);
  };

  if (!isOpen) return null;

  const steps: Step[] = ['company', 'mission', 'agent', 'adapter', 'review'];
  const progressPercent = ((steps.indexOf(currentStep) + 1) / steps.length) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 'company':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Build a New Company</h2>
              <p className="text-muted-foreground mt-2">Name your AI-powered development company</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Company name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Software"
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">This will be used across your dashboard and settings</p>
            </div>
          </div>
        );

      case 'mission':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Define Your Mission</h2>
              <p className="text-muted-foreground mt-2">What will your company build?</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => { setMissionMode('i-know'); setMission(''); }}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  missionMode === 'i-know' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${missionMode === 'i-know' ? 'border-primary' : 'border-muted-foreground'}`}>
                    {missionMode === 'i-know' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <div className="font-medium">I know my mission</div>
                    <div className="text-sm text-muted-foreground">Write your mission statement directly</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => { setMissionMode('help-me'); }}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  missionMode === 'help-me' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${missionMode === 'help-me' ? 'border-primary' : 'border-muted-foreground'}`}>
                    {missionMode === 'help-me' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <div className="font-medium">Help me figure it out</div>
                    <div className="text-sm text-muted-foreground">Answer a few questions and AI will generate your mission</div>
                  </div>
                </div>
              </button>
            </div>

            {missionMode === 'i-know' && (
              <textarea
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                placeholder="e.g. Build developer tools that make solo developers 10x more productive"
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}

            {missionMode === 'help-me' && (
              <div className="space-y-3 p-4 bg-secondary/30 rounded-lg">
                <div>
                  <label className="text-sm font-medium">What kind of projects do you build?</label>
                  <input
                    type="text"
                    value={helpAnswers.projects}
                    onChange={(e) => setHelpAnswers(p => ({ ...p, projects: e.target.value }))}
                    placeholder="e.g. Web apps, mobile apps, CLI tools"
                    className="w-full px-3 py-2 mt-1 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">What's your main tech stack?</label>
                  <input
                    type="text"
                    value={helpAnswers.stack}
                    onChange={(e) => setHelpAnswers(p => ({ ...p, stack: e.target.value }))}
                    placeholder="e.g. React, Node.js, TypeScript"
                    className="w-full px-3 py-2 mt-1 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">What problem are you solving?</label>
                  <input
                    type="text"
                    value={helpAnswers.problem}
                    onChange={(e) => setHelpAnswers(p => ({ ...p, problem: e.target.value }))}
                    placeholder="e.g. Automating repetitive development tasks"
                    className="w-full px-3 py-2 mt-1 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <Button onClick={generateMissionFromAnswers} variant="secondary" className="w-full mt-2">
                  Generate Mission
                </Button>
                {mission && (
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-md text-sm">
                    <strong>Generated mission:</strong> {mission}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'agent':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <UserCircle className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Create Your Team Lead</h2>
              <p className="text-muted-foreground mt-2">The Chief of Staff orchestrates all agent activities</p>
            </div>

            <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <UserCircle className="w-10 h-10 text-primary" />
                <div>
                  <div className="font-medium">Chief of Staff</div>
                  <div className="text-sm text-muted-foreground">Orchestrator — manages task decomposition, agent assignments, quality control</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">system_design</span>
                <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">task_planning</span>
                <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">decision_making</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Agent name (optional)</label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Chief of Staff"
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        );

      case 'adapter':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Plug className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Connect a Model</h2>
              <p className="text-muted-foreground mt-2">Select the AI adapter for agent execution</p>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {adapters.map((adapter) => {
                const probeResult = probeResults[adapter.id];
                const isProbing = probingAdapter === adapter.id;
                const isSelected = selectedAdapter === adapter.id;
                const status = probeResult?.status || adapter.probeStatus;

                return (
                  <div
                    key={adapter.id}
                    onClick={() => setSelectedAdapter(adapter.id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-primary' : 'border-muted-foreground'}`}>
                          {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                        </div>
                        <div>
                          <div className="font-medium">{adapter.name}</div>
                          <div className="text-xs text-muted-foreground">{adapter.description}</div>
                        </div>
                      </div>

                      {/* Status indicator */}
                      {status === 'ready' && (
                        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle className="w-3.5 h-3.5" /> Ready
                        </div>
                      )}
                      {status === 'error' && (
                        <div className="flex items-center gap-1 text-xs text-destructive">
                          <XCircle className="w-3.5 h-3.5" /> Error
                        </div>
                      )}
                      {status === 'not_tested' && (
                        <div className="text-xs text-muted-foreground">Not tested</div>
                      )}
                      {isProbing && (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      )}
                    </div>

                    {/* Probe button — always visible */}
                    <div className="mt-2 flex items-center justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleProbeAdapter(adapter.id); }}
                        disabled={isProbing}
                        className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary transition-colors disabled:opacity-50"
                      >
                        {isProbing ? 'Testing...' : 'Test now'}
                      </button>
                    </div>

                    {/* Probe result detail */}
                    {probeResult && probeResult.status === 'ready' && (
                      <div className="mt-2 p-2 bg-green-500/5 border border-green-500/20 rounded text-xs text-green-700 dark:text-green-300">
                        ✅ {probeResult.message}
                        {probeResult.version && <span className="ml-1">(v{probeResult.version})</span>}
                      </div>
                    )}
                    {probeResult && probeResult.status === 'error' && (
                      <div className="mt-2 p-2 bg-destructive/5 border border-destructive/20 rounded text-xs text-destructive">
                        ❌ {probeResult.message || probeResult.error}
                      </div>
                    )}
                    {probeResult && probeResult.status === 'testing' && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Probing adapter...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedAdapter && probeResults[selectedAdapter]?.models && (
              <div className="text-xs text-muted-foreground text-center">
                Available models: {probeResults[selectedAdapter].models?.join(', ')}
              </div>
            )}
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Review Your Setup</h2>
              <p className="text-muted-foreground mt-2">Confirm everything looks right</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-primary" />
                  <div>
                    <div className="text-sm font-medium">Company</div>
                    <div className="text-xs text-muted-foreground">{companyName}</div>
                  </div>
                </div>
                <button onClick={() => { setCurrentStep('company'); setStepIndex(0); }} className="text-xs text-primary hover:underline">Edit</button>
              </div>

              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-primary" />
                  <div>
                    <div className="text-sm font-medium">Mission</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">{mission}</div>
                  </div>
                </div>
                <button onClick={() => { setCurrentStep('mission'); setStepIndex(1); }} className="text-xs text-primary hover:underline">Edit</button>
              </div>

              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <UserCircle className="w-5 h-5 text-primary" />
                  <div>
                    <div className="text-sm font-medium">Team Lead</div>
                    <div className="text-xs text-muted-foreground">{agentName}</div>
                  </div>
                </div>
                <button onClick={() => { setCurrentStep('agent'); setStepIndex(2); }} className="text-xs text-primary hover:underline">Edit</button>
              </div>

              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Plug className="w-5 h-5 text-primary" />
                  <div>
                    <div className="text-sm font-medium">Model</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedAdapter} — {probeResults[selectedAdapter]?.status === 'ready' ? 'Ready' : 'Not tested'}
                    </div>
                  </div>
                </div>
                <button onClick={() => { setCurrentStep('adapter'); setStepIndex(3); }} className="text-xs text-primary hover:underline">Edit</button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-border w-full max-w-lg rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
        {/* Progress bar */}
        <div className="w-full h-1 bg-secondary rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Step indicator */}
        <div className="flex justify-center gap-1 mb-6">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full transition-all ${
                i <= stepIndex ? 'bg-primary' : 'bg-secondary'
              }`} />
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 transition-all ${i < stepIndex ? 'bg-primary' : 'bg-secondary'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        {renderStep()}

        {/* Error */}
        {error && (
          <div className="mt-4 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={currentStep === 'company' ? () => setIsOpen(false) : handleBack}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {currentStep === 'company' ? 'Cancel' : 'Back'}
          </button>

          <Button onClick={handleNext} isLoading={isLoading}>
            {currentStep === 'review' ? (
              <>Get Started <CheckCircle2 className="w-4 h-4 ml-1" /></>
            ) : (
              <>Continue <ChevronRight className="w-4 h-4 ml-1" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

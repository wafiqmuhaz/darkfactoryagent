import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import type { AuthState } from './store';
import { Layout } from './components/Layout/MainLayout';
import { KanbanBoard } from './pages/KanbanBoard';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { AgentStatus } from './pages/AgentStatus';
import { AgentDetail } from './pages/AgentDetail';
import { Skills } from './pages/Skills';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { OnboardingWizard } from './components/OnboardingWizard';
import { SkillsStore } from './pages/SkillsStore';
import { Routines } from './pages/Routines';
import { Costs } from './pages/Costs';
import { Activity } from './pages/Activity';
import { ThemeProvider } from './components/ThemeProvider';
import { ToastManager } from './components/ToastManager';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state: AuthState) => state.token);
  if (!token) return <Navigate to="/login" />;
  return <>{children}</>;
};

function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <ToastManager />
        <OnboardingWizard />
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/kanban" element={<ProtectedRoute><Layout><KanbanBoard /></Layout></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Layout><Projects /></Layout></ProtectedRoute>} />
            <Route path="/agents" element={<ProtectedRoute><Layout><AgentStatus /></Layout></ProtectedRoute>} />
            <Route path="/agents/:id" element={<ProtectedRoute><Layout><AgentDetail /></Layout></ProtectedRoute>} />
            <Route path="/skills" element={<ProtectedRoute><Layout><Skills /></Layout></ProtectedRoute>} />
            <Route path="/skills-store" element={<ProtectedRoute><Layout><SkillsStore /></Layout></ProtectedRoute>} />
            <Route path="/routines" element={<ProtectedRoute><Layout><Routines /></Layout></ProtectedRoute>} />
            <Route path="/costs" element={<ProtectedRoute><Layout><Costs /></Layout></ProtectedRoute>} />
            <Route path="/activity" element={<ProtectedRoute><Layout><Activity /></Layout></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Layout><Analytics /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
          </Routes>
        </Router>
      </div>
    </ThemeProvider>
  );
}

export default App;

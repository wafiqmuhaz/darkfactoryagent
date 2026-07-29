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
import { Skills } from './pages/Skills';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { ThemeProvider } from './components/ThemeProvider';
import { ToastManager } from './components/ToastManager';
import { OnboardingModal } from './components/OnboardingModal';

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
        <OnboardingModal />
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/kanban" element={<ProtectedRoute><Layout><KanbanBoard /></Layout></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Layout><Projects /></Layout></ProtectedRoute>} />
            <Route path="/agents" element={<ProtectedRoute><Layout><AgentStatus /></Layout></ProtectedRoute>} />
            <Route path="/skills" element={<ProtectedRoute><Layout><Skills /></Layout></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Layout><Analytics /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
          </Routes>
        </Router>
      </div>
    </ThemeProvider>
  );
}

export default App;

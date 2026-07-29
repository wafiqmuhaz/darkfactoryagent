import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import type { AuthState } from './store';
import { Layout } from './components/Layout/MainLayout';
import { KanbanBoard } from './pages/KanbanBoard';
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
            <Route path="/login" element={<div>Login Page (TODO)</div>} />
            <Route path="/register" element={<div>Register Page (TODO)</div>} />
            <Route path="/" element={<ProtectedRoute><Layout><KanbanBoard /></Layout></ProtectedRoute>} />
          </Routes>
        </Router>
      </div>
    </ThemeProvider>
  );
}

export default App;

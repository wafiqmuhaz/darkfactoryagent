import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store';
import type { User } from '../store';

interface AuthResponse {
  user: User;
  token: string;
}

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
      setAuth(res.data.user, res.data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<AuthResponse>('/auth/register', { username, email, password });
      setAuth(res.data.user, res.data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { login, register, isLoading, error };
}

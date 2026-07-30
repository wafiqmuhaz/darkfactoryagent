import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store';

/**
 * Socket.io connection scoped to one agent room. Separate from
 * `useProjectSocket` because the agent detail page watches an agent while the
 * board may be watching an unrelated project.
 */
export function useAgentSocket(
  agentId: string | null | undefined,
  handlers: {
    onRunUpdated?: (payload: { runId: string; status?: string; taskId?: string }) => void;
    onAgentUpdated?: (payload: unknown) => void;
  }
) {
  const token = useAuthStore((s) => s.token);
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!token || !agentId) return;

    // VITE_API_URL includes the /api suffix; the socket attaches to the origin.
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const origin = apiUrl.replace(/\/api\/?$/, '');

    const socket = io(origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('join_agent', agentId));
    socket.on('agent:run_updated', (payload) => handlersRef.current.onRunUpdated?.(payload));
    socket.on('agent:updated', (payload) => handlersRef.current.onAgentUpdated?.(payload));

    return () => {
      socket.emit('leave_agent', agentId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, agentId]);

  return socketRef;
}

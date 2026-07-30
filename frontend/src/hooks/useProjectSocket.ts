import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store';

/**
 * Socket.io connection scoped to one project room.
 *
 * The backend runs a Socket.io server, so a raw WebSocket client cannot talk to
 * it — the handshake differs. Handlers are kept in a ref so a caller passing an
 * inline object does not tear down and rebuild the connection on every render.
 */
export function useProjectSocket(
  projectId: string | null | undefined,
  handlers: {
    onTaskCreated?: (task: unknown) => void;
    onTaskUpdated?: (task: unknown) => void;
    onTaskDeleted?: (payload: { id: string }) => void;
    onActivityLog?: (activity: unknown) => void;
  }
) {
  const token = useAuthStore((s) => s.token);
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!token || !projectId) return;

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

    socket.on('connect', () => socket.emit('join_project', projectId));
    socket.on('task:created', (task) => handlersRef.current.onTaskCreated?.(task));
    socket.on('task:updated', (task) => handlersRef.current.onTaskUpdated?.(task));
    socket.on('task:deleted', (payload) => handlersRef.current.onTaskDeleted?.(payload));
    socket.on('activity:log', (activity) => handlersRef.current.onActivityLog?.(activity));

    return () => {
      socket.emit('leave_project', projectId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, projectId]);

  return socketRef;
}

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store';

type EventHandler = (data: unknown) => void;

export function useWebSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const token = useAuthStore((s) => s.token);

  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'ws://localhost:3001';

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${SOCKET_URL}?token=${token}`);
    socketRef.current = ws;

    ws.onopen = () => console.log('WebSocket connected');
    ws.onclose = () => console.log('WebSocket disconnected');
    ws.onerror = (err: Event) => console.error('WebSocket error:', err);

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [token, SOCKET_URL]);

  const on = useCallback((event: string, handler: EventHandler) => {
    const listener = (msg: MessageEvent) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === event) handler(data.payload);
      } catch {}
    };
    socketRef.current?.addEventListener('message', listener);
    return () => socketRef.current?.removeEventListener('message', listener);
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: event, payload: data }));
    }
  }, []);

  return { on, emit, socket: socketRef };
}

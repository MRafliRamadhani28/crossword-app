// src/lib/socket.ts — Client-side Socket.io hook
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

let globalSocket: Socket | null = null;

export function useSocket(roomCode?: string) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Reuse global socket to prevent multiple connections
    if (!globalSocket) {
      globalSocket = io(window.location.origin, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
      });
    }

    const socket = globalSocket;
    socketRef.current = socket;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const joinRoom = useCallback(
    (payload: { playerId: string; playerName: string; role: string }) => {
      if (!roomCode) return;
      socketRef.current?.emit('join-room', { roomCode, ...payload });
    },
    [roomCode]
  );

  return { connected, emit, on, joinRoom, socket: socketRef.current };
}

// ─── Typed event hooks ────────────────────────────────────────────────────────
export function useSocketEvent<T = unknown>(
  socket: Socket | null,
  event: string,
  handler: (data: T) => void
) {
  useEffect(() => {
    if (!socket) return;
    socket.on(event, handler as (...args: unknown[]) => void);
    return () => void socket.off(event, handler as (...args: unknown[]) => void);
  }, [socket, event, handler]);
}

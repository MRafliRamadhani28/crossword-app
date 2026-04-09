'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { io, Socket } from 'socket.io-client';
import { useUI } from '@/components/ui/UIProvider';

interface Player {
  id: string;
  name: string;
  avatar: string;
  points: number;
}

interface RoomData {
  id: string;
  code: string;
  name: string;
  status: string;
  capacity: number;
}

export default function WaitingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();
  const { toast, confirm } = useUI();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [requiresNameInput, setRequiresNameInput] = useState(false);
  const [appUrl, setAppUrl] = useState('');

  useEffect(() => {
    setAppUrl(window.location.origin);
  }, []);

  const joinUrl = `${appUrl}/room/${code}`;

  useEffect(() => {
    const playerName = localStorage.getItem('player_name');

    // No name → redirect to lobby for name input
    if (!playerName || !playerName.trim()) {
      localStorage.setItem('pending_room_code', code);
      router.replace('/?action=join-room');
      return;
    }

    let cancelled = false;

    // Check if this player already has a valid registration for this room
    const existingPlayerId = localStorage.getItem('player_id');
    const existingRoomCode = localStorage.getItem('room_code');

    const connectSocket = (playerId: string, name: string) => {
      if (cancelled) return;
      const s = io();
      setSocket(s);

      s.on('connect', () => {
        setIsConnected(true);
        s.emit('room:join', { roomCode: code, playerId, playerName: name });
      });

      s.on('room:joined', ({ room: r, players: p }: { room: RoomData; players: Player[] }) => {
        setRoom(r);
        setPlayers(p);
      });

      s.on('room:players_updated', ({ players: p }: { players: Player[] }) => {
        setPlayers(p);
        const currentPlayerId = localStorage.getItem('player_id');
        if (currentPlayerId && !p.find((pl) => pl.id === currentPlayerId)) {
          toast.error('Anda telah dikeluarkan dari room ini oleh host.');
          localStorage.removeItem('player_id');
          localStorage.removeItem('room_id');
          localStorage.removeItem('room_code');
          router.push('/');
        }
      });

      s.on('player:kicked', ({ playerId: kickedId }: { playerId: string }) => {
        const currentPlayerId = localStorage.getItem('player_id');
        if (kickedId === currentPlayerId) {
          toast.error('Anda telah dikeluarkan dari room ini oleh host.');
          localStorage.removeItem('player_id');
          localStorage.removeItem('room_id');
          localStorage.removeItem('room_code');
          router.push('/');
        }
      });

      s.on('game:started', () => {
        router.push(`/play/${code}`);
      });

      s.on('error', (err: { message: string }) => {
        toast.error(err.message ?? 'Gagal bergabung ke room');
      });

      s.on('disconnect', () => setIsConnected(false));

      return s;
    };

    let socketInstance: Socket | undefined;

    if (existingPlayerId && existingRoomCode === code) {
      // Already registered for this room — connect directly
      socketInstance = connectSocket(existingPlayerId, playerName);
    } else {
      // New room or no player_id → register via API first
      fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName.trim(), roomCode: code }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          if (data.error) {
            toast.error(data.error);
            router.push('/');
            return;
          }
          localStorage.setItem('player_id', data.player.id);
          localStorage.setItem('player_name', data.player.name);
          localStorage.setItem('player_avatar', data.player.avatar);
          localStorage.setItem('room_id', data.room.id);
          localStorage.setItem('room_code', data.room.code);
          socketInstance = connectSocket(data.player.id, data.player.name);
        })
        .catch(() => {
          if (!cancelled) toast.error('Gagal terhubung ke server');
        });
    }

    return () => {
      cancelled = true;
      socketInstance?.disconnect();
    };
  }, [code, router]);

  return (
    <main className="min-h-screen flex flex-col items-center p-4 py-8 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, #FFE500 0%, transparent 60%)',
        }} />

      <div className="relative z-10 w-full max-w-lg">
        {/* Back button */}
        <button
          onClick={async () => {
            const ok = await confirm({
              title: 'Keluar dari Room?',
              message: 'Kamu bisa join kembali selama game belum dimulai.',
              confirmText: 'Keluar',
              cancelText: 'Tetap',
              variant: 'warning',
            });
            if (ok) {
              socket?.disconnect();
              router.push('/');
            }
          }}
          className="text-zinc-500 hover:text-white text-sm mb-6 flex items-center gap-2 transition-colors"
        >
          ← Keluar dari Room
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          {!room ? (
            <div className="flex justify-center mb-4">
              <div className="text-zinc-400 text-sm">Menghubungkan ke Room...</div>
            </div>
          ) : (
            <>
              <p className="text-zinc-500 text-xs tracking-widest uppercase mb-2">Menunggu dimulai...</p>
              <h1 className="font-display text-3xl font-extrabold"
                style={{ fontFamily: 'Syne, sans-serif', color: '#FFE500' }}>
                {room.name}
              </h1>
            </>
          )}
        </motion.div>

        {/* Room code + QR */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 mb-6 text-center"
        >
          <p className="text-zinc-400 text-xs uppercase tracking-widest mb-3">Kode Room</p>
          <div className="font-display text-5xl font-extrabold tracking-widest mb-6"
            style={{ fontFamily: 'Syne, sans-serif', color: '#FFE500', letterSpacing: '0.3em' }}>
            {code}
          </div>

          <div className="flex justify-center mb-4">
            <div className="p-4 bg-white rounded-2xl">
              <QRCodeSVG
                value={joinUrl}
                size={160}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
          </div>
          <p className="text-zinc-500 text-xs">Scan untuk bergabung</p>
        </motion.div>

        {/* Player list */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-bold text-zinc-300 uppercase tracking-wider"
              style={{ fontFamily: 'Syne, sans-serif' }}>
              Pemain ({players.length}/{room?.capacity ?? '—'})
            </h2>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-500'}`}
              style={isConnected ? { boxShadow: '0 0 8px #39FF14' } : {}} />
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            <AnimatePresence>
              {players.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  <span className="text-xl">{p.avatar}</span>
                  <span className="text-sm font-medium flex-1">{p.name}</span>
                  {p.id === localStorage.getItem('player_id') && (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,229,0,0.15)', color: '#FFE500' }}>
                      Kamu
                    </span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {players.length === 0 && (
              <p className="text-zinc-600 text-sm text-center py-6">Menunggu pemain bergabung...</p>
            )}
          </div>
        </div>

        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-center mt-8 text-zinc-500 text-sm"
        >
          Game akan dimulai oleh host...
        </motion.div>
      </div>
    </main>
  );
}

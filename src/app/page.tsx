'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
// import { LoadingSpinner, LoadingDots } from '@/components/ui/Loading';

type Mode = 'idle' | 'name-input' | 'join' | 'host';

function LobbyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('idle');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hostRooms, setHostRooms] = useState<Array<{ id: string; code: string; name: string; status: string; createdAt: string }>>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Load host rooms dari localStorage
  const loadHostRooms = () => {
    setLoadingRooms(true);
    const roomsJson = localStorage.getItem('host_rooms');
    if (roomsJson) {
      try {
        const rooms = JSON.parse(roomsJson);
        // Filter hanya room yang belum FINISHED
        const activeRooms = rooms.filter((r: { status: string }) => r.status !== 'FINISHED');
        setHostRooms(activeRooms);
      } catch {
        setHostRooms([]);
      }
    }
    setLoadingRooms(false);
  };

  // Simpan room ke localStorage
  const saveRoomToStorage = (room: { id: string; code: string; name: string; status: string; createdAt: string }) => {
    const roomsJson = localStorage.getItem('host_rooms');
    let rooms: Array<{ id: string; code: string; name: string; status: string; createdAt: string }> = [];
    if (roomsJson) {
      try {
        rooms = JSON.parse(roomsJson);
      } catch {
        rooms = [];
      }
    }
    // Cek apakah room sudah ada, update jika ada
    const existingIndex = rooms.findIndex(r => r.id === room.id);
    if (existingIndex >= 0) {
      rooms[existingIndex] = room;
    } else {
      rooms.push(room);
    }
    localStorage.setItem('host_rooms', JSON.stringify(rooms));
    setHostRooms(rooms.filter(r => r.status !== 'FINISHED'));
  };

  // Load saved name on mount and handle URL query params
  useEffect(() => {
    const savedName = localStorage.getItem('player_name');
    const pendingRoomCode = localStorage.getItem('pending_room_code');

    if (savedName) {
      setName(savedName);
      setMode('idle');
    }

    // Check for action parameter in URL
    const action = searchParams?.get('action');

    // Check for room code in URL query params (?code=XXX)
    const urlCode = searchParams?.get('code');

    if (urlCode) {
      setRoomCode(urlCode.toUpperCase());
      // If user already has a name, auto-join the room
      if (savedName) {
        handleJoinWithCode(urlCode.toUpperCase());
      } else {
        // If no name, prompt for name first
        localStorage.setItem('pending_room_code', urlCode.toUpperCase());
        setMode('name-input');
      }
    } else if (action === 'join-room' && pendingRoomCode) {
      // User was redirected from room page due to missing name
      setRoomCode(pendingRoomCode);
      setMode('name-input');
    }

    // Load host rooms dari localStorage
    loadHostRooms();

    // Load room terakhir dari key lama (backward compatibility)
    const hostRoomCode = localStorage.getItem('host_room_code');
    const hostRoomId = localStorage.getItem('host_room_id');
    const existingRooms = (() => {
      try { return JSON.parse(localStorage.getItem('host_rooms') || '[]'); } catch { return []; }
    })();
    if (hostRoomCode && hostRoomId && existingRooms.length === 0) {
      fetch(`/api/rooms/${hostRoomCode}`)
        .then((r) => r.json())
        .then(({ room }) => {
          if (room && room.status !== 'FINISHED') {
            const newRoom = {
              id: room.id,
              code: room.code,
              name: room.name,
              status: room.status,
              createdAt: room.createdAt,
            };
            saveRoomToStorage(newRoom);
          } else if (room && room.status === 'FINISHED') {
            // Clear finished room from localStorage
            localStorage.removeItem('host_room_code');
            localStorage.removeItem('host_room_id');
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  function handleSaveName() {
    if (!name.trim()) return;
    localStorage.setItem('player_name', name.trim());
    
    // Check if there's a pending room code to join
    const pendingRoomCode = localStorage.getItem('pending_room_code');
    if (pendingRoomCode) {
      handleJoinWithCode(pendingRoomCode);
      localStorage.removeItem('pending_room_code');
    } else if (roomCode.trim()) {
      handleJoinWithCode(roomCode.toUpperCase());
    } else {
      setMode('idle');
    }
  }

  async function handleJoin() {
    if (!name.trim() || !roomCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), roomCode: roomCode.toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('player_id', data.player.id);
      localStorage.setItem('player_name', data.player.name);
      localStorage.setItem('player_avatar', data.player.avatar);
      localStorage.setItem('room_id', data.room.id);
      localStorage.setItem('room_code', data.room.code);

      router.push(`/room/${data.room.code}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal bergabung');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinWithCode(code: string) {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), roomCode: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('player_id', data.player.id);
      localStorage.setItem('player_name', data.player.name);
      localStorage.setItem('player_avatar', data.player.avatar);
      localStorage.setItem('room_id', data.room.id);
      localStorage.setItem('room_code', data.room.code);

      router.push(`/room/${data.room.code}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal bergabung');
      setLoading(false);
    }
  }

  function handleChangeName() {
    localStorage.removeItem('player_name');
    setName('');
    setMode('name-input');
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,229,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,229,0,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

      {/* Ambient glow blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-4xl">⬛</span>
            <span className="text-4xl">🟨</span>
            <span className="text-4xl">⬛</span>
          </div>
          <h1 className="font-display text-5xl font-extrabold tracking-tight"
            style={{ fontFamily: 'Syne, sans-serif' }}>
            <span style={{ color: '#FFE500' }} className="glow-yellow">CROSS</span>
            <span className="text-white">WORD</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-2 tracking-widest uppercase">Live Event Platform</p>
        </motion.div>

        {/* Name display */}
        {name && mode !== 'name-input' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-4 mb-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">👤</span>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Bermain sebagai</p>
                <p className="text-white font-semibold">{name}</p>
              </div>
            </div>
            <button
              onClick={handleChangeName}
              className="text-xs text-zinc-500 hover:text-white transition-colors"
            >
              ✏️ Ubah
            </button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {/* Name input mode */}
          {mode === 'name-input' && (
            <motion.div
              key="name-input"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass-card p-6 flex flex-col gap-4"
            >
              <h2 className="font-display text-xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                {roomCode || localStorage.getItem('pending_room_code') ? 'Masuk Room' : 'Masukkan Nama Kamu'}
              </h2>
              <p className="text-zinc-400 text-sm">
                {roomCode || localStorage.getItem('pending_room_code') 
                  ? `Masukkan nama untuk bergabung ke room ${roomCode || localStorage.getItem('pending_room_code')}`
                  : 'Nama akan digunakan untuk semua game yang kamu ikuti'}
              </p>

              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Nama</label>
                <input
                  type="text"
                  placeholder="e.g. Budi Santoso"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={30}
                  className="input-dark w-full px-4 py-3 text-base"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  autoFocus
                />
              </div>

              <button
                onClick={handleSaveName}
                disabled={!name.trim()}
                className="btn-primary py-4 text-lg w-full disabled:opacity-40"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                {roomCode || localStorage.getItem('pending_room_code') ? 'Bergabung →' : 'Simpan →'}
              </button>
            </motion.div>
          )}

          {/* Idle mode */}
          {mode === 'idle' && !name && (
            <motion.div
              key="idle-no-name"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-4"
            >
              <button
                onClick={() => setMode('name-input')}
                className="btn-primary py-5 text-xl w-full font-display"
                style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.01em' }}
              >
                🎮 Mulai Bermain
              </button>
            </motion.div>
          )}

          {/* Idle mode with name */}
          {mode === 'idle' && name && (
            <motion.div
              key="idle-with-name"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-4"
            >
              {/* Action buttons */}
              <button
                onClick={() => setMode('join')}
                className="btn-primary py-5 text-xl w-full font-display"
                style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '-0.01em' }}
              >
                🎮 Ikut Main
              </button>

              <button
                onClick={() => router.push('/host/setup')}
                className="btn-outline py-5 text-xl w-full font-display"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                🎛️ Buat Room Baru
              </button>

              {/* Host rooms list - tampilkan di bawah */}
              {hostRooms.length > 0 && (
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                      📋 Room Yang Kamu Buat
                      {loadingRooms && <span className="text-zinc-500">...</span>}
                    </h3>
                    <span className="text-xs text-zinc-500">{hostRooms.length} room</span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {hostRooms.map((room) => (
                      <motion.div
                        key={room.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{room.name}</p>
                          <p className="text-xs text-zinc-500 mt-1">
                            Kode: <span className="text-yellow-400 font-mono">{room.code}</span>
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`px-2 py-1 text-xs rounded ${
                            room.status === 'PLAYING' ? 'bg-green-500/20 text-green-400' :
                            room.status === 'WAITING' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-zinc-500/20 text-zinc-400'
                          }`}>
                            {room.status === 'PLAYING' ? '🎮 Bermain' :
                             room.status === 'WAITING' ? '⏳ Menunggu' :
                             room.status}
                          </span>
                          <button
                            onClick={() => router.push(`/host/game/${room.code}`)}
                            className="px-3 py-1.5 text-xs btn-primary"
                          >
                            Kelola →
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Join mode */}
          {mode === 'join' && (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass-card p-6 flex flex-col gap-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => { setMode('idle'); setError(''); }}
                  className="text-zinc-400 hover:text-white transition-colors text-xl">←</button>
                <h2 className="font-display text-xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Masuk Game
                </h2>
              </div>

              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Kode Room</label>
                <input
                  type="text"
                  placeholder="e.g. BDG01K"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="input-dark w-full px-4 py-3 text-base uppercase tracking-widest font-display"
                  style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.5rem', letterSpacing: '0.3em' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  autoFocus
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                >
                  <p className="text-sm text-red-400 flex items-center gap-2">
                    <span>⚠️</span> {error}
                  </p>
                </motion.div>
              )}

              <button
                onClick={handleJoin}
                disabled={loading || !roomCode.trim()}
                className="btn-primary py-4 text-lg w-full disabled:opacity-40 relative overflow-hidden"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                {loading ? (
                  <span>Bergabung...</span>
                ) : (
                  'Masuk →'
                )}
              </button>
            </motion.div>
          )}

          {/* Host mode */}
          {mode === 'host' && (
            <motion.div
              key="host"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass-card p-6 flex flex-col gap-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => { setMode('idle'); setError(''); }}
                  className="text-zinc-400 hover:text-white transition-colors text-xl">←</button>
                <h2 className="font-display text-xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Buat Room
                </h2>
              </div>

              <p className="text-zinc-400 text-sm">
                Buat room crossword untuk dimainkan bersama teman-teman
              </p>

              <button
                onClick={() => router.push('/host/setup')}
                className="btn-primary py-4 text-lg w-full"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                🎛️ Buat Room Baru →
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-zinc-600 text-xs mt-8"
        >
          Real-time • Up to 500 players • Zero install
        </motion.p>
      </div>
    </main>
  );
}

export default function LobbyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-yellow-400 text-xl">Loading...</div>
      </div>
    }>
      <LobbyContent />
    </Suspense>
  );
}

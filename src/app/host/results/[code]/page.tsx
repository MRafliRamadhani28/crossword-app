'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Leaderboard, type LeaderboardEntry } from '@/components/game/Leaderboard';
import { ConfettiEffect } from '@/components/game/ConfettiEffect';

export default function HostResultsPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const roomId = localStorage.getItem('host_room_id');
    if (!roomId) return;

    Promise.all([
      fetch(`/api/rooms/${code}`).then((r) => r.json()),
      fetch(`/api/rooms/${code}/results`).then((r) => r.json()),
    ]).then(([roomData, resultsData]) => {
      setRoomName(roomData.room?.name ?? '');
      setLeaderboard(resultsData.leaderboard ?? []);
      setLoading(false);
    });
  }, [code]);

  const top3 = leaderboard.slice(0, 3);

  return (
    <main className="min-h-screen flex flex-col items-center p-6 py-12">
      <ConfettiEffect active={!loading} count={150} />

      {/* Back button */}
      <div className="w-full max-w-lg mb-4">
        <button
          onClick={() => router.push('/')}
          className="text-zinc-500 hover:text-white text-sm flex items-center gap-2 transition-colors"
        >
          ← Kembali ke Lobby
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10 w-full max-w-lg"
      >
        <p className="text-zinc-500 text-xs uppercase tracking-widest mb-2">{roomName}</p>
        <h1 className="font-display text-5xl font-extrabold"
          style={{ fontFamily: 'Syne, sans-serif', color: '#FFE500' }}>
          HASIL AKHIR
        </h1>
      </motion.div>

      {/* Podium */}
      {top3.length >= 3 && (
        <div className="flex items-end justify-center gap-4 mb-10 w-full max-w-sm">
          {/* 2nd */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center"
          >
            <span className="text-3xl mb-2">{top3[1]?.avatar ?? '🎯'}</span>
            <p className="text-sm font-medium text-center max-w-20 truncate">{top3[1]?.playerName}</p>
            <p className="text-zinc-400 text-xs">{top3[1]?.points?.toLocaleString()} pts</p>
            <div className="w-20 mt-2 rounded-t-lg flex items-center justify-center text-2xl font-bold"
              style={{ height: 70, background: 'rgba(192,192,192,0.15)', border: '1px solid rgba(192,192,192,0.3)', color: '#C0C0C0' }}>
              2
            </div>
          </motion.div>

          {/* 1st */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center"
          >
            <span className="text-5xl mb-2">{top3[0]?.avatar ?? '🏆'}</span>
            <p className="text-sm font-bold text-center max-w-24 truncate" style={{ color: '#FFE500' }}>
              {top3[0]?.playerName}
            </p>
            <p className="text-yellow-400 text-sm font-bold">{top3[0]?.points?.toLocaleString()} pts</p>
            <div className="w-24 mt-2 rounded-t-lg flex items-center justify-center text-3xl font-bold"
              style={{ height: 100, background: 'rgba(255,229,0,0.15)', border: '1px solid rgba(255,229,0,0.4)', color: '#FFE500', boxShadow: '0 0 20px rgba(255,229,0,0.2)' }}>
              1
            </div>
          </motion.div>

          {/* 3rd */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col items-center"
          >
            <span className="text-3xl mb-2">{top3[2]?.avatar ?? '🎯'}</span>
            <p className="text-sm font-medium text-center max-w-20 truncate">{top3[2]?.playerName}</p>
            <p className="text-zinc-400 text-xs">{top3[2]?.points?.toLocaleString()} pts</p>
            <div className="w-20 mt-2 rounded-t-lg flex items-center justify-center text-2xl font-bold"
              style={{ height: 50, background: 'rgba(205,127,50,0.15)', border: '1px solid rgba(205,127,50,0.3)', color: '#CD7F32' }}>
              3
            </div>
          </motion.div>
        </div>
      )}

      {/* Full leaderboard */}
      <div className="glass-card p-5 w-full max-w-lg mb-8">
        <p className="font-display text-xs font-bold uppercase tracking-widest mb-4 text-zinc-400"
          style={{ fontFamily: 'Syne, sans-serif' }}>
          Papan Skor Lengkap
        </p>
        {loading ? (
          <div className="text-center text-zinc-500 py-8">Memuat...</div>
        ) : (
          <Leaderboard entries={leaderboard} maxVisible={50} />
        )}
      </div>

      <button onClick={() => router.push('/')} className="btn-outline px-8 py-3">
        Kembali ke Lobby
      </button>
    </main>
  );
}

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { CrosswordGrid } from '@/components/game/CrosswordGrid';
import { Timer } from '@/components/game/Timer';
import { Leaderboard, type LeaderboardEntry } from '@/components/game/Leaderboard';
import { useTimer } from '@/hooks/useTimer';
import { useUI } from '@/components/ui/UIProvider';

interface Puzzle {
  id: string;
  clueNumber: number;
  orientation: 'ACROSS' | 'DOWN';
  row: number;
  col: number;
  length: number;
  isOpened: boolean;
  isRevealed: boolean;
  question: string;
  answer?: string;
  timeLimit: number;
  basePoints: number;
}

interface PlayerAnswer {
  playerId: string;
  playerName: string;
  avatar: string;
  content: string;
  isCorrect: boolean;
  points: number;
  submittedAt: number;
}

interface PuzzleAnswers {
  [puzzleId: string]: PlayerAnswer[];
}

interface Player extends LeaderboardEntry {
  socketId?: string;
  id?: string;
  name?: string;
}

export default function HostGamePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();
  const { confirm } = useUI();

  const [roomId, setRoomId] = useState('');
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [activePuzzle, setActivePuzzle] = useState<Puzzle | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'soal' | 'leaderboard' | 'grid' | 'answers'>('soal');
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, string>>({});
  const [puzzleAnswers, setPuzzleAnswers] = useState<PuzzleAnswers>({});
  const [selectedPuzzleForAnswers, setSelectedPuzzleForAnswers] = useState<string>('');
  const [showKickConfirm, setShowKickConfirm] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const timer = useTimer(30);

  useEffect(() => {
    const rid = localStorage.getItem('host_room_id') ?? '';
    setRoomId(rid);

    // Load room data
    fetch(`/api/rooms/${code}`)
      .then((r) => r.json())
      .then(({ room }) => {
        if (room) {
          setPuzzles(room.puzzles ?? []);
          if (room.players?.length > 0) {
            setPlayers(room.players);
          }
          // Restore gameStarted from server status (handles host page refresh)
          if (room.status === 'PLAYING' || room.status === 'FINISHED') {
            setGameStarted(true);
          }
        }
      });

    const s = io();
    socketRef.current = s;

    s.on('connect', () => {
      setIsConnected(true);
      s.emit('host:join', { roomCode: code });
    });

    s.on('host:joined', () => {});

    s.on('room:players_updated', ({ players: p }: { players: Player[] }) => {
      setPlayers(p);
      setLeaderboard(p.map((pl, i) => ({
        rank: i + 1,
        playerId: pl.playerId || pl.id || '',
        playerName: pl.playerName || pl.name || '',
        avatar: pl.avatar,
        points: pl.points,
        correctAnswers: pl.correctAnswers || 0,
      })).filter((pl) => pl.playerId !== ''));
    });

    s.on('answer:received', (data: { playerId: string; playerName?: string; puzzleId: string; isCorrect: boolean; points?: number; submittedAt: number }) => {
      if (data.puzzleId && data.playerName) {
        setPuzzleAnswers((prev) => {
          const puzzleAnswers = prev[data.puzzleId] || [];
          // Check if this player already submitted for this puzzle
          const existingIndex = puzzleAnswers.findIndex((a) => a.playerId === data.playerId);
          const newAnswer: PlayerAnswer = {
            playerId: data.playerId,
            playerName: data.playerName || '',
            avatar: '',
            content: '',
            isCorrect: data.isCorrect,
            points: data.points || 0,
            submittedAt: data.submittedAt,
          };
          
          if (existingIndex >= 0) {
            // Update existing answer
            puzzleAnswers[existingIndex] = newAnswer;
          } else {
            // Add new answer
            puzzleAnswers.push(newAnswer);
          }
          
          return { ...prev, [data.puzzleId]: puzzleAnswers };
        });
      }
    });

    s.on('leaderboard:update', ({ leaderboard: lb }: { leaderboard: LeaderboardEntry[] }) => {
      setLeaderboard(lb);
      setPlayers(lb as Player[]);
    });

    s.on('puzzle:revealed', ({ puzzle, answer, leaderboard: lb }: { puzzle: Puzzle; answer: string; leaderboard: LeaderboardEntry[] }) => {
      setRevealedAnswers((prev) => ({ ...prev, [puzzle.id]: answer }));
      setLeaderboard(lb);
      setPlayers(lb as Player[]);
    });

    s.on('disconnect', () => setIsConnected(false));

    return () => { s.disconnect(); };
  }, [code]);

  function handleStartGame() {
    socketRef.current?.emit('game:start', { roomId });
    setGameStarted(true);
  }

  async function handleSelectPuzzle(puzzle: Puzzle) {
    if (activePuzzle && !activePuzzle.isRevealed) {
      const ok = await confirm({
        title: 'Soal Belum Di-reveal',
        message: 'Soal sebelumnya belum di-reveal. Lanjut buka soal berikutnya?',
        confirmText: 'Lanjut',
        cancelText: 'Batal',
        variant: 'warning',
      });
      if (!ok) return;
    }

    socketRef.current?.emit('puzzle:select', { roomId, puzzleId: puzzle.id });
    setActivePuzzle({ ...puzzle, isOpened: true });
    setPuzzles((prev) => prev.map((p) => p.id === puzzle.id ? { ...p, isOpened: true } : p));
    timer.start(puzzle.timeLimit, () => {});
    setActiveTab('answers');
    setSelectedPuzzleForAnswers(puzzle.id);
  }

  function handleReveal() {
    if (!activePuzzle) return;
    socketRef.current?.emit('puzzle:reveal', { roomId, puzzleId: activePuzzle.id });
    setActivePuzzle((prev) => prev ? { ...prev, isRevealed: true } : null);
    setPuzzles((prev) => prev.map((p) => p.id === activePuzzle.id ? { ...p, isRevealed: true } : p));
    timer.stop();
  }

  async function handleEndGame() {
    const ok = await confirm({
      title: 'Akhiri Game?',
      message: 'Semua skor akan dikunci dan game tidak bisa dilanjutkan.',
      confirmText: 'Akhiri',
      cancelText: 'Batal',
      variant: 'danger',
    });
    if (!ok) return;
    socketRef.current?.emit('game:end', { roomId });

    // Update room status in localStorage
    try {
      const rooms: Array<{ id: string; code: string; name: string; status: string; createdAt: string }> = JSON.parse(localStorage.getItem('host_rooms') || '[]');
      const updated = rooms.map((r) => r.code === code ? { ...r, status: 'FINISHED' } : r);
      localStorage.setItem('host_rooms', JSON.stringify(updated));
    } catch {}

    router.push(`/host/results/${code}`);
  }

  function handleKickPlayer(playerId: string) {
    socketRef.current?.emit('player:kick', { roomId, playerId });
    setShowKickConfirm(null);
  }

  const openedCount = puzzles.filter((p) => p.isOpened).length;
  const revealedCount = puzzles.filter((p) => p.isRevealed).length;
  const currentPuzzleAnswers = selectedPuzzleForAnswers ? (puzzleAnswers[selectedPuzzleForAnswers] || []) : [];

  return (
    <main className="min-h-screen flex flex-col p-4 pb-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <div>
          <button
            onClick={async () => {
              const ok = await confirm({
                title: 'Kembali ke Lobby?',
                message: 'Game akan tetap berjalan. Kamu bisa kembali kapan saja.',
                confirmText: 'Kembali',
                cancelText: 'Tetap di sini',
                variant: 'info',
              });
              if (ok) {
                socketRef.current?.disconnect();
                router.push('/');
              }
            }}
            className="text-zinc-600 hover:text-zinc-400 text-xs mb-0.5 flex items-center gap-1 transition-colors"
          >
            ← Lobby
          </button>
          <h1 className="font-display text-xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif', color: '#FFE500' }}>
            {code}
          </h1>
          <p className="text-zinc-500 text-xs">
            {players.length} pemain • {openedCount}/{puzzles.length} dibuka • {revealedCount} di-reveal
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-500'}`}
            style={isConnected ? { boxShadow: '0 0 8px #39FF14' } : {}} />
          {!gameStarted ? (
            <button
              onClick={handleStartGame}
              disabled={players.length < 2 || !isConnected}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-40"
              style={{ fontFamily: 'Syne, sans-serif' }}
              title={players.length < 2 ? 'Minimal 2 pemain untuk memulai' : ''}
            >
              🚀 Mulai
            </button>
          ) : (
            <button
              onClick={handleEndGame}
              className="btn-outline px-4 py-2 text-sm text-red-400 border-red-400/30"
            >
              Akhiri
            </button>
          )}
        </div>
      </div>

      {/* Active puzzle controls */}
      {activePuzzle && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 mb-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-display text-yellow-400 font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {activePuzzle.clueNumber}{activePuzzle.orientation === 'ACROSS' ? '→' : '↓'}
                </span>
                <span className="text-xs text-zinc-500 uppercase tracking-wider">
                  {activePuzzle.isRevealed ? '✅ Revealed' : activePuzzle.isOpened ? '🟢 Aktif' : ''}
                </span>
              </div>
              <p className="text-white text-sm mb-1">{activePuzzle.question}</p>
              {activePuzzle.isRevealed && (
                <p className="font-display text-green-400 font-bold tracking-wider" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {activePuzzle.answer ?? revealedAnswers[activePuzzle.id]}
                </p>
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <Timer timeRemaining={timer.timeRemaining} timeLimit={activePuzzle.timeLimit} />
              {!activePuzzle.isRevealed && (
                <button
                  onClick={handleReveal}
                  className="btn-primary px-4 py-2 text-xs"
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  Reveal ✓
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 glass-card p-1 overflow-x-auto">
        {(['soal', 'answers', 'leaderboard', 'grid'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 min-w-[80px] py-2 rounded-lg text-sm font-medium transition-all capitalize whitespace-nowrap"
            style={{
              background: activeTab === tab ? 'rgba(255,229,0,0.15)' : 'transparent',
              color: activeTab === tab ? '#FFE500' : '#666',
              fontFamily: 'Syne, sans-serif',
            }}
          >
            {tab === 'soal' ? '📝 Soal' : tab === 'answers' ? '💬 Jawaban' : tab === 'leaderboard' ? '🏆 Skor' : '🔠 Grid'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Soal tab */}
        {activeTab === 'soal' && (
          <motion.div key="soal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {puzzles.map((puzzle) => (
                <button
                  key={puzzle.id}
                  onClick={() => !puzzle.isRevealed && handleSelectPuzzle(puzzle)}
                  disabled={puzzle.isRevealed || !gameStarted}
                  className="glass-card p-3 text-left transition-all hover:border-yellow-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    border: activePuzzle?.id === puzzle.id
                      ? '1px solid rgba(255,229,0,0.5)'
                      : puzzle.isRevealed
                      ? '1px solid rgba(57,255,20,0.2)'
                      : '1px solid rgba(255,255,255,0.06)',
                    background: activePuzzle?.id === puzzle.id
                      ? 'rgba(255,229,0,0.08)'
                      : puzzle.isRevealed
                      ? 'rgba(57,255,20,0.04)'
                      : undefined,
                  }}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <span className="font-display text-base font-extrabold"
                      style={{ fontFamily: 'Syne, sans-serif', color: puzzle.isRevealed ? '#39FF14' : '#FFE500' }}>
                      {puzzle.clueNumber}
                    </span>
                    <span className="text-zinc-600 text-xs">{puzzle.orientation === 'ACROSS' ? '→' : '↓'}</span>
                    {puzzle.isRevealed && <span className="text-xs ml-auto">✅</span>}
                    {puzzle.isOpened && !puzzle.isRevealed && <span className="text-xs ml-auto">🟢</span>}
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-2">{puzzle.question}</p>
                  <p className="text-xs text-zinc-600 mt-1">{puzzle.length} huruf • {puzzle.basePoints}pts</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Answers tab - Feature 9 */}
        {activeTab === 'answers' && (
          <motion.div key="answers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-zinc-300" style={{ fontFamily: 'Syne, sans-serif' }}>
                  💬 Jawaban Player per Soal
                </h3>
                {puzzles.length > 0 && (
                  <select
                    value={selectedPuzzleForAnswers || puzzles[0]?.id || ''}
                    onChange={(e) => setSelectedPuzzleForAnswers(e.target.value)}
                    className="input-dark px-3 py-2 text-sm"
                    style={{ fontFamily: 'Syne, sans-serif' }}
                  >
                    {puzzles.map((p, i) => (
                      <option key={p.id} value={p.id}>
                        Soal {p.clueNumber} ({p.isRevealed ? '✅' : p.isOpened ? '🟢' : '⬜'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {currentPuzzleAnswers.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">Belum ada jawaban masuk</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {currentPuzzleAnswers.map((ans, i) => (
                    <motion.div
                      key={`${ans.playerId}-${ans.submittedAt}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        ans.isCorrect ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
                      }`}
                    >
                      <span className="text-xl">{ans.avatar || '👤'}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{ans.playerName}</p>
                        <p className={`text-xs ${ans.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                          {ans.isCorrect ? '✓ Benar' : '✗ Salah'}
                        </p>
                      </div>
                      {ans.isCorrect && (
                        <span className="text-yellow-400 font-bold">+{ans.points} pts</span>
                      )}
                      <span className="text-xs text-zinc-600">
                        {new Date(ans.submittedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Leaderboard tab - Feature 5 */}
        {activeTab === 'leaderboard' && (
          <motion.div key="lb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-zinc-300" style={{ fontFamily: 'Syne, sans-serif' }}>
                  🏆 Papan Skor Lengkap
                </h3>
              </div>
              
              {players.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">Belum ada pemain</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, i) => (
                    <motion.div
                      key={entry.playerId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white/5"
                    >
                      <span className="text-lg font-bold text-zinc-500 w-6">#{entry.rank}</span>
                      <span className="text-2xl">{entry.avatar || '👤'}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{entry.playerName}</p>
                        <p className="text-xs text-zinc-500">{entry.correctAnswers || 0} jawaban benar</p>
                      </div>
                      <div className="text-right">
                        <p className="text-yellow-400 font-bold">{entry.points} pts</p>
                      </div>
                      {/* Kick button - Feature 6 */}
                      {showKickConfirm === entry.playerId ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleKickPlayer(entry.playerId)}
                            className="px-2 py-1 text-xs bg-red-500 text-white rounded"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setShowKickConfirm(null)}
                            className="px-2 py-1 text-xs bg-zinc-600 text-white rounded"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowKickConfirm(entry.playerId)}
                          className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                          title="Kick player"
                        >
                          🚫 Kick
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Grid tab */}
        {activeTab === 'grid' && (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="glass-card p-4 overflow-x-auto">
            <CrosswordGrid
              puzzles={puzzles}
              activePuzzleId={activePuzzle?.id}
              revealedAnswers={revealedAnswers}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kick confirmation modal */}
      <AnimatePresence>
        {showKickConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowKickConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-display text-lg font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                Kick Player?
              </h3>
              <p className="text-zinc-400 text-sm mb-4">
                Player ini akan dikeluarkan dari room dan tidak bisa join kembali.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowKickConfirm(null)}
                  className="flex-1 btn-outline py-2"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleKickPlayer(showKickConfirm)}
                  className="flex-1 btn-primary py-2 bg-red-500 hover:bg-red-600"
                >
                  🚫 Kick
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

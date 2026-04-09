'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { CrosswordGrid } from '@/components/game/CrosswordGrid';
import { Timer } from '@/components/game/Timer';
import { Leaderboard, type LeaderboardEntry } from '@/components/game/Leaderboard';
import { ConfettiEffect } from '@/components/game/ConfettiEffect';
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
  timeLimit: number;
}

type AnswerState = 'idle' | 'submitted' | 'correct' | 'wrong' | 'revealed' | 'timeup';

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();
  const { confirm } = useUI();

  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [activePuzzle, setActivePuzzle] = useState<Puzzle | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [answerState, setAnswerState] = useState<AnswerState>('idle');
  const [answerPoints, setAnswerPoints] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, string>>({});
  const [playerAnswers, setPlayerAnswers] = useState<Record<string, { content: string; isCorrect: boolean }>>({});
  const [roomId, setRoomId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [gameEnded, setGameEnded] = useState(false);
  const [timeIsUp, setTimeIsUp] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const answerInputRef = useRef('');
  const activePuzzleRef = useRef<Puzzle | null>(null);
  const correctAnswersRef = useRef<Record<string, string>>({});
  const showLeaderboardAfterEachRef = useRef(true);
  const timer = useTimer(30);

  // Keep refs in sync so socket handlers (stale closures) can read latest values
  useEffect(() => { answerInputRef.current = answerInput; }, [answerInput]);
  useEffect(() => { activePuzzleRef.current = activePuzzle; }, [activePuzzle]);

  useEffect(() => {
    const pid = localStorage.getItem('player_id');
    const rid = localStorage.getItem('room_id');
    const pname = localStorage.getItem('player_name');

    if (!pid || !rid) { router.replace('/'); return; }

    setPlayerId(pid);
    setRoomId(rid);

    const s = io();
    socketRef.current = s;

    s.on('connect', () => {
      s.emit('room:join', { roomCode: code, playerId: pid, playerName: pname });
    });

    s.on('room:joined', ({ room: r, puzzles: p }: { room: { config?: { showLeaderboardAfterEach?: boolean } }; puzzles: Puzzle[] }) => {
      setPuzzles(p);
      showLeaderboardAfterEachRef.current = r.config?.showLeaderboardAfterEach ?? true;
    });

    s.on('puzzle:opened', ({ puzzle, timeLimit }: { puzzle: Puzzle; timeLimit: number }) => {
      setActivePuzzle(puzzle);
      const prevCorrectAnswer = correctAnswersRef.current[puzzle.id];
      if (prevCorrectAnswer) {
        // Player already answered this puzzle correctly — restore locked state
        setAnswerInput(prevCorrectAnswer);
        setAnswerState('correct');
        setTimeIsUp(false);
        timer.start(timeLimit, () => {
          setTimeIsUp(true);
        });
      } else {
        setAnswerInput('');
        setAnswerState('idle');
        setTimeIsUp(false);
        timer.start(timeLimit, () => {
          setTimeIsUp(true);
          setAnswerState('timeup');
        });
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    });

    s.on('puzzle:revealed', ({ puzzle, answer, leaderboard: lb }: {
      puzzle: Puzzle; answer: string; leaderboard: LeaderboardEntry[];
    }) => {
      setRevealedAnswers((prev) => ({ ...prev, [puzzle.id]: answer }));
      setPuzzles((prev) => prev.map((p) => p.id === puzzle.id ? { ...p, isRevealed: true } : p));
      setLeaderboard(lb);
      if (showLeaderboardAfterEachRef.current) {
        setShowLeaderboard(true);
        setTimeout(() => setShowLeaderboard(false), 5000);
      }
      timer.stop();
      setTimeIsUp(true);
      setAnswerState((prev) => prev === 'correct' ? prev : 'revealed');
    });

    s.on('leaderboard:update', ({ leaderboard: lb }: { leaderboard: LeaderboardEntry[] }) => {
      setLeaderboard(lb);
    });

    s.on('answer:result', (result: { isCorrect: boolean; points: number; timeBonus: number }) => {
      // Allow resubmission - go back to idle state but keep track of answer
      if (result.isCorrect) {
        const correctContent = answerInputRef.current.toUpperCase();
        const puzzleId = activePuzzleRef.current?.id ?? '';
        correctAnswersRef.current[puzzleId] = correctContent;
        setAnswerPoints(result.points);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        setPlayerAnswers((prev) => ({
          ...prev,
          [puzzleId]: { content: correctContent, isCorrect: true },
        }));
        setAnswerState('correct');
      } else {
        // Wrong answer - allow resubmission
        setPlayerAnswers((prev) => ({
          ...prev,
          [activePuzzleRef.current?.id ?? '']: { content: answerInputRef.current.toUpperCase(), isCorrect: false },
        }));
        setAnswerState('wrong');
        // Reset to idle after showing wrong feedback
        setTimeout(() => {
          setAnswerState('idle');
          setAnswerInput('');
        }, 1500);
      }
      // Don't stop timer - allow multiple attempts
    });

    s.on('game:ended', ({ leaderboard: lb }: { leaderboard: LeaderboardEntry[] }) => {
      setLeaderboard(lb);
      setGameEnded(true);
    });

    return () => { s.disconnect(); };
  }, [code]);

  function handleSubmit() {
    if (!activePuzzle || !answerInput.trim()) return;
    if (timeIsUp) return;
    if (answerState === 'submitted' || answerState === 'correct') return;

    socketRef.current?.emit('answer:submit', {
      playerId,
      puzzleId: activePuzzle.id,
      content: answerInput.trim().toUpperCase(),
      roomId,
    });
    setAnswerState('submitted');
    // State selanjutnya ditentukan sepenuhnya oleh answer:result dari server
    // (correct → tetap 'correct', wrong → 'wrong' → 'idle')
  }

  if (gameEnded) {
    return <GameEndScreen leaderboard={leaderboard} playerId={playerId} />;
  }

  const canInput = activePuzzle && !timeIsUp && answerState !== 'submitted' && answerState !== 'correct';

  return (
    <main className="min-h-screen flex flex-col p-4 pb-8 max-w-lg mx-auto">
      <ConfettiEffect active={showConfetti} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 pt-2">
        <div>
          <button
            onClick={async () => {
              const ok = await confirm({
                title: 'Keluar dari Game?',
                message: 'Skormu akan tetap tersimpan. Kamu bisa join kembali dari lobby.',
                confirmText: 'Keluar',
                cancelText: 'Lanjut Main',
                variant: 'warning',
              });
              if (ok) {
                socketRef.current?.disconnect();
                router.push('/');
              }
            }}
            className="text-zinc-600 hover:text-zinc-400 text-xs mb-0.5 flex items-center gap-1 transition-colors"
          >
            ← Keluar
          </button>
          <p className="text-zinc-500 text-xs uppercase tracking-wider">CrosswordLive</p>
          <p className="text-white font-semibold text-sm">{code}</p>
        </div>
        {activePuzzle && (
          <Timer timeRemaining={timer.timeRemaining} timeLimit={activePuzzle.timeLimit} />
        )}
      </div>

      {/* Crossword Grid */}
      <div className="glass-card p-4 mb-4 overflow-x-auto">
        <CrosswordGrid
          puzzles={puzzles}
          activePuzzleId={activePuzzle?.id}
          revealedAnswers={revealedAnswers}
          playerAnswers={playerAnswers}
          compact={true}
        />
      </div>

      {/* Active puzzle question + input */}
      <AnimatePresence mode="wait">
        {activePuzzle && (
          <motion.div
            key={activePuzzle.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="glass-card p-5 mb-4"
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="font-display text-2xl font-extrabold flex-shrink-0"
                style={{ fontFamily: 'Syne, sans-serif', color: '#FFE500' }}>
                {activePuzzle.clueNumber}
                <span className="text-sm text-zinc-500 ml-1">
                  {activePuzzle.orientation === 'ACROSS' ? '→' : '↓'}
                </span>
              </span>
              <p className="text-white text-lg leading-snug">{activePuzzle.question}</p>
            </div>

            <AnimatePresence mode="wait">
              {canInput && (
                <motion.div
                  key="input"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={`${activePuzzle.length} huruf`}
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value.toUpperCase())}
                    maxLength={activePuzzle.length * 2}
                    className="input-dark flex-1 px-4 py-3 text-lg uppercase tracking-widest"
                    style={{ fontFamily: 'Syne, sans-serif' }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    autoComplete="off"
                    disabled={!canInput}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!answerInput.trim()}
                    className="btn-primary px-5 py-3 disabled:opacity-40"
                    style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.2rem' }}
                  >
                    →
                  </button>
                </motion.div>
              )}

              {answerState === 'submitted' && (
                <motion.div
                  key="submitted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-3 text-green-400"
                >
                  <div className="text-2xl mb-1">✓</div>
                  Jawaban anda disimpan
                </motion.div>
              )}

              {answerState === 'correct' && (
                <motion.div
                  key="correct"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center py-3"
                >
                  <div className="text-4xl mb-1">🎉</div>
                  <p className="font-display text-xl font-extrabold glow-green"
                    style={{ fontFamily: 'Syne, sans-serif', color: '#39FF14' }}>
                    BENAR!
                  </p>
                  <p className="text-zinc-400 text-sm mt-1 tracking-widest uppercase font-bold">
                    {answerInput}
                  </p>
                  {answerPoints > 0 && (
                    <p className="text-zinc-500 text-xs mt-0.5">+{answerPoints} poin</p>
                  )}
                </motion.div>
              )}

              {answerState === 'wrong' && (
                <motion.div
                  key="wrong"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center py-3"
                >
                  <div className="text-4xl mb-1">❌</div>
                  <p className="font-display text-xl font-extrabold"
                    style={{ fontFamily: 'Syne, sans-serif', color: '#FF2D78' }}>
                    SALAH
                  </p>
                  <p className="text-zinc-500 text-xs mt-1">Silakan coba lagi</p>
                </motion.div>
              )}

              {answerState === 'timeup' && (
                <motion.div
                  key="timeup"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-3 text-zinc-400"
                >
                  <div className="text-2xl mb-1">⏰</div>
                  Menunggu host membuka jawaban
                </motion.div>
              )}

              {answerState === 'revealed' && (
                <motion.div
                  key="revealed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-3 text-zinc-400 text-sm"
                >
                  Soal ditutup
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {!activePuzzle && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-8 mb-4 text-center"
          >
            <div className="text-4xl mb-3">⬛</div>
            <p className="text-zinc-400">Menunggu host membuka soal...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard overlay */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-0 left-0 right-0 glass-card rounded-b-none p-5 max-h-72 overflow-y-auto z-40"
            style={{ borderBottom: 'none' }}
          >
            <p className="font-display text-xs font-bold uppercase tracking-widest mb-3 text-zinc-400"
              style={{ fontFamily: 'Syne, sans-serif' }}>
              🏆 Papan Skor
            </p>
            <Leaderboard entries={leaderboard} currentPlayerId={playerId} compact maxVisible={5} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function GameEndScreen({ leaderboard, playerId }: { leaderboard: LeaderboardEntry[]; playerId: string }) {
  const me = leaderboard.find((e) => e.playerId === playerId);
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <ConfettiEffect active={true} count={120} />

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="text-center mb-8"
      >
        <div className="text-6xl mb-4">{me?.rank === 1 ? '🏆' : me?.rank === 2 ? '🥈' : me?.rank === 3 ? '🥉' : '🎮'}</div>
        <h1 className="font-display text-4xl font-extrabold"
          style={{ fontFamily: 'Syne, sans-serif', color: '#FFE500' }}>
          SELESAI!
        </h1>
        {me && (
          <p className="text-zinc-300 mt-2">
            Peringkat <span className="text-yellow-400 font-bold">#{me.rank}</span> dengan <span className="text-white font-bold">{me.points.toLocaleString()}</span> poin
          </p>
        )}
      </motion.div>

      <div className="glass-card p-5 w-full max-w-sm mb-6">
        <Leaderboard entries={leaderboard} currentPlayerId={playerId} maxVisible={10} />
      </div>

      <button onClick={() => router.push('/')} className="btn-outline px-8 py-3">
        Kembali ke Lobby
      </button>
    </main>
  );
}

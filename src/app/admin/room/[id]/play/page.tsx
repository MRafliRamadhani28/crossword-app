// src/app/admin/room/[id]/play/page.tsx — Admin Game Control
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/lib/socket';
import CrosswordGrid from '@/components/CrosswordGrid';
import Countdown from '@/components/Countdown';
import { ToastProvider, useToast } from '@/components/Toast';
import type { CrosswordLayout, PlacedWord } from '@/lib/crossword';
import { scoreSubmissions } from '@/lib/crossword';

interface PlayerData {
  id: string;
  displayName: string;
  totalPoints: number;
  isOnline: boolean;
  lastAnswer?: string;
  lastAnswerTime?: string;
}

interface RoomData {
  id: string;
  name: string;
  code: string;
  status: string;
  puzzles: Array<{ id: string; layout: { rows: number; cols: number; cells: unknown[][] }; clues: { across: PlacedWord[]; down: PlacedWord[] } }>;
  players: PlayerData[];
}

interface ActiveSession {
  id: string;
  clue: PlacedWord;
  status: 'ACTIVE' | 'CLOSED' | 'VALIDATED';
  duration: number;
}

function AdminPlayContent() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const { addToast } = useToast();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [layout, setLayout] = useState<CrosswordLayout | null>(null);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [duration, setDuration] = useState(60);
  const [liveAnswers, setLiveAnswers] = useState<Record<string, Record<string, string>>>({});
  const [validationResults, setValidationResults] = useState<Record<string, boolean>>({});
  const [submissionList, setSubmissionList] = useState<Array<{ playerId: string; playerName: string; answer: string; submittedAt: string; isCorrect?: boolean; points?: number; rank?: number }>>([]);
  const [completedClues, setCompletedClues] = useState<Set<number>>(new Set());
  const { on, emit, connected } = useSocket(room?.code);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Load room data
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    fetch(`/api/rooms/${roomId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setRoom(data);
        setPlayers(data.players || []);
        if (data.puzzles?.[0]) {
          const puzzle = data.puzzles[0];
          setLayout({ ...puzzle.layout, clues: puzzle.clues, placedWords: [...puzzle.clues.across, ...puzzle.clues.down] } as CrosswordLayout);
        }
      });
  }, [roomId]);

  // Join room as admin via socket
  useEffect(() => {
    if (!connected || !room) return;
    const token = localStorage.getItem('adminToken');
    emit('join-room', { roomCode: room.code, playerId: 'admin', playerName: 'Admin', role: 'ADMIN' });
  }, [connected, room, emit]);

  // Socket listeners
  useEffect(() => {
    const offPlayerJoined = on('player-joined', (data: unknown) => {
      const { playerId, playerName } = data as { playerId: string; playerName: string };
      setPlayers(prev => {
        if (prev.find(p => p.id === playerId)) return prev;
        return [...prev, { id: playerId, displayName: playerName, totalPoints: 0, isOnline: true }];
      });
      addToast(`${playerName} bergabung`, 'success');
    });

    const offPlayerLeft = on('player-left', (data: unknown) => {
      const { playerId } = data as { playerId: string };
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, isOnline: false } : p));
    });

    const offAnswerUpdate = on('game:answer-update', (data: unknown) => {
      const { playerId, playerName, answer, submittedAt } = data as { playerId: string; playerName: string; answer: string; submittedAt: string };
      setSubmissionList(prev => {
        const existing = prev.findIndex(s => s.playerId === playerId);
        const entry = { playerId, playerName, answer, submittedAt };
        if (existing >= 0) return prev.map((s, i) => i === existing ? entry : s);
        return [...prev, entry];
      });
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, lastAnswer: answer, lastAnswerTime: submittedAt } : p));
    });

    return () => { offPlayerJoined(); offPlayerLeft(); offAnswerUpdate(); };
  }, [on, addToast]);

  const startClue = useCallback(async (clue: PlacedWord) => {
    if (!room || !layout) return;

    // Create game session in DB
    const token = localStorage.getItem('adminToken');
    const puzzle = room.puzzles[0];
    const res = await fetch(`/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ puzzleId: puzzle.id, clue, duration }),
    });
    const session = await res.json();
    if (!res.ok) { addToast(session.error || 'Gagal memulai sesi', 'error'); return; }

    setActiveSession({ id: session.id, clue, status: 'ACTIVE', duration });
    setCountdown(duration);
    setSubmissionList([]);
    setValidationResults({});

    // Broadcast to players
    emit('admin:open-clue', {
      roomCode: room.code,
      clueData: { ...clue, sessionId: session.id },
      duration,
    });

    addToast(`Soal ${clue.number} ${clue.direction === 'across' ? 'Mendatar' : 'Menurun'} dibuka!`, 'info');

    // Client-side countdown mirror (server broadcasts authoritatively)
    if (countdownRef.current) clearInterval(countdownRef.current);
    let rem = duration;
    countdownRef.current = setInterval(() => {
      rem -= 1;
      setCountdown(rem);
      if (rem <= 0) {
        clearInterval(countdownRef.current!);
        setActiveSession(prev => prev ? { ...prev, status: 'CLOSED' } : null);
      }
    }, 1000);
  }, [room, layout, duration, emit, addToast]);

  const stopCountdown = useCallback(() => {
    if (!room) return;
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(0);
    setActiveSession(prev => prev ? { ...prev, status: 'CLOSED' } : null);
    emit('admin:stop-countdown', { roomCode: room.code });
    addToast('Countdown dihentikan', 'warning');
  }, [room, emit, addToast]);

  const validateAnswers = useCallback(async () => {
    if (!activeSession || !room) return;

    const correctAnswer = activeSession.clue.word;
    const scoredResults = scoreSubmissions(
      submissionList.map(s => ({ playerId: s.playerId, answer: s.answer, submittedAt: s.submittedAt })),
      correctAnswer,
      100,
      50
    );

    // Save to DB
    const token = localStorage.getItem('adminToken');
    await fetch(`/api/sessions/${activeSession.id}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ results: scoredResults }),
    });

    // Update local state
    const withNames = scoredResults.map(r => ({
      ...r,
      playerName: submissionList.find(s => s.playerId === r.playerId)?.playerName || r.playerId,
    }));
    setSubmissionList(withNames);

    // Highlight correct cells on grid
    if (activeSession.clue) {
      const c = activeSession.clue;
      const cells: Record<string, boolean> = {};
      for (let i = 0; i < c.length; i++) {
        const row = c.direction === 'across' ? c.startRow : c.startRow + i;
        const col = c.direction === 'across' ? c.startCol + i : c.startCol;
        cells[`${row},${col}`] = true;
      }
      setValidationResults(cells);
    }

    // Update player points locally
    setPlayers(prev => prev.map(p => {
      const r = scoredResults.find(s => s.playerId === p.id);
      return r ? { ...p, totalPoints: p.totalPoints + r.points } : p;
    }));

    setActiveSession(prev => prev ? { ...prev, status: 'VALIDATED' } : null);
    setCompletedClues(prev => new Set([...prev, activeSession.clue.number]));

    // Broadcast results
    emit('admin:validate', {
      roomCode: room.code,
      results: scoredResults.map(r => ({
        ...r,
        playerName: submissionList.find(s => s.playerId === r.playerId)?.playerName || r.playerId,
      })),
    });

    addToast(`Validasi selesai! ${scoredResults.filter(r => r.isCorrect).length} jawaban benar.`, 'success');
  }, [activeSession, room, submissionList, emit, addToast]);

  const nextClue = useCallback(() => {
    if (!room) return;
    emit('admin:next-clue', { roomCode: room.code });
    setActiveSession(null);
    setSubmissionList([]);
    setValidationResults({});
    setLiveAnswers({});
  }, [room, emit]);

  const allClues = layout ? [...layout.clues.across, ...layout.clues.down] : [];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/admin')}>← Dashboard</button>
          <div className="logo">⬛ Kontrol Game</div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {room && <div className="badge badge-teal" style={{ fontFamily: 'var(--font-mono)' }}>{room.code}</div>}
          <div className={`status-dot ${connected ? 'online' : 'offline'}`} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {players.filter(p => p.isOnline).length} online
          </span>
        </div>
      </nav>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', overflow: 'hidden' }}>
        {/* Grid + Clue selector */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Controls bar */}
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label className="input-label" style={{ margin: 0 }}>Durasi:</label>
              <input
                className="input"
                type="number" min={10} max={300} step={5}
                value={duration}
                onChange={e => setDuration(parseInt(e.target.value) || 60)}
                style={{ width: '80px' }}
                disabled={activeSession?.status === 'ACTIVE'}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>detik</span>
            </div>

            {activeSession?.status === 'ACTIVE' && (
              <>
                <button className="btn btn-danger btn-sm" onClick={stopCountdown}>⏹ Stop</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { emit('admin:extend-time', { roomCode: room!.code, extraSeconds: 30 }); setCountdown(c => c + 30); addToast('+30 detik ditambahkan', 'info'); }}>
                  +30s
                </button>
              </>
            )}

            {(activeSession?.status === 'CLOSED') && (
              <button className="btn btn-amber btn-sm" onClick={validateAnswers}>
                ✓ Validasi Jawaban
              </button>
            )}

            {activeSession?.status === 'VALIDATED' && (
              <button className="btn btn-primary btn-sm" onClick={nextClue}>
                Soal Berikutnya →
              </button>
            )}

            {activeSession?.status === 'ACTIVE' && (
              <div style={{ marginLeft: 'auto' }}>
                <Countdown duration={activeSession.duration} remaining={countdown} size={60} />
              </div>
            )}
          </div>

          {/* Grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {layout ? (
              <CrosswordGrid
                cells={layout.cells}
                activeClue={activeSession?.clue}
                mode="admin"
                validationResult={validationResults}
                liveAnswers={liveAnswers}
                onCellClick={(cell) => {
                  if (activeSession?.status === 'ACTIVE' || activeSession?.status === 'CLOSED') return;
                  // Find clue for this cell
                  const clue = allClues.find(c => {
                    for (let i = 0; i < c.length; i++) {
                      const r = c.direction === 'across' ? c.startRow : c.startRow + i;
                      const co = c.direction === 'across' ? c.startCol + i : c.startCol;
                      if (r === cell.row && co === cell.col) return true;
                    }
                    return false;
                  });
                  if (clue) startClue(clue);
                }}
              />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧩</div>
                  <p>Belum ada puzzle. <a href={`/admin/room/${roomId}/setup`} style={{ color: 'var(--accent)' }}>Setup puzzle →</a></p>
                </div>
              </div>
            )}
          </div>

          {/* Clue list */}
          {layout && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '1rem', maxHeight: '220px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {(['across', 'down'] as const).map(dir => (
                  <div key={dir}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                      {dir === 'across' ? '→ Mendatar' : '↓ Menurun'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {layout.clues[dir].map(clue => {
                        const isActive = activeSession?.clue.number === clue.number && activeSession?.clue.direction === dir;
                        const isDone = completedClues.has(clue.number);
                        return (
                          <button
                            key={`${dir}-${clue.number}`}
                            className="btn btn-ghost btn-sm"
                            style={{
                              justifyContent: 'flex-start', textAlign: 'left', gap: '0.5rem',
                              background: isActive ? 'var(--accent-subtle)' : isDone ? 'rgba(34,211,165,0.07)' : 'transparent',
                              color: isActive ? 'var(--accent)' : isDone ? 'var(--text-muted)' : 'var(--text-secondary)',
                              border: isActive ? '1px solid rgba(0,229,200,0.25)' : isDone ? '1px solid rgba(34,211,165,0.15)' : '1px solid transparent',
                              fontSize: '0.8rem', padding: '0.3rem 0.5rem',
                              textDecoration: isDone ? 'line-through' : 'none',
                              cursor: activeSession?.status === 'ACTIVE' ? 'not-allowed' : 'pointer',
                            }}
                            disabled={activeSession?.status === 'ACTIVE' || activeSession?.status === 'CLOSED'}
                            onClick={() => startClue(clue)}
                          >
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{clue.number}.</span>
                            {clue.clue}
                            <span style={{ opacity: 0.5 }}>({clue.length})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel: Players + Submissions */}
        <div style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Active clue info */}
          {activeSession && (
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span className="badge badge-teal">{activeSession.clue.number}</span>
                <span className="badge badge-muted">{activeSession.clue.direction === 'across' ? '→ Mendatar' : '↓ Menurun'}</span>
                <span className={`badge ${activeSession.status === 'ACTIVE' ? 'badge-green' : activeSession.status === 'CLOSED' ? 'badge-amber' : 'badge-teal'}`}>
                  {activeSession.status}
                </span>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>{activeSession.clue.clue}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Kunci: {activeSession.status === 'VALIDATED' ? activeSession.clue.word : '•'.repeat(activeSession.clue.length)}
              </p>
            </div>
          )}

          {/* Submissions / Player answers */}
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', flex: '0 0 auto' }}>
            <h4 style={{ marginBottom: '0.875rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
              Jawaban Pemain ({submissionList.length}/{players.length})
            </h4>
            {submissionList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Belum ada jawaban masuk...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
                {submissionList.map(s => (
                  <div key={s.playerId} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.5rem 0.625rem', borderRadius: '6px',
                    background: s.isCorrect === true ? 'rgba(34,211,165,0.1)' : s.isCorrect === false ? 'rgba(255,77,109,0.1)' : 'var(--bg-elevated)',
                    border: s.isCorrect === true ? '1px solid rgba(34,211,165,0.25)' : s.isCorrect === false ? '1px solid rgba(255,77,109,0.2)' : '1px solid var(--border)',
                  }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s.playerName}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', marginLeft: '0.5rem', color: 'var(--accent)', fontWeight: 700 }}>
                        {s.answer}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {s.isCorrect !== undefined && (
                        <span style={{ color: s.isCorrect ? 'var(--green)' : 'var(--red)', fontSize: '0.9rem' }}>
                          {s.isCorrect ? '✓' : '✗'}
                        </span>
                      )}
                      {s.points !== undefined && s.points > 0 && (
                        <span className="badge badge-amber" style={{ fontSize: '0.75rem' }}>+{s.points}</span>
                      )}
                      {s.rank && s.isCorrect && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>#{s.rank}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }}>
            <h4 style={{ marginBottom: '0.875rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
              Papan Skor
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {[...players]
                .sort((a, b) => b.totalPoints - a.totalPoints)
                .map((player, idx) => (
                  <div key={player.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.625rem 0.75rem', borderRadius: '8px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem',
                      color: idx === 0 ? 'var(--amber)' : idx === 1 ? 'var(--text-secondary)' : 'var(--text-muted)',
                      width: '20px', textAlign: 'center',
                    }}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {player.displayName}
                        <div className={`status-dot ${player.isOnline ? 'online' : 'offline'}`} style={{ width: 6, height: 6 }} />
                      </div>
                      {player.lastAnswer && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          → {player.lastAnswer}
                        </div>
                      )}
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', fontSize: '0.9rem' }}>
                      {player.totalPoints}
                    </span>
                  </div>
                ))}
              {players.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Belum ada pemain yang bergabung.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPlayPage() {
  return (
    <ToastProvider>
      <AdminPlayContent />
    </ToastProvider>
  );
}

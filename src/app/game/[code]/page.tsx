// src/app/game/[code]/page.tsx
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/lib/socket';
import CrosswordGrid from '@/components/CrosswordGrid';
import { CountdownBar } from '@/components/Countdown';
import { ToastProvider, useToast } from '@/components/Toast';
import type { GridCell, PlacedWord, CrosswordLayout } from '@/lib/crossword';

interface GameState {
  status: 'waiting' | 'active' | 'closed' | 'validated';
  activeClue: (PlacedWord & { sessionId: string }) | null;
  countdown: number;
  totalDuration: number;
  locked: boolean;
  results: Array<{ playerId: string; playerName: string; answer: string; isCorrect: boolean; points: number; rank: number }> | null;
}

function GameContent() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();
  const { addToast } = useToast();
  const { on, emit, connected } = useSocket(code);

  const [layout, setLayout] = useState<CrosswordLayout | null>(null);
  const [players, setPlayers] = useState<Array<{ id: string; displayName: string; totalPoints: number; isOnline: boolean }>>([]);
  const [playerAnswers, setPlayerAnswers] = useState<Record<string, string>>({});
  const [gameState, setGameState] = useState<GameState>({
    status: 'waiting', activeClue: null, countdown: 0, totalDuration: 60, locked: true, results: null,
  });
  const [myScore, setMyScore] = useState(0);
  const [submittedAnswer, setSubmittedAnswer] = useState('');
  const [answerInput, setAnswerInput] = useState('');
  const hasSubmitted = useRef(false);

  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') || '' : '';
  const playerName = typeof window !== 'undefined' ? sessionStorage.getItem('playerName') || '' : '';

  // Load puzzle layout
  useEffect(() => {
    if (!playerId) { router.push('/'); return; }

    fetch(`/api/rooms/by-code/${code}`)
      .then(r => r.json())
      .then(room => {
        if (room.puzzles?.[0]) {
          const puzzle = room.puzzles[0];
          setLayout({ ...puzzle.layout, clues: puzzle.clues });
        }
        setPlayers(room.players || []);
      });
  }, [code, playerId, router]);

  // Join socket room
  useEffect(() => {
    if (!connected || !playerId) return;
    emit('join-room', { roomCode: code, playerId, playerName, role: 'PLAYER' });
  }, [connected, code, playerId, playerName, emit]);

  // Socket event listeners
  useEffect(() => {
    const offClueOpened = on('game:clue-opened', (data: unknown) => {
      const { clue, duration, startedAt } = data as { clue: PlacedWord & { sessionId: string }; duration: number; startedAt: string };
      setGameState({ status: 'active', activeClue: clue, countdown: duration, totalDuration: duration, locked: false, results: null });
      setPlayerAnswers({});
      setAnswerInput('');
      hasSubmitted.current = false;
      setSubmittedAnswer('');
      addToast(`Soal ${clue.number} (${clue.direction === 'across' ? 'Mendatar' : 'Menurun'}): ${clue.clue}`, 'info');
    });

    const offTick = on('game:tick', (data: unknown) => {
      const { remaining } = data as { remaining: number };
      setGameState(prev => ({ ...prev, countdown: remaining }));
    });

    const offTimeUp = on('game:time-up', () => {
      setGameState(prev => ({ ...prev, status: 'closed', locked: true }));
      addToast('⏰ Waktu habis! Input dikunci.', 'warning');
    });

    const offValidated = on('game:validated', (data: unknown) => {
      const { results } = data as { results: GameState['results'] };
      setGameState(prev => ({ ...prev, status: 'validated', results }));
      const myResult = results?.find(r => r.playerId === playerId);
      if (myResult) {
        if (myResult.isCorrect) {
          addToast(`✅ Benar! +${myResult.points} poin (peringkat #${myResult.rank})`, 'success');
          setMyScore(prev => prev + myResult.points);
        } else {
          addToast('❌ Jawaban kamu salah.', 'error');
        }
      }
    });

    const offClueClosed = on('game:clue-closed', () => {
      setGameState({ status: 'waiting', activeClue: null, countdown: 0, totalDuration: 60, locked: true, results: null });
    });

    const offPlayerJoined = on('player-joined', (data: unknown) => {
      const { playerName: name } = data as { playerName: string };
      addToast(`${name} bergabung ke room`, 'info');
    });

    const offPlayerLeft = on('player-left', (data: unknown) => {
      const { playerName: name } = data as { playerName: string };
      addToast(`${name} meninggalkan room`, 'warning');
    });

    return () => {
      offClueOpened();
      offTick();
      offTimeUp();
      offValidated();
      offClueClosed();
      offPlayerJoined();
      offPlayerLeft();
    };
  }, [on, addToast, playerId]);

  // Submit answer via socket
  const submitAnswer = useCallback(() => {
    if (!gameState.activeClue || gameState.locked || !answerInput.trim()) return;
    const answer = answerInput.trim().toUpperCase();
    emit('player:answer', {
      roomCode: code,
      sessionId: gameState.activeClue.sessionId,
      playerId,
      playerName,
      answer,
    });
    // Also save to DB
    fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: gameState.activeClue.sessionId, playerId, answer }),
    });
    setSubmittedAnswer(answer);
    hasSubmitted.current = true;
    addToast('Jawaban terkirim!', 'success');
  }, [gameState, answerInput, code, playerId, playerName, emit, addToast]);

  const myResult = gameState.results?.find(r => r.playerId === playerId);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav className="navbar">
        <div className="logo">⬛ CW_LIVE</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <div className={`status-dot ${connected ? 'online' : 'offline'}`} />
            {connected ? 'Terhubung' : 'Offline'}
          </div>
          <div className="badge badge-amber">{playerName}</div>
          <div className="badge badge-teal" style={{ fontFamily: 'var(--font-mono)' }}>
            {myScore} pts
          </div>
        </div>
      </nav>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 0, maxWidth: '100vw', overflow: 'hidden' }}>
        {/* Grid Area */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', overflowY: 'auto' }}>
          {layout ? (
            <CrosswordGrid
              cells={layout.cells}
              activeClue={gameState.activeClue}
              playerAnswers={playerAnswers}
              mode="player"
              locked={gameState.locked}
              onCellInput={(row, col, val) => {
                setPlayerAnswers(prev => ({ ...prev, [`${row},${col}`]: val }));
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧩</div>
              <p>Menunggu puzzle dimuat...</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{
          borderLeft: '1px solid var(--border)', background: 'var(--bg-surface)',
          display: 'flex', flexDirection: 'column', height: 'calc(100vh - 57px)',
          overflowY: 'auto',
        }}>
          {/* Status */}
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
            {gameState.status === 'waiting' && (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⏳</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Menunggu admin membuka soal...
                </p>
              </div>
            )}

            {(gameState.status === 'active' || gameState.status === 'closed') && gameState.activeClue && (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <CountdownBar duration={gameState.totalDuration} remaining={gameState.countdown} />
                </div>

                {/* Clue display */}
                <div style={{
                  background: 'var(--bg-elevated)', borderRadius: '10px', padding: '1rem',
                  border: '1px solid var(--border-hover)', marginBottom: '1rem',
                }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span className="badge badge-teal">{gameState.activeClue.number}</span>
                    <span className="badge badge-muted">
                      {gameState.activeClue.direction === 'across' ? '→ Mendatar' : '↓ Menurun'}
                    </span>
                    <span className="badge badge-muted">{gameState.activeClue.length} huruf</span>
                  </div>
                  <p style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 500, margin: 0 }}>
                    {gameState.activeClue.clue}
                  </p>
                </div>

                {/* Answer input (word-level) */}
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="input-label">Jawaban ({gameState.activeClue.length} huruf)</label>
                  <input
                    className="input"
                    style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '1.1rem', textAlign: 'center' }}
                    placeholder={'_ '.repeat(gameState.activeClue.length).trim()}
                    value={answerInput}
                    onChange={e => setAnswerInput(e.target.value.toUpperCase())}
                    maxLength={gameState.activeClue.length}
                    disabled={gameState.locked}
                    onKeyDown={e => e.key === 'Enter' && submitAnswer()}
                  />
                </div>

                {submittedAnswer && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '0.5rem', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                    ✓ Terkirim: {submittedAnswer}
                  </div>
                )}

                <button
                  className="btn btn-primary w-full"
                  disabled={gameState.locked || !answerInput.trim()}
                  onClick={submitAnswer}
                >
                  {gameState.locked ? '🔒 Waktu Habis' : '📤 Kirim Jawaban'}
                </button>
              </>
            )}

            {gameState.status === 'validated' && myResult && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                  {myResult.isCorrect ? '🎉' : '😔'}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700,
                  color: myResult.isCorrect ? 'var(--green)' : 'var(--red)',
                  marginBottom: '0.25rem',
                }}>
                  {myResult.isCorrect ? `+${myResult.points}` : '0'}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {myResult.isCorrect ? `Peringkat #${myResult.rank} dalam menjawab benar!` : 'Jawaban salah. Semangat!'}
                </p>
                {myResult.isCorrect && (
                  <div className="badge badge-amber" style={{ margin: '0.5rem auto', display: 'inline-flex' }}>
                    🏆 Rank #{myResult.rank}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clues list */}
          {layout && (
            <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }}>
              <h4 style={{ marginBottom: '1rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 700 }}>
                Daftar Soal
              </h4>
              
              {['across', 'down'].map(dir => (
                <div key={dir} style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 700 }}>
                    {dir === 'across' ? '→ MENDATAR' : '↓ MENURUN'}
                  </div>
                  {layout.clues[dir as 'across' | 'down'].map(clue => {
                    const isActive = gameState.activeClue?.number === clue.number && gameState.activeClue?.direction === dir;
                    return (
                      <div key={`${dir}-${clue.number}`} style={{
                        padding: '0.5rem 0.625rem', borderRadius: '6px', marginBottom: '0.25rem',
                        background: isActive ? 'var(--accent-subtle)' : 'transparent',
                        border: isActive ? '1px solid rgba(0,229,200,0.2)' : '1px solid transparent',
                        transition: 'all 0.2s',
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: isActive ? 'var(--accent)' : 'var(--text-muted)', marginRight: '0.5rem', fontWeight: 700 }}>
                          {clue.number}.
                        </span>
                        <span style={{ fontSize: '0.85rem', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {clue.clue}
                        </span>
                        <span style={{ marginLeft: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ({clue.length})
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* My total score */}
          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL POIN</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--accent)' }}>
                {myScore}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GamePage() {
  return (
    <ToastProvider>
      <GameContent />
    </ToastProvider>
  );
}

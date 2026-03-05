// src/app/admin/room/[id]/setup/page.tsx — Puzzle Setup
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { generateCrossword } from '@/lib/crossword';
import CrosswordGrid from '@/components/CrosswordGrid';
import type { WordEntry, CrosswordLayout } from '@/lib/crossword';

interface WordRow { word: string; clue: string; }

export default function PuzzleSetupPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [roomInfo, setRoomInfo] = useState<{ name: string; code: string } | null>(null);
  const [words, setWords] = useState<WordRow[]>([
    { word: '', clue: '' },
    { word: '', clue: '' },
  ]);
  const [layout, setLayout] = useState<CrosswordLayout | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [puzzleTitle, setPuzzleTitle] = useState('Puzzle 1');

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    fetch(`/api/rooms/${roomId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setRoomInfo({ name: data.name, code: data.code }));
  }, [roomId]);

  const updateWord = (idx: number, field: 'word' | 'clue', val: string) => {
    setWords(prev => prev.map((w, i) => i === idx ? { ...w, [field]: val } : w));
    setLayout(null);
    setSaved(false);
  };

  const addWord = () => setWords(prev => [...prev, { word: '', clue: '' }]);
  const removeWord = (idx: number) => {
    if (words.length <= 2) return;
    setWords(prev => prev.filter((_, i) => i !== idx));
    setLayout(null);
    setSaved(false);
  };

  const generateLayout = useCallback(() => {
    setError('');
    const entries: WordEntry[] = words
      .filter(w => w.word.trim().length >= 3 && w.clue.trim())
      .map(w => ({ word: w.word.trim().toUpperCase(), clue: w.clue.trim() }));

    if (entries.length < 2) {
      setError('Masukkan minimal 2 kata (dengan panjang ≥ 3 huruf) dan soal/petunjuknya.');
      return;
    }

    try {
      const result = generateCrossword(entries);
      setLayout(result);
      setSaved(false);
    } catch {
      setError('Gagal generate layout. Coba kata-kata yang berbeda.');
    }
  }, [words]);

  const saveAndGenerate = async () => {
    if (!layout) { generateLayout(); return; }
    setSaving(true);
    setError('');

    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`/api/rooms/${roomId}/puzzle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: puzzleTitle,
          layout: { rows: layout.rows, cols: layout.cols, cells: layout.cells },
          clues: layout.clues,
          wordCount: layout.placedWords.length,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      setSaved(true);
      setTimeout(() => router.push(`/admin/room/${roomId}/play`), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const validWords = words.filter(w => w.word.trim().length >= 3 && w.clue.trim());

  return (
    <div style={{ minHeight: '100vh' }}>
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/admin')}>← Dashboard</button>
          <div className="logo">⬛ Setup Puzzle</div>
        </div>
        {roomInfo && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{roomInfo.name}</span>
            <div className="badge badge-teal" style={{ fontFamily: 'var(--font-mono)' }}>{roomInfo.code}</div>
          </div>
        )}
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', minHeight: 'calc(100vh - 57px)', overflow: 'hidden' }}>
        {/* Left: Word input */}
        <div style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.25rem' }}>Daftar Kata & Soal</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Minimal 3 huruf per kata. Setelah selesai, klik Generate Layout.
          </p>

          {/* Puzzle title */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="input-label">Judul Puzzle</label>
            <input className="input" value={puzzleTitle} onChange={e => setPuzzleTitle(e.target.value)} />
          </div>

          {/* Word rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {words.map((w, i) => (
              <div key={i} style={{
                background: 'var(--bg-elevated)', borderRadius: '10px', padding: '0.875rem',
                border: `1px solid ${w.word.trim().length >= 3 && w.clue.trim() ? 'rgba(0,229,200,0.15)' : 'var(--border)'}`,
                transition: 'border-color 0.2s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 700 }}>
                    KATA {String(i + 1).padStart(2, '0')}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '0.15rem 0.4rem', color: 'var(--red)', borderColor: 'transparent' }}
                    onClick={() => removeWord(i)}
                    disabled={words.length <= 2}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input
                    className="input"
                    placeholder="Jawaban (kata)"
                    value={w.word}
                    onChange={e => updateWord(i, 'word', e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                  />
                  <input
                    className="input"
                    placeholder="Soal / petunjuk"
                    value={w.clue}
                    onChange={e => updateWord(i, 'clue', e.target.value)}
                  />
                  {w.word.trim() && (
                    <div style={{ fontSize: '0.75rem', color: w.word.trim().length >= 3 ? 'var(--accent)' : 'var(--red)' }}>
                      {w.word.trim().length} huruf {w.word.trim().length < 3 ? '(min 3)' : '✓'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-ghost w-full btn-sm" style={{ marginBottom: '1.25rem' }} onClick={addWord}>
            + Tambah Kata
          </button>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            {validWords.length} kata valid dari {words.length} kata
          </div>

          {error && (
            <div style={{ padding: '0.75rem', background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)', borderRadius: '8px', color: 'var(--red)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary w-full"
              onClick={generateLayout}
              disabled={validWords.length < 2}
            >
              🔄 Generate Layout
            </button>

            <button
              className="btn btn-primary w-full btn-lg"
              onClick={saveAndGenerate}
              disabled={saving || !layout}
            >
              {saving ? 'Menyimpan...' : saved ? '✅ Tersimpan! Menuju Game...' : '💾 Save & Lanjutkan →'}
            </button>
          </div>
        </div>

        {/* Right: Grid preview */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: layout ? 'flex-start' : 'center', padding: '2rem', gap: '1.5rem' }}>
          {!layout ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.4 }}>⬛⬜⬛</div>
              <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
                Isi kata dan klik <strong style={{ color: 'var(--accent)' }}>Generate Layout</strong> untuk melihat grid TTS
              </p>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ marginBottom: '0.25rem' }}>{puzzleTitle}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {layout.placedWords.length} kata terpasang · {layout.rows}×{layout.cols} grid
                </p>
              </div>

              <CrosswordGrid
                cells={layout.cells}
                mode="view"
                revealedAnswers={(() => {
                  const m: Record<string, string> = {};
                  layout.cells.forEach(row => row.forEach(cell => {
                    if (!cell.isBlack && cell.letter) m[`${cell.row},${cell.col}`] = cell.letter;
                  }));
                  return m;
                })()}
              />

              {/* Clues preview */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', width: '100%', maxWidth: '700px' }}>
                {(['across', 'down'] as const).map(dir => (
                  <div key={dir}>
                    <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem', fontWeight: 700 }}>
                      {dir === 'across' ? '→ Mendatar' : '↓ Menurun'}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {layout.clues[dir].map(clue => (
                        <div key={clue.number} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginRight: '0.35rem' }}>{clue.number}.</strong>
                          {clue.clue} <span style={{ color: 'var(--text-muted)' }}>({clue.length})</span>
                        </div>
                      ))}
                      {layout.clues[dir].length === 0 && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Tidak ada soal</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn btn-ghost btn-sm" onClick={generateLayout}>
                🔄 Regenerate Layout
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

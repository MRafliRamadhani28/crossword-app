'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, Reorder } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { CrosswordGrid } from '@/components/game/CrosswordGrid';
import { Tooltip } from '@/components/ui/Tooltip';
import { LoadingSpinner, LoadingDots } from '@/components/ui/Loading';
import { useUI } from '@/components/ui/UIProvider';

interface PuzzleEntry {
  id: string;
  word: string;
  question: string;
  hint: string;
  basePoints: number;
  timeLimit: number;
}

const DEFAULT_CONFIG = {
  timePerQuestion: 30,
  basePoints: 100,
  timeMultiplier: 3,
  showLeaderboardAfterEach: true,
  allowHints: false,
};

export default function HostSetupPage() {
  const router = useRouter();
  const { toast, confirm } = useUI();
  const [step, setStep] = useState<'info' | 'puzzles' | 'preview' | 'created'>('info');
  const [roomName, setRoomName] = useState('');
  const [capacity, setCapacity] = useState(65);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [puzzles, setPuzzles] = useState<PuzzleEntry[]>([]);
  const [previewPuzzles, setPreviewPuzzles] = useState<unknown[]>([]);
  const [createdRoom, setCreatedRoom] = useState<{ id: string; code: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function addPuzzle() {
    setPuzzles((prev) => [
      ...prev,
      { id: Date.now().toString(), word: '', question: '', hint: '', basePoints: 100, timeLimit: 30 },
    ]);
  }

  function removePuzzle(id: string) {
    if (puzzles.length <= 1) {
      toast.warning('Minimal harus ada 1 soal');
      return;
    }
    setPuzzles((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePuzzle(id: string, field: keyof PuzzleEntry, value: string | number) {
    setPuzzles((prev) => prev.map((p) => p.id === id ? { ...p, [field]: value } : p));
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setError('');

    try {
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());
      
      if (lines.length < 2) {
        throw new Error('File kosong atau tidak ada data');
      }

      // Parse CSV - skip header row
      const headers = lines[0].toLowerCase().split(',').map((h) => h.trim());
      const wordIndex = headers.findIndex((h) => h === 'word' || h === 'answer' || h === 'jawaban');
      const questionIndex = headers.findIndex((h) => h === 'question' || h === 'pertanyaan' || h === 'clue');
      const hintIndex = headers.findIndex((h) => h === 'hint' || h === 'hints' || h === 'bantuan');
      const basePointsIndex = headers.findIndex((h) => h === 'basepoints' || h === 'points' || h === 'poin');
      const timeLimitIndex = headers.findIndex((h) => h === 'timelimit' || h === 'time' || h === 'waktu');

      if (wordIndex === -1 || questionIndex === -1) {
        throw new Error('File harus memiliki kolom "word" (atau "answer") dan "question" (atau "pertanyaan")');
      }

      const importedPuzzles: PuzzleEntry[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim());
        
        if (values.length <= Math.max(wordIndex, questionIndex)) continue;

        const word = values[wordIndex]?.replace(/^"|"$/g, '') || '';
        const question = values[questionIndex]?.replace(/^"|"$/g, '') || '';
        const hint = hintIndex >= 0 ? (values[hintIndex]?.replace(/^"|"$/g, '') || '') : '';
        const basePoints = basePointsIndex >= 0 ? parseInt(values[basePointsIndex]) || 100 : 100;
        const timeLimit = timeLimitIndex >= 0 ? parseInt(values[timeLimitIndex]) || 30 : 30;

        if (word && question) {
          importedPuzzles.push({
            id: (Date.now() + i).toString(),
            word: word.toUpperCase(),
            question,
            hint,
            basePoints,
            timeLimit,
          });
        }
      }

      if (importedPuzzles.length === 0) {
        throw new Error('Tidak ada data yang valid di file');
      }

      // REPLACE semua puzzles dengan data import (bukan append)
      setPuzzles(importedPuzzles);
      toast.success(`Berhasil import ${importedPuzzles.length} soal!`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal import file');
    } finally {
      setImportLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handlePreview() {
    setError('');

    // Filter only valid puzzles (with word and question)
    const valid = puzzles.filter((p) => p.word.trim() && p.question.trim());

    console.log('[Preview] Total puzzles:', puzzles.length);
    console.log('[Preview] Valid puzzles:', valid.length, valid.map(p => p.word));

    if (valid.length === 0) {
      setError('⚠️ Tidak ada soal valid. Import dari CSV atau tambah soal manual.');
      return;
    }

    if (valid.length < 2) {
      setError('⚠️ Minimal 2 soal untuk membuat grid crossword. Saat ini hanya ada ' + valid.length + ' soal valid.');
      return;
    }

    setPreviewLoading(true);

    try {
      const { CrosswordGenerator } = await import('@/core/use-cases/crosswordGenerator');
      const gen = new CrosswordGenerator();

      console.log('[Preview] Generating grid with:', valid.map(p => p.word.toUpperCase()));

      // Simulasi delay agar loading terlihat smooth
      await new Promise(resolve => setTimeout(resolve, 800));

      const result = gen.generate(valid.map((p) => ({
        word: p.word.toUpperCase(),
        question: p.question,
        hint: p.hint || undefined,
        basePoints: p.basePoints,
        timeLimit: p.timeLimit,
      })));

      console.log('[Preview] Generator result:', result);

      if (!result || !result.placements || result.placements.length === 0) {
        setError('⚠️ Gagal membuat grid. Kombinasi kata tidak dapat membentuk crossword. Coba ubah kombinasi kata agar ada huruf yang sama untuk berpotongan.');
        return;
      }

      // Validate placements - must have actual data (not empty arrays)
      const validPlacements = result.placements.filter((pl) => {
        const hasData = pl && pl.word && pl.question &&
                        pl.row !== undefined && pl.col !== undefined &&
                        pl.orientation && pl.length;
        if (!hasData) {
          console.warn('[Preview] Invalid placement:', pl);
        }
        return hasData;
      });

      console.log('[Preview] Valid placements after filter:', validPlacements.length);

      if (validPlacements.length > 0) {
        // Normalisasi: geser semua koordinat agar minimum = 1
        const minRow = Math.min(...validPlacements.map((pl) => pl.row));
        const minCol = Math.min(...validPlacements.map((pl) => pl.col));
        const offsetRow = minRow < 1 ? 1 - minRow : 0;
        const offsetCol = minCol < 1 ? 1 - minCol : 0;

        const normalized = validPlacements.map((pl) => ({
          ...pl,
          row: pl.row + offsetRow,
          col: pl.col + offsetCol,
        }));

        setPreviewPuzzles(normalized.map((pl, i) => ({
          id: `preview-${i}`,
          ...pl,
          answer: pl.word,      // fix field mismatch
          clueNumber: i + 1,    // fix: CrosswordGrid butuh field ini!
          isOpened: false,
          isRevealed: false,
        })));

        console.log('[Preview] Success woiiiii! Navigating to preview with', validPlacements.length, 'placements');
        setStep('preview');
      } else {
        setError('⚠️ Gagal membuat grid crossword. Kombinasi kata tidak dapat saling berpotongan. Gunakan kata-kata yang memiliki huruf sama.');
        return;
      }
    } catch (e: unknown) {
      console.error('[Preview] Error:', e);
      const errorMsg = e instanceof Error ? e.message : 'Gagal generate preview';
      setError('⚠️ ' + errorMsg);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleCreate() {
    setLoading(true);
    setError('');

    try {
      const valid = puzzles.filter((p) => p.word.trim() && p.question.trim());
      const hostName = localStorage.getItem('player_name') || 'Host';
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roomName.trim(),
          hostName,
          capacity,
          config,
          puzzles: valid.map((p) => ({
            word: p.word.toUpperCase(),
            question: p.question,
            hint: p.hint || undefined,
            basePoints: p.basePoints,
            timeLimit: p.timeLimit,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(Array.isArray(data.error) ? data.error[0]?.message : data.error);

      // Simpan room ke localStorage untuk tracking multiple rooms
      const roomsJson = localStorage.getItem('host_rooms');
      let rooms: Array<{ id: string; code: string; name: string; status: string; createdAt: string }> = [];
      if (roomsJson) {
        try {
          rooms = JSON.parse(roomsJson);
        } catch {
          rooms = [];
        }
      }
      
      const newRoom = {
        id: data.room.id,
        code: data.room.code,
        name: data.room.name,
        status: data.room.status || 'WAITING',
        createdAt: data.room.createdAt || new Date().toISOString(),
      };
      
      // Cek apakah room sudah ada
      const existingIndex = rooms.findIndex(r => r.id === newRoom.id);
      if (existingIndex >= 0) {
        rooms[existingIndex] = newRoom;
      } else {
        rooms.push(newRoom);
      }
      
      localStorage.setItem('host_rooms', JSON.stringify(rooms));
      localStorage.setItem('host_room_code', data.room.code);
      localStorage.setItem('host_room_id', data.room.id);
      
      setCreatedRoom(data.room);
      setStep('created');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal membuat room');
    } finally {
      setLoading(false);
    }
  }

  const validPuzzles = puzzles.filter((p) => p.word.trim() && p.question.trim());

  console.log('[Render] step:', step, 'validPuzzles:', validPuzzles.length, 'previewPuzzles:', previewPuzzles.length);

  return (
    <main className="min-h-screen p-4 py-8 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <button onClick={() => router.push('/')} className="text-zinc-500 hover:text-white text-sm mb-4 flex items-center gap-2">
          ← Kembali
        </button>
        <h1 className="font-display text-3xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif', color: '#FFE500' }}>
          Buat Room
        </h1>

        {/* Steps indicator */}
        <div className="flex items-center gap-3 mt-4">
          {(['info', 'puzzles', 'preview', 'created'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold cursor-pointer"
                style={{
                  background: step === s ? '#FFE500' : s < step ? 'rgba(255,229,0,0.2)' : 'rgba(255,255,255,0.05)',
                  color: step === s ? '#000' : step > s ? '#FFE500' : '#666',
                }}
                onClick={() => { if ((s === 'info' || s === 'puzzles') && roomName) setStep(s); }}
              >
                {i + 1}
              </div>
              {i < 3 && <div className="w-8 h-px bg-zinc-700" />}
            </div>
          ))}
          <span className="text-zinc-500 text-sm ml-2 capitalize">{step === 'created' ? 'Selesai' : step}</span>
        </div>
      </motion.div>

      <div className="relative min-h-[400px]">
        {/* ── Step 1: Info ── */}
        {step === 'info' && (
          <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div className="glass-card p-6 space-y-4">
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Nama Event *</label>
                <input type="text" placeholder="e.g. Teka-Teki Bandung 2025" value={roomName}
                  onChange={(e) => setRoomName(e.target.value)} className="input-dark w-full px-4 py-3" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Kapasitas Pemain</label>
                <input type="number" min={2} max={500} value={capacity}
                  onChange={(e) => setCapacity(parseInt(e.target.value))} className="input-dark w-full px-4 py-3" />
              </div>
            </div>

            <div className="glass-card p-6 space-y-4">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-zinc-300" style={{ fontFamily: 'Syne, sans-serif' }}>
                ⚙️ Konfigurasi
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Waktu/Soal (detik)</label>
                  <input type="number" min={10} max={120} value={config.timePerQuestion}
                    onChange={(e) => setConfig((c) => ({ ...c, timePerQuestion: parseInt(e.target.value) }))}
                    className="input-dark w-full px-4 py-3" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Poin Dasar</label>
                  <input type="number" min={10} max={1000} value={config.basePoints}
                    onChange={(e) => setConfig((c) => ({ ...c, basePoints: parseInt(e.target.value) }))}
                    className="input-dark w-full px-4 py-3" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs text-zinc-400 uppercase tracking-wider">Time Multiplier</label>
                    <Tooltip content="Pengali poin berdasarkan sisa waktu. Rumus: Poin Tambahan = Sisa Waktu × Multiplier. Contoh: Multiplier 3x, jawab dalam 8 detik dari 30 detik = 22 detik tersisa × 3 = 66 poin tambahan.">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-700 hover:bg-zinc-600 text-zinc-400 hover:text-zinc-200 text-xs font-bold cursor-help transition-colors">
                        ?
                      </span>
                    </Tooltip>
                  </div>
                  <input type="number" min={1} max={10} step={0.5} value={config.timeMultiplier}
                    onChange={(e) => setConfig((c) => ({ ...c, timeMultiplier: parseFloat(e.target.value) }))}
                    className="input-dark w-full px-4 py-3" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="leaderboard" checked={config.showLeaderboardAfterEach}
                  onChange={(e) => setConfig((c) => ({ ...c, showLeaderboardAfterEach: e.target.checked }))}
                  className="w-4 h-4 accent-yellow-400" />
                <label htmlFor="leaderboard" className="text-sm text-zinc-300">Tampilkan leaderboard setelah tiap soal</label>
              </div>
            </div>

            <button
              onClick={() => setStep('puzzles')}
              disabled={!roomName.trim()}
              className="btn-primary w-full py-4 text-lg disabled:opacity-40"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Lanjut: Tambah Soal →
            </button>
          </motion.div>
        )}

        {/* ── Step 2: Puzzles ── */}
        {step === 'puzzles' && (
          <motion.div key="puzzles" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            {/* Import bar */}
            <div className="glass-card p-4 mb-4 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">Import dari CSV/Excel</p>
                <p className="text-xs text-zinc-500 mt-0.5">Kolom: answer, question, hint (opsional)</p>
              </div>
              <a
                href="/template-soal.csv"
                download="template-soal.csv"
                className="btn-outline px-4 py-2 text-xs text-blue-400 border-blue-400/30 hover:border-blue-400/50"
              >
                📥 Download Template
              </a>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importLoading}
                className="btn-outline px-4 py-2 text-sm relative min-w-[80px] flex items-center justify-center gap-2"
              >
                {importLoading ? (
                  <><LoadingDots /> <span className="text-xs">Importing...</span></>
                ) : (
                  '📁 Import'
                )}
              </button>
            </div>

            {/* Header with puzzle count */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-zinc-300" style={{ fontFamily: 'Syne, sans-serif' }}>
                Daftar Soal ({puzzles.length})
              </h3>
            </div>

            <Reorder.Group values={puzzles} onReorder={setPuzzles} className="space-y-3">
              {puzzles.map((puzzle, idx) => (
                <Reorder.Item key={puzzle.id} value={puzzle}>
                  <div className="glass-card p-4 relative">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-zinc-600 cursor-grab text-xl">⠿</span>
                      <span className="font-display text-sm font-bold text-yellow-400" style={{ fontFamily: 'Syne, sans-serif' }}>
                        Soal {idx + 1}
                      </span>
                      <div className="flex-1" />
                      <button
                        onClick={() => removePuzzle(puzzle.id)}
                        disabled={puzzles.length <= 1}
                        className="text-zinc-600 hover:text-red-400 transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                        title={puzzles.length <= 1 ? 'Minimal 1 soal' : 'Hapus soal'}
                      >
                        ✕ Hapus
                      </button>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Jawaban (e.g. BANDUNG)"
                        value={puzzle.word}
                        onChange={(e) => updatePuzzle(puzzle.id, 'word', e.target.value.toUpperCase())}
                        className="input-dark w-full px-3 py-2 text-sm uppercase tracking-widest"
                        style={{ fontFamily: 'Syne, sans-serif' }}
                      />
                      <input
                        type="text"
                        placeholder="Pertanyaan / Clue"
                        value={puzzle.question}
                        onChange={(e) => updatePuzzle(puzzle.id, 'question', e.target.value)}
                        className="input-dark w-full px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Hint (opsional)"
                        value={puzzle.hint}
                        onChange={(e) => updatePuzzle(puzzle.id, 'hint', e.target.value)}
                        className="input-dark w-full px-3 py-2 text-sm"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-zinc-600 block mb-1">Poin dasar</label>
                          <input type="number" value={puzzle.basePoints}
                            onChange={(e) => updatePuzzle(puzzle.id, 'basePoints', parseInt(e.target.value))}
                            className="input-dark w-full px-3 py-2 text-sm" min={10} max={1000} />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-600 block mb-1">Batas waktu (dtk)</label>
                          <input type="number" value={puzzle.timeLimit}
                            onChange={(e) => updatePuzzle(puzzle.id, 'timeLimit', parseInt(e.target.value))}
                            className="input-dark w-full px-3 py-2 text-sm" min={10} max={120} />
                        </div>
                      </div>
                    </div>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>

            {/* Add puzzle button - always visible at bottom */}
            <button
              onClick={addPuzzle}
              className="w-full mt-3 py-4 border-2 border-dashed border-zinc-700 hover:border-yellow-400/50 text-zinc-500 hover:text-yellow-400 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              <span className="text-lg">+</span> Tambah Soal Manual
            </button>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg bg-red-500/20 border border-red-500/50 mt-4"
              >
                <p className="text-red-400 font-medium flex items-center gap-2">
                  <span className="text-xl">⚠️</span> {error}
                </p>
              </motion.div>
            )}

            {puzzles.length === 0 && (
              <p className="text-sm text-center py-8 text-zinc-500">
                💡 Import dari CSV atau klik "Tambah Soal Manual" untuk melanjutkan
              </p>
            )}

            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep('info')} className="btn-outline px-6 py-3 flex-shrink-0">←</button>
              <button
                onClick={handlePreview}
                disabled={validPuzzles.length === 0 || previewLoading}
                className="btn-primary flex-1 py-3 disabled:opacity-40 relative overflow-hidden flex items-center justify-center gap-2"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                {previewLoading ? (
                  <><LoadingSpinner size="sm" /> <span>Membuat Preview...</span></>
                ) : (
                  `Preview Grid (${validPuzzles.length} soal) →`
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 3: Preview ── */}
        {step === 'preview' && (
          <motion.div key={"preview"} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="glass-card p-6 mb-6 relative">
              {loading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
                  <div className="text-zinc-400">Membuat Room...</div>
                </div>
              )}
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-zinc-300 mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Preview Crossword - {previewPuzzles.length} puzzles
              </h3>
              <div className="overflow-x-auto min-h-[200px] bg-white/5 rounded-lg p-4">
                {previewPuzzles.length > 0 ? (
                  <>
                    <p className="text-xs text-green-400 mb-4 font-bold">✓ Rendering {previewPuzzles.length} puzzles...</p>
                    <CrosswordGrid puzzles={previewPuzzles as Parameters<typeof CrosswordGrid>[0]['puzzles']} />
                  </>
                ) : (
                  <p className="text-zinc-500 text-center py-8">No puzzles to display</p>
                )}
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg bg-red-500/20 border border-red-500/50 mb-4"
              >
                <p className="text-red-400 font-medium flex items-center gap-2">
                  <span className="text-xl">⚠️</span> {error}
                </p>
              </motion.div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep('puzzles')} className="btn-outline px-6 py-3 flex-shrink-0">← Kembali</button>
              <button
                onClick={handleCreate}
                disabled={loading || previewPuzzles.length === 0}
                className="btn-primary flex-1 py-4 text-lg disabled:opacity-40 relative overflow-hidden flex items-center justify-center gap-2"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                {loading ? (
                  <><LoadingSpinner size="sm" /> <span>Membuat Room...</span></>
                ) : (
                  '🚀 Buat Room'
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 4: Created - QR Code + Share ── */}
        {step === 'created' && createdRoom && (
          <motion.div key="created" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-6">
            <div className="glass-card p-8 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="mb-6"
              >
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="font-display text-2xl font-extrabold text-yellow-400" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Room Berhasil Dibuat!
                </h2>
              </motion.div>

              <div className="mb-6">
                <p className="text-zinc-400 text-sm uppercase tracking-wider mb-3">Kode Room</p>
                <p className="font-display text-5xl font-extrabold tracking-widest text-yellow-400"
                  style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '0.3em' }}>
                  {createdRoom.code}
                </p>
              </div>

              {/* QR Code */}
              <div className="bg-white p-6 rounded-2xl inline-block mx-auto mb-6">
                <QRCodeSVG
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/room/${createdRoom.code}`}
                  size={200}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>

              <p className="text-zinc-400 text-sm mb-6">Scan QR code untuk join ke room</p>

              {/* Share Buttons */}
              <div className="flex gap-3 mb-6">
                <button
                  onClick={async () => {
                    const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/room/${createdRoom.code}`;
                    await navigator.clipboard.writeText(shareUrl);
                    toast.success('Link disalin ke clipboard!');
                  }}
                  className="btn-primary flex-1 py-3"
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  📋 Copy Link
                </button>
                <button
                  onClick={async () => {
                    const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/room/${createdRoom.code}`;
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: 'Join Crossword Room',
                          text: `Join room ${createdRoom.code}!`,
                          url: shareUrl,
                        });
                      } catch (e) {
                        // User cancelled or share failed
                      }
                    } else {
                      await navigator.clipboard.writeText(shareUrl);
                      toast.success('Link disalin ke clipboard!');
                    }
                  }}
                  className="btn-primary flex-1 py-3"
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  📤 Share
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => router.push(`/host/game/${createdRoom.code}`)}
                  className="btn-outline flex-1 py-3"
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  🎮 Kelola Room
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="btn-outline flex-1 py-3"
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  🏠 Kembali
                </button>
              </div>
            </div>

            {/* Buat Room Baru */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-6"
            >
              <p className="text-zinc-400 text-sm text-center mb-4">Ingin membuat room lainnya?</p>
              <button
                onClick={() => {
                  setRoomName('');
                  setCapacity(65);
                  setConfig(DEFAULT_CONFIG);
                  setPuzzles([]);
                  setPreviewPuzzles([]);
                  setCreatedRoom(null);
                  setError('');
                  setStep('info');
                }}
                className="btn-primary w-full py-4 text-lg"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                ➕ Buat Room Baru
              </button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </main>
  );
}

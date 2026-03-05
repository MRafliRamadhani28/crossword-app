// src/app/join/[code]/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface RoomInfo {
  id: string;
  name: string;
  code: string;
  capacity: number;
  playerCount: number;
  status: string;
}

export default function JoinRoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetch(`/api/rooms/by-code/${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setRoom(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Gagal memuat informasi room.');
        setLoading(false);
      });
  }, [code]);

  const handleJoin = async () => {
    if (!playerName.trim() || !room) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: playerName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal bergabung');

      // Store player info in sessionStorage
      sessionStorage.setItem('playerId', data.playerId);
      sessionStorage.setItem('playerName', playerName.trim());
      sessionStorage.setItem('roomCode', code);

      router.push(`/game/${code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal bergabung');
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            ⬛ Memuat...
          </div>
          <p style={{ color: 'var(--text-muted)' }}>Mencari room {code}</p>
        </div>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="card" style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
          <h2 style={{ color: 'var(--red)', marginBottom: '0.5rem' }}>Room Tidak Ditemukan</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Kode room <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>{code}</strong> tidak valid atau sudah tidak aktif.
          </p>
          <button className="btn btn-secondary" onClick={() => router.push('/')}>← Kembali</button>
        </div>
      </div>
    );
  }

  const isFull = room && room.playerCount >= room.capacity;
  const isFinished = room?.status === 'FINISHED';

  return (
    <main className="flex items-center justify-center" style={{ minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: '440px', width: '100%' }}>
        {/* Back */}
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: '1.5rem' }} onClick={() => router.push('/')}>
          ← Beranda
        </button>

        {/* Room Info Card */}
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--border-hover)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>
                Room
              </div>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{room?.name}</h2>
            </div>
            <div className="badge badge-teal" style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', padding: '0.4rem 0.75rem' }}>
              {code}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="stat-card" style={{ padding: '0.875rem' }}>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{room?.playerCount}</div>
              <div className="stat-label">Pemain</div>
            </div>
            <div className="stat-card" style={{ padding: '0.875rem' }}>
              <div className="stat-value" style={{ fontSize: '1.5rem', color: isFull ? 'var(--red)' : 'var(--accent)' }}>
                {room?.capacity}
              </div>
              <div className="stat-label">Kapasitas</div>
            </div>
          </div>

          {isFull && (
            <div style={{ marginTop: '0.75rem', padding: '0.625rem', background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)', borderRadius: '8px', color: 'var(--red)', fontSize: '0.875rem', textAlign: 'center' }}>
              ⚠️ Room penuh. Tidak dapat bergabung.
            </div>
          )}
          {isFinished && (
            <div style={{ marginTop: '0.75rem', padding: '0.625rem', background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)', borderRadius: '8px', color: 'var(--red)', fontSize: '0.875rem', textAlign: 'center' }}>
              🏁 Permainan sudah selesai.
            </div>
          )}
        </div>

        {/* Join Form */}
        {!isFull && !isFinished && (
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem' }}>Masukkan Nama Anda</h3>

            {error && (
              <div style={{ padding: '0.625rem 0.875rem', background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)', borderRadius: '8px', color: 'var(--red)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="input-label">Nama Tampilan</label>
              <input
                className="input"
                placeholder="Nama panggilan kamu..."
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                maxLength={30}
                onKeyDown={e => e.key === 'Enter' && !joining && playerName.trim() && handleJoin()}
                autoFocus
              />
            </div>

            <button
              className="btn btn-primary w-full btn-lg"
              disabled={!playerName.trim() || joining}
              onClick={handleJoin}
            >
              {joining ? 'Bergabung...' : 'Masuk ke Room →'}
            </button>

            <p style={{ marginTop: '0.875rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Dengan bergabung, Anda menyetujui untuk bermain secara sportif.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

// src/app/admin/page.tsx — Admin Dashboard
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Room {
  id: string;
  name: string;
  code: string;
  capacity: number;
  status: string;
  playerCount: number;
  createdAt: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', capacity: 20 });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    const token = localStorage.getItem('adminToken');
    const res = await fetch('/api/rooms', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setRooms(data.rooms || []);
    setLoading(false);
  };

  const createRoom = async () => {
    if (!newRoom.name.trim()) return;
    setCreating(true);
    const token = localStorage.getItem('adminToken');
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(newRoom),
    });
    const data = await res.json();
    if (res.ok) {
      setRooms(prev => [data.room, ...prev]);
      setShowCreate(false);
      setNewRoom({ name: '', capacity: 20 });
      router.push(`/admin/room/${data.room.id}/setup`);
    }
    setCreating(false);
  };

  const statusColor = (s: string) => s === 'WAITING' ? 'var(--text-muted)' : s === 'ACTIVE' ? 'var(--green)' : 'var(--red)';
  const statusLabel = (s: string) => ({ WAITING: 'Menunggu', ACTIVE: 'Aktif', FINISHED: 'Selesai' }[s] || s);

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Navbar */}
      <nav className="navbar">
        <div className="logo">⬛ CW_LIVE / Admin</div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            + Buat Room
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('adminToken'); router.push('/admin/login'); }}>
            Logout
          </button>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ marginBottom: '0.25rem' }}>Dashboard Admin</h1>
          <p>Kelola room permainan dan sesi TTS Anda.</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          <div className="stat-card">
            <div className="stat-value">{rooms.length}</div>
            <div className="stat-label">Total Room</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--green)' }}>
              {rooms.filter(r => r.status === 'ACTIVE').length}
            </div>
            <div className="stat-label">Room Aktif</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--accent)' }}>
              {rooms.reduce((sum, r) => sum + r.playerCount, 0)}
            </div>
            <div className="stat-label">Total Pemain</div>
          </div>
        </div>

        {/* Create Room Modal */}
        {showCreate && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
          }}>
            <div className="card" style={{ width: '100%', maxWidth: '440px' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>Buat Room Baru</h3>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">Nama Room</label>
                <input
                  className="input"
                  placeholder="Contoh: Kuis Geografi Seru"
                  value={newRoom.name}
                  onChange={e => setNewRoom(p => ({ ...p, name: e.target.value }))}
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="input-label">Kapasitas Pemain (maks)</label>
                <input
                  className="input"
                  type="number" min={2} max={100}
                  value={newRoom.capacity}
                  onChange={e => setNewRoom(p => ({ ...p, capacity: parseInt(e.target.value) || 10 }))}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary w-full" onClick={() => setShowCreate(false)}>
                  Batal
                </button>
                <button className="btn btn-primary w-full" disabled={creating || !newRoom.name.trim()} onClick={createRoom}>
                  {creating ? 'Membuat...' : 'Buat Room →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rooms List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Memuat room...</div>
        ) : rooms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
            <h3 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Belum ada room</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Buat room pertama untuk mulai bermain</p>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Buat Room</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {rooms.map(room => (
              <div key={room.id} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(0,229,200,0.2)' }}>
                    {room.code}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '0.15rem' }}>{room.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
                      <span>👤 {room.playerCount}/{room.capacity}</span>
                      <span style={{ color: statusColor(room.status) }}>● {statusLabel(room.status)}</span>
                      <span>{new Date(room.createdAt).toLocaleDateString('id-ID')}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/admin/room/${room.id}/setup`)}>
                    ⚙️ Setup
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => router.push(`/admin/room/${room.id}/play`)}>
                    🎮 Kelola
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// src/app/super-admin/page.tsx — Super Admin Dashboard
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SystemStats {
  totalUsers: number;
  totalRooms: number;
  totalPlayers: number;
  activeRooms: number;
}

interface UserData {
  id: string;
  name: string;
  email: string | null;
  role: string;
  createdAt: string;
  _count: { adminRooms: number };
}

export default function SuperAdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<SystemStats>({ totalUsers: 0, totalRooms: 0, totalPlayers: 0, activeRooms: 0 });
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'rooms' | 'settings'>('overview');
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [globalSettings, setGlobalSettings] = useState({ defaultDuration: 60, basePoints: 100, speedBonus: 50 });

  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : '';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch('/api/super-admin/stats', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/super-admin/users', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch {}
    setLoading(false);
  };

  const createAdmin = async () => {
    setCreating(true);
    const res = await fetch('/api/super-admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...newAdmin, role: 'ADMIN' }),
    });
    if (res.ok) {
      setShowCreateAdmin(false);
      setNewAdmin({ name: '', email: '', password: '' });
      fetchData();
    }
    setCreating(false);
  };

  const saveSettings = async () => {
    await fetch('/api/super-admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(globalSettings),
    });
  };

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'users', label: '👥 Users' },
    { id: 'rooms', label: '🏠 Rooms' },
    { id: 'settings', label: '⚙️ Settings' },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      <nav className="navbar">
        <div className="logo">⬛ CW_LIVE / Super Admin</div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className="badge badge-amber">SUPER ADMIN</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('adminToken'); router.push('/'); }}>
            Logout
          </button>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '2rem', background: 'var(--bg-surface)', padding: '0.25rem', borderRadius: '10px', border: '1px solid var(--border)', width: 'fit-content' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              className="btn btn-sm"
              style={{
                background: activeTab === t.id ? 'var(--bg-elevated)' : 'transparent',
                color: activeTab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                border: activeTab === t.id ? '1px solid var(--border)' : '1px solid transparent',
              }}
              onClick={() => setActiveTab(t.id as typeof activeTab)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
              {[
                { label: 'Total Users', value: stats.totalUsers, color: 'var(--accent)' },
                { label: 'Total Rooms', value: stats.totalRooms, color: 'var(--amber)' },
                { label: 'Active Rooms', value: stats.activeRooms, color: 'var(--green)' },
                { label: 'Total Players', value: stats.totalPlayers, color: 'var(--text-primary)' },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Aksi Cepat</h3>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-primary" onClick={() => setActiveTab('users')}>
                  + Buat Admin Baru
                </button>
                <button className="btn btn-secondary" onClick={fetchData}>🔄 Refresh Data</button>
              </div>
            </div>
          </>
        )}

        {/* Users */}
        {activeTab === 'users' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>Manajemen User</h2>
              <button className="btn btn-primary" onClick={() => setShowCreateAdmin(true)}>+ Tambah Admin</button>
            </div>

            {showCreateAdmin && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                  <h3 style={{ marginBottom: '1.25rem' }}>Buat Admin Baru</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div className="form-group">
                      <label className="input-label">Nama</label>
                      <input className="input" placeholder="Nama admin" value={newAdmin.name} onChange={e => setNewAdmin(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="input-label">Email</label>
                      <input className="input" type="email" placeholder="admin@example.com" value={newAdmin.email} onChange={e => setNewAdmin(p => ({ ...p, email: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="input-label">Password</label>
                      <input className="input" type="password" placeholder="••••••••" value={newAdmin.password} onChange={e => setNewAdmin(p => ({ ...p, password: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-secondary w-full" onClick={() => setShowCreateAdmin(false)}>Batal</button>
                    <button className="btn btn-primary w-full" disabled={creating} onClick={createAdmin}>
                      {creating ? 'Membuat...' : 'Buat Admin'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {users.filter(u => ['ADMIN', 'SUPER_ADMIN'].includes(u.role)).map(user => (
                <div key={user.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.15rem' }}>{user.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user.email} · {user._count.adminRooms} rooms</div>
                  </div>
                  <span className={`badge ${user.role === 'SUPER_ADMIN' ? 'badge-amber' : 'badge-teal'}`}>{user.role}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Settings */}
        {activeTab === 'settings' && (
          <div style={{ maxWidth: '480px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Konfigurasi Global</h2>
            <div className="card">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="input-label">Durasi Default Countdown (detik)</label>
                  <input className="input" type="number" min={10} max={300} value={globalSettings.defaultDuration} onChange={e => setGlobalSettings(p => ({ ...p, defaultDuration: parseInt(e.target.value) || 60 }))} />
                </div>
                <div className="form-group">
                  <label className="input-label">Poin Dasar per Soal</label>
                  <input className="input" type="number" min={10} max={1000} value={globalSettings.basePoints} onChange={e => setGlobalSettings(p => ({ ...p, basePoints: parseInt(e.target.value) || 100 }))} />
                </div>
                <div className="form-group">
                  <label className="input-label">Bonus Kecepatan Maksimal</label>
                  <input className="input" type="number" min={0} max={500} value={globalSettings.speedBonus} onChange={e => setGlobalSettings(p => ({ ...p, speedBonus: parseInt(e.target.value) || 50 }))} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={saveSettings}>💾 Simpan Pengaturan</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

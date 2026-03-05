// src/app/super-admin/login/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.user.role !== 'SUPER_ADMIN') throw new Error('Akses ditolak');
      localStorage.setItem('adminToken', data.token);
      router.push('/super-admin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
      <div style={{ width: '100%', maxWidth: '380px', padding: '1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="logo" style={{ fontSize: '1.5rem' }}>⬛ CW_LIVE</div>
          <h2 style={{ marginTop: '0.5rem' }}>Super Admin</h2>
          <div className="badge badge-amber" style={{ marginTop: '0.5rem' }}>RESTRICTED ACCESS</div>
        </div>
        <div className="card">
          {error && <div style={{ padding: '0.625rem', background: 'rgba(255,77,109,0.1)', borderRadius: '8px', color: 'var(--red)', fontSize: '0.85rem', marginBottom: '1rem', border: '1px solid rgba(255,77,109,0.3)' }}>{error}</div>}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="input-label">Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
          </div>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="input-label">Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} />
          </div>
          <button className="btn btn-amber w-full btn-lg" disabled={loading} onClick={login}>
            {loading ? 'Masuk...' : '⚙️ Masuk'}
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/')}>← Halaman Utama</button>
        </div>
      </div>
    </main>
  );
}

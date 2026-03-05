// src/app/admin/login/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login gagal');

      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('adminUser', JSON.stringify(data.user));

      if (data.user.role === 'SUPER_ADMIN') {
        router.push('/super-admin');
      } else {
        router.push('/admin');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex items-center justify-center" style={{ minHeight: '100vh', padding: '1.5rem' }}>
      {/* Ambient */}
      <div style={{
        position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '500px', height: '300px', borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(0,229,200,0.05), transparent)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="logo" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⬛ CW_LIVE</div>
          <h2 style={{ marginBottom: '0.25rem' }}>Admin Login</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Masuk untuk mengelola room dan game</p>
        </div>

        <div className="card">
          {error && (
            <div style={{ padding: '0.625rem 0.875rem', background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)', borderRadius: '8px', color: 'var(--red)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="input-label">Email</label>
            <input
              className="input"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="input-label">Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && login()}
            />
          </div>

          <button
            className="btn btn-primary w-full btn-lg"
            disabled={loading || !email || !password}
            onClick={login}
          >
            {loading ? 'Masuk...' : 'Masuk →'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/')}>
            ← Halaman Utama
          </button>
        </div>

        {/* Demo credentials hint */}
        <div style={{ marginTop: '1.5rem', padding: '0.875rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--amber)' }}>Demo:</strong> Jalankan{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>npm run db:seed</code>{' '}
          untuk membuat akun admin default.
        </div>
      </div>
    </main>
  );
}

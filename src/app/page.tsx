// src/app/page.tsx — Landing Page
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');

  return (
    <main className="flex flex-col items-center justify-center" style={{ minHeight: '100vh', padding: '2rem' }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '300px', borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(0,229,200,0.06), transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="logo" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            ⬛ CROSSWORD<span style={{ color: 'var(--text-secondary)' }}>_</span>LIVE
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Real-time multiplayer teka-teki silang
          </p>
        </div>

        <h1 style={{ marginBottom: '0.5rem', fontSize: 'clamp(2.5rem,6vw,4rem)', fontFamily: 'var(--font-mono)' }}>
          Ayo <span className="glow-teal">Bermain</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem' }}>
          Masukkan kode room untuk bergabung, atau login sebagai admin.
        </p>

        {/* Join Room Card */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="input-label">Kode Room</label>
            <input
              className="input"
              style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: '1.1rem', textAlign: 'center' }}
              placeholder="ENTER CODE"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              maxLength={8}
              onKeyDown={e => e.key === 'Enter' && roomCode && router.push(`/join/${roomCode}`)}
            />
          </div>
          <button
            className="btn btn-primary w-full btn-lg"
            disabled={!roomCode}
            onClick={() => router.push(`/join/${roomCode}`)}
          >
            Bergabung ke Room →
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
          atau
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
        </div>

        {/* Admin / Super Admin links */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary w-full" onClick={() => router.push('/admin/login')}>
            🎮 Admin Login
          </button>
          <button className="btn btn-ghost w-full" onClick={() => router.push('/super-admin/login')}>
            ⚙️ Super Admin
          </button>
        </div>

        {/* Features */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '3rem' }}>
          {[
            { icon: '⚡', label: 'Real-time', desc: 'Sinkronisasi instan' },
            { icon: '🏆', label: 'Poin Cepat', desc: 'Reward kecepatan' },
            { icon: '📱', label: 'QR Join', desc: 'Scan & langsung main' },
          ].map(f => (
            <div key={f.label} style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '1rem 0.75rem', textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.15rem' }}>{f.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

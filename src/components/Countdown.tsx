// src/components/Countdown.tsx
'use client';
import { useEffect, useState, useRef } from 'react';

interface CountdownProps {
  duration: number;           // total seconds
  remaining: number;          // current seconds remaining
  size?: number;              // ring diameter in px
  onComplete?: () => void;
}

export default function Countdown({ duration, remaining, size = 100, onComplete }: CountdownProps) {
  const prevRemaining = useRef(remaining);
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / duration;
  const dashOffset = circumference * (1 - progress);

  const isWarning = remaining <= Math.floor(duration * 0.4) && remaining > Math.floor(duration * 0.15);
  const isDanger  = remaining <= Math.floor(duration * 0.15);

  useEffect(() => {
    if (remaining === 0 && prevRemaining.current > 0) {
      onComplete?.();
    }
    prevRemaining.current = remaining;
  }, [remaining, onComplete]);

  const ringClass = `countdown-ring${isDanger ? ' danger' : isWarning ? ' warning' : ''}`;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : String(s);
  };

  return (
    <div className={ringClass} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          className="bg-circle"
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" strokeWidth={6}
        />
        <circle
          className="progress-circle"
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span className="time-text" style={{
        fontSize: size < 80 ? '0.95rem' : '1.5rem',
        fontFamily: 'var(--font-mono)',
      }}>
        {formatTime(remaining)}
      </span>
    </div>
  );
}

// ── Mini inline version for player view ─────────────────────────────────────
export function CountdownBar({ duration, remaining }: { duration: number; remaining: number }) {
  const pct = (remaining / duration) * 100;
  const isDanger = remaining <= Math.floor(duration * 0.15);
  const isWarning = remaining <= Math.floor(duration * 0.4) && !isDanger;

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '0.4rem',
      }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Sisa Waktu
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem',
          color: isDanger ? 'var(--red)' : isWarning ? 'var(--amber)' : 'var(--accent)',
        }}>
          {remaining}s
        </span>
      </div>
      <div style={{
        width: '100%', height: '6px', background: 'var(--bg-elevated)',
        borderRadius: '3px', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: '3px',
          width: `${pct}%`,
          background: isDanger ? 'var(--red)' : isWarning ? 'var(--amber)' : 'var(--accent)',
          transition: 'width 1s linear, background 0.3s ease',
          boxShadow: isDanger ? '0 0 8px var(--red)' : isWarning ? '0 0 8px var(--amber)' : '0 0 8px var(--accent)',
        }} />
      </div>
    </div>
  );
}

'use client';

import { motion } from 'framer-motion';

interface TimerProps {
  timeRemaining: number;
  timeLimit: number;
}

export function Timer({ timeRemaining, timeLimit }: TimerProps) {
  const percentage = timeLimit > 0 ? (timeRemaining / timeLimit) * 100 : 0;
  const isUrgent = timeRemaining <= 5 && timeRemaining > 0;
  const isDanger = timeRemaining <= 10 && timeRemaining > 0;

  const color = isUrgent
    ? '#FF2D78'
    : isDanger
    ? '#FF8C00'
    : '#FFE500';

  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference * (1 - percentage / 100);

  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${isUrgent ? 'timer-danger' : ''}`}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          {/* Progress circle */}
          <motion.circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 50 50)"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            key={timeRemaining}
            initial={{ scale: isUrgent ? 1.3 : 1 }}
            animate={{ scale: 1 }}
            className="font-display text-3xl font-extrabold"
            style={{ fontFamily: 'Syne, sans-serif', color }}
          >
            {timeRemaining}
          </motion.span>
        </div>
      </div>
      <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider">detik</p>
    </div>
  );
}

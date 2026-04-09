'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  avatar?: string | null;
  points: number;
  correctAnswers: number;
  previousRank?: number | null;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentPlayerId?: string;
  compact?: boolean;
  maxVisible?: number;
}

const RANK_COLORS: Record<number, string> = {
  1: '#FFE500',
  2: '#C0C0C0',
  3: '#CD7F32',
};

export function Leaderboard({ entries, currentPlayerId, compact = false, maxVisible = 10 }: LeaderboardProps) {
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const [rankChanges, setRankChanges] = useState<Map<string, 'up' | 'down' | null>>(new Map());

  useEffect(() => {
    const changes = new Map<string, 'up' | 'down' | null>();
    for (const entry of entries) {
      const prev = prevRanksRef.current.get(entry.playerId);
      if (prev !== undefined && prev !== entry.rank) {
        changes.set(entry.playerId, entry.rank < prev ? 'up' : 'down');
      }
    }
    setRankChanges(changes);

    // Update prev ranks
    const newPrev = new Map<string, number>();
    for (const entry of entries) newPrev.set(entry.playerId, entry.rank);
    prevRanksRef.current = newPrev;

    // Clear change indicators after animation
    const t = setTimeout(() => setRankChanges(new Map()), 1500);
    return () => clearTimeout(t);
  }, [entries]);

  const visible = entries.slice(0, maxVisible);

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {visible.map((entry) => {
          const isCurrentPlayer = entry.playerId === currentPlayerId;
          const rankColor = RANK_COLORS[entry.rank];
          const change = rankChanges.get(entry.playerId);

          return (
            <motion.div
              key={entry.playerId}
              layout
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl ${change === 'up' ? 'rank-up' : change === 'down' ? 'rank-down' : ''}`}
              style={{
                background: isCurrentPlayer
                  ? 'rgba(255,229,0,0.08)'
                  : 'rgba(255,255,255,0.03)',
                border: isCurrentPlayer
                  ? '1px solid rgba(255,229,0,0.2)'
                  : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {/* Rank */}
              <div className="w-7 text-center flex-shrink-0">
                {entry.rank <= 3 ? (
                  <span className="text-lg">{entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}</span>
                ) : (
                  <span className="font-display text-sm font-bold text-zinc-500"
                    style={{ fontFamily: 'Syne, sans-serif' }}>
                    {entry.rank}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <span className="text-xl flex-shrink-0">{entry.avatar ?? '🎯'}</span>

              {/* Name + change indicator */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold truncate ${isCurrentPlayer ? 'text-yellow-300' : 'text-white'}`}>
                    {entry.playerName}
                  </span>
                  {change === 'up' && <span className="text-xs text-green-400">▲</span>}
                  {change === 'down' && <span className="text-xs text-red-400">▼</span>}
                  {isCurrentPlayer && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(255,229,0,0.15)', color: '#FFE500' }}>
                      kamu
                    </span>
                  )}
                </div>
                {!compact && (
                  <p className="text-xs text-zinc-500">{entry.correctAnswers} benar</p>
                )}
              </div>

              {/* Points */}
              <div className="text-right flex-shrink-0">
                <motion.span
                  key={`${entry.playerId}-${entry.points}`}
                  initial={{ scale: 1.4, color: '#39FF14' }}
                  animate={{ scale: 1, color: rankColor ?? '#fff' }}
                  transition={{ duration: 0.5 }}
                  className="font-display text-lg font-extrabold block"
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  {entry.points.toLocaleString()}
                </motion.span>
                {!compact && <span className="text-xs text-zinc-600">pts</span>}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

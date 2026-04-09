// src/core/use-cases/scoreCalculator.ts

export interface ScoreInput {
  basePoints: number;
  timeLimit: number;
  timeRemaining: number;
  timeMultiplier?: number;
  isCorrect: boolean;
}

export interface ScoreResult {
  baseScore: number;
  timeBonus: number;
  total: number;
}

/**
 * Score = BasePoint + max(0, TimeRemaining × Multiplier)
 * Players who answer faster get higher time bonuses.
 */
export function calculateScore(input: ScoreInput): ScoreResult {
  if (!input.isCorrect) {
    return { baseScore: 0, timeBonus: 0, total: 0 };
  }

  const multiplier = input.timeMultiplier ?? 3;
  const timeBonus = Math.max(0, Math.floor(input.timeRemaining * multiplier));
  const baseScore = input.basePoints;
  const total = baseScore + timeBonus;

  return { baseScore, timeBonus, total };
}

/**
 * Update leaderboard ranks and detect position changes
 */
export function calculateRanks(
  players: Array<{ id: string; points: number; rank?: number | null }>
): Array<{ id: string; points: number; rank: number; previousRank: number | null }> {
  const sorted = [...players].sort((a, b) => b.points - a.points);

  return sorted.map((player, index) => ({
    id: player.id,
    points: player.points,
    rank: index + 1,
    previousRank: player.rank ?? null,
  }));
}

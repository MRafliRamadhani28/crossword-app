// src/core/entities/index.ts

export type RoomStatus = 'WAITING' | 'PLAYING' | 'FINISHED';
export type Orientation = 'ACROSS' | 'DOWN';

export interface Room {
  id: string;
  code: string;
  name: string;
  hostName: string;
  capacity: number;
  status: RoomStatus;
  config: RoomConfig | null;
  currentPuzzleId?: string | null;
  createdAt: Date;
  players?: Player[];
  puzzles?: Puzzle[];
}

export interface RoomConfig {
  timePerQuestion: number;   // seconds
  basePoints: number;
  timeMultiplier: number;    // points per second remaining
  showLeaderboardAfterEach: boolean;
  allowHints: boolean;
}

export interface Player {
  id: string;
  name: string;
  avatar?: string;
  socketId?: string | null;
  points: number;
  rank?: number | null;
  isActive: boolean;
  roomId: string;
  joinedAt: Date;
}

export interface Puzzle {
  id: string;
  question: string;
  answer: string;
  hint?: string | null;
  clueNumber: number;
  orientation: Orientation;
  row: number;
  col: number;
  length: number;
  isOpened: boolean;
  isRevealed: boolean;
  openedAt?: Date | null;
  timeLimit: number;
  basePoints: number;
  roomId: string;
}

export interface Answer {
  id: string;
  content: string;
  isCorrect: boolean;
  points: number;
  timeBonus: number;
  submittedAt: Date;
  playerId: string;
  puzzleId: string;
  player?: Player;
}

export interface GridCell {
  row: number;
  col: number;
  letter: string | null;
  clueNumber?: number;
  isBlack: boolean;
  acrossPuzzleId?: string;
  downPuzzleId?: string;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  avatar?: string;
  points: number;
  correctAnswers: number;
  previousRank?: number;
}

export interface GameState {
  roomId: string;
  status: RoomStatus;
  currentPuzzle: Puzzle | null;
  timeRemaining: number;
  players: LeaderboardEntry[];
}

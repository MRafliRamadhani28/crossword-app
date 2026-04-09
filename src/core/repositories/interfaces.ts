// src/core/repositories/interfaces.ts

import type { Room, Player, Puzzle, Answer, LeaderboardEntry } from '../entities';

export interface RoomRepository {
  create(data: CreateRoomData): Promise<Room>;
  findByCode(code: string): Promise<Room | null>;
  findById(id: string): Promise<Room | null>;
  updateStatus(id: string, status: Room['status']): Promise<Room>;
  setCurrentPuzzle(id: string, puzzleId: string | null): Promise<Room>;
  delete(id: string): Promise<void>;
}

export interface PlayerRepository {
  create(data: CreatePlayerData): Promise<Player>;
  findById(id: string): Promise<Player | null>;
  findByRoom(roomId: string): Promise<Player[]>;
  updateSocket(id: string, socketId: string | null): Promise<Player>;
  updatePoints(id: string, points: number, rank?: number): Promise<Player>;
  setInactive(id: string): Promise<Player>;
  getLeaderboard(roomId: string): Promise<LeaderboardEntry[]>;
}

export interface PuzzleRepository {
  create(data: CreatePuzzleData): Promise<Puzzle>;
  createMany(data: CreatePuzzleData[]): Promise<void>;
  findByRoom(roomId: string): Promise<Puzzle[]>;
  findById(id: string): Promise<Puzzle | null>;
  open(id: string): Promise<Puzzle>;
  reveal(id: string): Promise<Puzzle>;
}

export interface AnswerRepository {
  create(data: CreateAnswerData): Promise<Answer>;
  findByPuzzle(puzzleId: string): Promise<Answer[]>;
  findByPlayer(playerId: string): Promise<Answer[]>;
  findByPlayerAndPuzzle(playerId: string, puzzleId: string): Promise<Answer | null>;
}

// Data transfer objects
export interface CreateRoomData {
  code: string;
  name: string;
  hostName: string;
  capacity: number;
  config?: unknown;
}

export interface CreatePlayerData {
  name: string;
  avatar?: string;
  roomId: string;
}

export interface CreatePuzzleData {
  question: string;
  answer: string;
  hint?: string;
  clueNumber: number;
  orientation: 'ACROSS' | 'DOWN';
  row: number;
  col: number;
  length: number;
  basePoints: number;
  timeLimit: number;
  roomId: string;
}

export interface CreateAnswerData {
  content: string;
  isCorrect: boolean;
  points: number;
  timeBonus: number;
  playerId: string;
  puzzleId: string;
}

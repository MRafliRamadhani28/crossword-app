// src/infrastructure/lib/queue.ts

import { Queue, Worker, QueueEvents, type Job } from 'bullmq';
import { prisma } from './prisma';
import { calculateScore } from '../../core/use-cases/scoreCalculator';
import { cache } from './redis';

const connection = {
  host: new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').hostname,
  port: parseInt(new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').port || '6379'),
};

export interface AnswerJobData {
  playerId: string;
  puzzleId: string;
  content: string;
  submittedAt: number; // timestamp
  roomId: string;
}

export interface AnswerJobResult {
  isCorrect: boolean;
  points: number;
  timeBonus: number;
  playerId: string;
  puzzleId: string;
}

// QueueEvents for job.waitUntilFinished()
export const answerQueueEvents = new QueueEvents('answer-processing', { connection });

// Queue for processing answers
export const answerQueue = new Queue<AnswerJobData>('answer-processing', {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: 'exponential', delay: 500 },
  },
});

// Worker that processes answers
export const createAnswerWorker = () => {
  return new Worker<AnswerJobData, AnswerJobResult>(
    'answer-processing',
    async (job: Job<AnswerJobData>) => {
      const { playerId, puzzleId, content, submittedAt, roomId } = job.data;

      const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId } });
      if (!puzzle || !puzzle.isOpened || puzzle.isRevealed) {
        throw new Error('Puzzle not available');
      }

      // Check if already answered correctly — no need to reprocess
      const existing = await prisma.answer.findUnique({
        where: { playerId_puzzleId: { playerId, puzzleId } },
      });
      if (existing?.isCorrect) {
        return {
          isCorrect: existing.isCorrect,
          points: existing.points,
          timeBonus: existing.timeBonus,
          playerId,
          puzzleId,
        };
      }

      const isCorrect =
        content.trim().toUpperCase() === puzzle.answer.trim().toUpperCase();

      const timeElapsed = puzzle.openedAt
        ? (submittedAt - new Date(puzzle.openedAt).getTime()) / 1000
        : puzzle.timeLimit;

      const timeRemaining = Math.max(0, puzzle.timeLimit - timeElapsed);

      const room = await prisma.room.findUnique({ where: { id: roomId } });
      const config = room?.config as { timeMultiplier?: number } | null;

      const { baseScore, timeBonus, total } = calculateScore({
        basePoints: puzzle.basePoints,
        timeLimit: puzzle.timeLimit,
        timeRemaining,
        timeMultiplier: config?.timeMultiplier ?? 3,
        isCorrect,
      });

      // Upsert answer — allows overwriting a previous wrong answer
      await prisma.answer.upsert({
        where: { playerId_puzzleId: { playerId, puzzleId } },
        update: {
          content,
          isCorrect,
          points: isCorrect ? baseScore : 0,
          timeBonus: isCorrect ? timeBonus : 0,
          submittedAt: new Date(submittedAt),
        },
        create: {
          content,
          isCorrect,
          points: isCorrect ? baseScore : 0,
          timeBonus: isCorrect ? timeBonus : 0,
          playerId,
          puzzleId,
        },
      });

      // Only increment points when transitioning from wrong → correct
      if (isCorrect && !existing) {
        await prisma.player.update({
          where: { id: playerId },
          data: { points: { increment: total } },
        });
      } else if (isCorrect && existing && !existing.isCorrect) {
        await prisma.player.update({
          where: { id: playerId },
          data: { points: { increment: total } },
        });
      }

      // Invalidate leaderboard cache
      await cache.del(`leaderboard:${roomId}`);

      return { isCorrect, points: isCorrect ? total : 0, timeBonus: isCorrect ? timeBonus : 0, playerId, puzzleId };
    },
    { connection, concurrency: 50 }
  );
};

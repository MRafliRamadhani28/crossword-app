// server.ts — Custom Next.js server with integrated Socket.io

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { answerQueue, createAnswerWorker, answerQueueEvents } from './src/infrastructure/lib/queue';

const PORT = parseInt(process.env.PORT ?? '3000');
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Always production mode when running npm start
const app = next({ dev: false });
const handle = app.getRequestHandler();

const prisma = new PrismaClient();

// Redis clients for Socket.io adapter (optional - only if REDIS_URL is set)
let io: Server;

console.log('> Starting production server...');

app.prepare().then(async () => {
  console.log('> Next.js ready');
  
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.io
  io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  // Use Redis adapter only if REDIS_URL is set (production)
  if (REDIS_URL && REDIS_URL !== 'redis://localhost:6379') {
    const { createAdapter } = await import('@socket.io/redis-adapter');
    const { Redis } = await import('ioredis');
    const pubClient = new Redis(REDIS_URL);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[socket] Using Redis adapter');
  }

  // Start answer queue worker
  const worker = createAnswerWorker();

  // ─── Rate limiter per socket ───────────────────────────────────────────────
  const submitCooldown = new Map<string, number>();
  const COOLDOWN_MS = 500;

  // ─── Socket handlers ───────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // ── room:join ──────────────────────────────────────────────────────────
    socket.on('room:join', async ({ roomCode, playerId, playerName }: {
      roomCode: string;
      playerId: string;
      playerName: string;
    }) => {
      try {
        const room = await prisma.room.findUnique({
          where: { code: roomCode },
          include: { players: true, puzzles: { orderBy: { clueNumber: 'asc' } } },
        });

        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        await prisma.player.update({
          where: { id: playerId },
          data: { socketId: socket.id, isActive: true },
        });

        socket.join(`room:${room.id}`);
        socket.join(`room:${room.id}:players`);

        const players = await prisma.player.findMany({
          where: { roomId: room.id, isActive: true },
          orderBy: { points: 'desc' },
        });

        io.to(`room:${room.id}`).emit('room:players_updated', { players });

        socket.emit('room:joined', {
          room: {
            id: room.id,
            code: room.code,
            name: room.name,
            status: room.status,
            config: room.config,
          },
          puzzles: room.puzzles,
          players,
        });

        console.log(`[room:join] ${playerName} joined ${roomCode}`);
      } catch (err) {
        console.error('[room:join] error:', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // ── host:join ──────────────────────────────────────────────────────────
    socket.on('host:join', async ({ roomCode }: { roomCode: string }) => {
      const room = await prisma.room.findUnique({ where: { code: roomCode } });
      if (!room) return;
      socket.join(`room:${room.id}`);
      socket.join(`room:${room.id}:host`);
      socket.emit('host:joined', { roomId: room.id });
    });

    // ── game:start ─────────────────────────────────────────────────────────
    socket.on('game:start', async ({ roomId }: { roomId: string }) => {
      try {
        await prisma.room.update({
          where: { id: roomId },
          data: { status: 'PLAYING' },
        });

        io.to(`room:${roomId}`).emit('game:started', { roomId });
        console.log(`[game:start] room ${roomId}`);
      } catch (err) {
        console.error('[game:start] error:', err);
      }
    });

    // ── puzzle:select ──────────────────────────────────────────────────────
    socket.on('puzzle:select', async ({ roomId, puzzleId }: {
      roomId: string;
      puzzleId: string;
    }) => {
      try {
        // Check if room exists
        const room = await prisma.room.findUnique({
          where: { id: roomId },
          select: { id: true },
        });

        if (!room) {
          console.error(`[puzzle:select] Room ${roomId} not found`);
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        const puzzle = await prisma.puzzle.update({
          where: { id: puzzleId },
          data: { isOpened: true, openedAt: new Date() },
        });

        await prisma.room.update({
          where: { id: roomId },
          data: { currentPuzzleId: puzzleId },
        });

        io.to(`room:${roomId}`).emit('puzzle:opened', {
          puzzle,
          timeLimit: puzzle.timeLimit,
        });

        console.log(`[puzzle:select] puzzle ${puzzle.clueNumber} opened in room ${roomId}`);
      } catch (err) {
        console.error('[puzzle:select] error:', err);
      }
    });

    // ── answer:submit ──────────────────────────────────────────────────────
    socket.on('answer:submit', async ({ playerId, puzzleId, content, roomId }: {
      playerId: string;
      puzzleId: string;
      content: string;
      roomId: string;
    }) => {
      const lastSubmit = submitCooldown.get(socket.id) ?? 0;
      const now = Date.now();
      if (now - lastSubmit < COOLDOWN_MS) {
        socket.emit('answer:rate_limited');
        return;
      }
      submitCooldown.set(socket.id, now);

      try {
        const job = await answerQueue.add('process-answer', {
          playerId,
          puzzleId,
          content,
          submittedAt: now,
          roomId,
        });

        const result = await job.waitUntilFinished(answerQueueEvents, 5000);

        socket.emit('answer:result', result);

        // Get player name for host display
        const player = await prisma.player.findUnique({
          where: { id: playerId },
          select: { name: true },
        });

        if (result.isCorrect) {
          io.to(`room:${roomId}:host`).emit('answer:received', {
            playerId,
            playerName: player?.name || 'Unknown',
            puzzleId,
            isCorrect: true,
            points: result.points,
            submittedAt: now,
          });

          const leaderboard = await getLeaderboard(roomId);
          io.to(`room:${roomId}`).emit('leaderboard:update', { leaderboard });
        } else {
          io.to(`room:${roomId}:host`).emit('answer:received', {
            playerId,
            playerName: player?.name || 'Unknown',
            puzzleId,
            isCorrect: false,
            submittedAt: now,
          });
        }
      } catch (err) {
        console.error('[answer:submit] error:', err);
        socket.emit('error', { message: 'Failed to process answer' });
      }
    });

    // ── puzzle:reveal ──────────────────────────────────────────────────────
    socket.on('puzzle:reveal', async ({ roomId, puzzleId }: {
      roomId: string;
      puzzleId: string;
    }) => {
      try {
        const puzzle = await prisma.puzzle.update({
          where: { id: puzzleId },
          data: { isRevealed: true },
        });

        const leaderboard = await getLeaderboard(roomId);

        io.to(`room:${roomId}`).emit('puzzle:revealed', {
          puzzle,
          answer: puzzle.answer,
          leaderboard,
        });

        console.log(`[puzzle:reveal] puzzle ${puzzleId} revealed`);
      } catch (err) {
        console.error('[puzzle:reveal] error:', err);
      }
    });

    // ── game:end ───────────────────────────────────────────────────────────
    socket.on('game:end', async ({ roomId }: { roomId: string }) => {
      try {
        await prisma.room.update({
          where: { id: roomId },
          data: { status: 'FINISHED' },
        });

        const leaderboard = await getLeaderboard(roomId);

        for (let i = 0; i < leaderboard.length; i++) {
          await prisma.player.update({
            where: { id: leaderboard[i].playerId },
            data: { rank: i + 1 },
          });
        }

        io.to(`room:${roomId}`).emit('game:ended', { leaderboard });
      } catch (err) {
        console.error('[game:end] error:', err);
      }
    });

    // ── player:kick ────────────────────────────────────────────────────────
    socket.on('player:kick', async ({ roomId, playerId }: { roomId: string; playerId: string }) => {
      try {
        // Verify host is kicking from their room
        const room = await prisma.room.findUnique({
          where: { id: roomId },
          select: { id: true, code: true },
        });

        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Kick player - set isActive to false
        await prisma.player.update({
          where: { id: playerId },
          data: { isActive: false, socketId: null },
        });

        // Notify all hosts
        io.to(`room:${roomId}:host`).emit('player:kicked', { playerId });

        // Update player list for everyone
        const players = await prisma.player.findMany({
          where: { roomId, isActive: true },
          orderBy: { points: 'desc' },
        });

        io.to(`room:${roomId}`).emit('room:players_updated', { players });

        console.log(`[player:kick] Player ${playerId} kicked from room ${roomId}`);
      } catch (err) {
        console.error('[player:kick] error:', err);
      }
    });

    // ── disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      submitCooldown.delete(socket.id);
      try {
        const player = await prisma.player.findFirst({ where: { socketId: socket.id } });
        if (player) {
          await prisma.player.update({
            where: { id: player.id },
            data: { socketId: null, isActive: false },
          });

          const players = await prisma.player.findMany({
            where: { roomId: player.roomId, isActive: true },
          });
          io.to(`room:${player.roomId}`).emit('room:players_updated', { players });
        }
      } catch {}
      console.log(`[socket] disconnected: ${socket.id}`);
    });
  });

  async function getLeaderboard(roomId: string) {
    const players = await prisma.player.findMany({
      where: { roomId, isActive: true },
      orderBy: { points: 'desc' },
      include: { answers: { where: { isCorrect: true } } },
    });

    return players.map((p, i) => ({
      rank: i + 1,
      playerId: p.id,
      playerName: p.name,
      avatar: p.avatar,
      points: p.points,
      correctAnswers: p.answers.length,
    }));
  }

  const startTime = Date.now();
  httpServer.listen(PORT, () => {
    const startupTime = Date.now() - startTime;
    console.log(`> Ready on http://localhost:${PORT}`);
    console.log(`> Socket.io integrated on same port`);
    console.log(`> Startup time: ${startupTime}ms`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  });
});

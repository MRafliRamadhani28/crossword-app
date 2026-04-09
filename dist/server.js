"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_http = require("http");
var import_url = require("url");
var import_next = __toESM(require("next"));
var import_socket = require("socket.io");
var import_client2 = require("@prisma/client");

// src/infrastructure/lib/queue.ts
var import_bullmq = require("bullmq");

// src/infrastructure/lib/prisma.ts
var import_client = require("@prisma/client");
var globalForPrisma = globalThis;
var prisma = globalForPrisma.prisma ?? new import_client.PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
});
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// src/core/use-cases/scoreCalculator.ts
function calculateScore(input) {
  if (!input.isCorrect) {
    return { baseScore: 0, timeBonus: 0, total: 0 };
  }
  const multiplier = input.timeMultiplier ?? 3;
  const timeBonus = Math.max(0, Math.floor(input.timeRemaining * multiplier));
  const baseScore = input.basePoints;
  const total = baseScore + timeBonus;
  return { baseScore, timeBonus, total };
}

// src/infrastructure/lib/redis.ts
var import_ioredis = require("ioredis");
var redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
var createRedisClient = () => new import_ioredis.Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true
});
var redisPublisher = createRedisClient();
var redisSubscriber = createRedisClient();
var redisCache = createRedisClient();
var cache = {
  async get(key) {
    const val = await redisCache.get(key);
    if (!val) return null;
    return JSON.parse(val);
  },
  async set(key, value, ttlSeconds = 300) {
    await redisCache.set(key, JSON.stringify(value), "EX", ttlSeconds);
  },
  async del(key) {
    await redisCache.del(key);
  },
  async invalidateRoom(roomId) {
    const keys = await redisCache.keys(`room:${roomId}:*`);
    if (keys.length > 0) await redisCache.del(...keys);
  }
};

// src/infrastructure/lib/queue.ts
var connection = {
  host: new URL(process.env.REDIS_URL ?? "redis://localhost:6379").hostname,
  port: parseInt(new URL(process.env.REDIS_URL ?? "redis://localhost:6379").port || "6379")
};
var answerQueueEvents = new import_bullmq.QueueEvents("answer-processing", { connection });
var answerQueue = new import_bullmq.Queue("answer-processing", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: "exponential", delay: 500 }
  }
});
var createAnswerWorker = () => {
  return new import_bullmq.Worker(
    "answer-processing",
    async (job) => {
      const { playerId, puzzleId, content, submittedAt, roomId } = job.data;
      const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId } });
      if (!puzzle || !puzzle.isOpened || puzzle.isRevealed) {
        throw new Error("Puzzle not available");
      }
      const existing = await prisma.answer.findUnique({
        where: { playerId_puzzleId: { playerId, puzzleId } }
      });
      if (existing?.isCorrect) {
        return {
          isCorrect: existing.isCorrect,
          points: existing.points,
          timeBonus: existing.timeBonus,
          playerId,
          puzzleId
        };
      }
      const isCorrect = content.trim().toUpperCase() === puzzle.answer.trim().toUpperCase();
      const timeElapsed = puzzle.openedAt ? (submittedAt - new Date(puzzle.openedAt).getTime()) / 1e3 : puzzle.timeLimit;
      const timeRemaining = Math.max(0, puzzle.timeLimit - timeElapsed);
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      const config = room?.config;
      const { baseScore, timeBonus, total } = calculateScore({
        basePoints: puzzle.basePoints,
        timeLimit: puzzle.timeLimit,
        timeRemaining,
        timeMultiplier: config?.timeMultiplier ?? 3,
        isCorrect
      });
      await prisma.answer.upsert({
        where: { playerId_puzzleId: { playerId, puzzleId } },
        update: {
          content,
          isCorrect,
          points: isCorrect ? baseScore : 0,
          timeBonus: isCorrect ? timeBonus : 0,
          submittedAt: new Date(submittedAt)
        },
        create: {
          content,
          isCorrect,
          points: isCorrect ? baseScore : 0,
          timeBonus: isCorrect ? timeBonus : 0,
          playerId,
          puzzleId
        }
      });
      if (isCorrect && !existing) {
        await prisma.player.update({
          where: { id: playerId },
          data: { points: { increment: total } }
        });
      } else if (isCorrect && existing && !existing.isCorrect) {
        await prisma.player.update({
          where: { id: playerId },
          data: { points: { increment: total } }
        });
      }
      await cache.del(`leaderboard:${roomId}`);
      return { isCorrect, points: isCorrect ? total : 0, timeBonus: isCorrect ? timeBonus : 0, playerId, puzzleId };
    },
    { connection, concurrency: 50 }
  );
};

// server.ts
var PORT = parseInt(process.env.PORT ?? "3000");
var REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
var app = (0, import_next.default)({ dev: false });
var handle = app.getRequestHandler();
var prisma2 = new import_client2.PrismaClient();
var io;
console.log("> Starting production server...");
app.prepare().then(async () => {
  console.log("> Next.js ready");
  const httpServer = (0, import_http.createServer)((req, res) => {
    const parsedUrl = (0, import_url.parse)(req.url, true);
    handle(req, res, parsedUrl);
  });
  io = new import_socket.Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["websocket", "polling"],
    pingTimeout: 2e4,
    pingInterval: 1e4
  });
  if (REDIS_URL && REDIS_URL !== "redis://localhost:6379") {
    const { createAdapter } = await import("@socket.io/redis-adapter");
    const { Redis: Redis2 } = await import("ioredis");
    const pubClient = new Redis2(REDIS_URL);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    console.log("[socket] Using Redis adapter");
  }
  const worker = createAnswerWorker();
  const submitCooldown = /* @__PURE__ */ new Map();
  const COOLDOWN_MS = 500;
  io.on("connection", (socket) => {
    console.log(`[socket] connected: ${socket.id}`);
    socket.on("room:join", async ({ roomCode, playerId, playerName }) => {
      try {
        const room = await prisma2.room.findUnique({
          where: { code: roomCode },
          include: { players: true, puzzles: { orderBy: { clueNumber: "asc" } } }
        });
        if (!room) {
          socket.emit("error", { message: "Room not found" });
          return;
        }
        await prisma2.player.update({
          where: { id: playerId },
          data: { socketId: socket.id, isActive: true }
        });
        socket.join(`room:${room.id}`);
        socket.join(`room:${room.id}:players`);
        const players = await prisma2.player.findMany({
          where: { roomId: room.id, isActive: true },
          orderBy: { points: "desc" }
        });
        io.to(`room:${room.id}`).emit("room:players_updated", { players });
        socket.emit("room:joined", {
          room: {
            id: room.id,
            code: room.code,
            name: room.name,
            status: room.status,
            config: room.config
          },
          puzzles: room.puzzles,
          players
        });
        console.log(`[room:join] ${playerName} joined ${roomCode}`);
      } catch (err) {
        console.error("[room:join] error:", err);
        socket.emit("error", { message: "Failed to join room" });
      }
    });
    socket.on("host:join", async ({ roomCode }) => {
      const room = await prisma2.room.findUnique({ where: { code: roomCode } });
      if (!room) return;
      socket.join(`room:${room.id}`);
      socket.join(`room:${room.id}:host`);
      socket.emit("host:joined", { roomId: room.id });
    });
    socket.on("game:start", async ({ roomId }) => {
      try {
        await prisma2.room.update({
          where: { id: roomId },
          data: { status: "PLAYING" }
        });
        io.to(`room:${roomId}`).emit("game:started", { roomId });
        console.log(`[game:start] room ${roomId}`);
      } catch (err) {
        console.error("[game:start] error:", err);
      }
    });
    socket.on("puzzle:select", async ({ roomId, puzzleId }) => {
      try {
        const room = await prisma2.room.findUnique({
          where: { id: roomId },
          select: { id: true }
        });
        if (!room) {
          console.error(`[puzzle:select] Room ${roomId} not found`);
          socket.emit("error", { message: "Room not found" });
          return;
        }
        const puzzle = await prisma2.puzzle.update({
          where: { id: puzzleId },
          data: { isOpened: true, openedAt: /* @__PURE__ */ new Date() }
        });
        await prisma2.room.update({
          where: { id: roomId },
          data: { currentPuzzleId: puzzleId }
        });
        io.to(`room:${roomId}`).emit("puzzle:opened", {
          puzzle,
          timeLimit: puzzle.timeLimit
        });
        console.log(`[puzzle:select] puzzle ${puzzle.clueNumber} opened in room ${roomId}`);
      } catch (err) {
        console.error("[puzzle:select] error:", err);
      }
    });
    socket.on("answer:submit", async ({ playerId, puzzleId, content, roomId }) => {
      const lastSubmit = submitCooldown.get(socket.id) ?? 0;
      const now = Date.now();
      if (now - lastSubmit < COOLDOWN_MS) {
        socket.emit("answer:rate_limited");
        return;
      }
      submitCooldown.set(socket.id, now);
      try {
        const job = await answerQueue.add("process-answer", {
          playerId,
          puzzleId,
          content,
          submittedAt: now,
          roomId
        });
        const result = await job.waitUntilFinished(answerQueueEvents, 5e3);
        socket.emit("answer:result", result);
        const player = await prisma2.player.findUnique({
          where: { id: playerId },
          select: { name: true }
        });
        if (result.isCorrect) {
          io.to(`room:${roomId}:host`).emit("answer:received", {
            playerId,
            playerName: player?.name || "Unknown",
            puzzleId,
            isCorrect: true,
            points: result.points,
            submittedAt: now
          });
          const leaderboard = await getLeaderboard(roomId);
          io.to(`room:${roomId}`).emit("leaderboard:update", { leaderboard });
        } else {
          io.to(`room:${roomId}:host`).emit("answer:received", {
            playerId,
            playerName: player?.name || "Unknown",
            puzzleId,
            isCorrect: false,
            submittedAt: now
          });
        }
      } catch (err) {
        console.error("[answer:submit] error:", err);
        socket.emit("error", { message: "Failed to process answer" });
      }
    });
    socket.on("puzzle:reveal", async ({ roomId, puzzleId }) => {
      try {
        const puzzle = await prisma2.puzzle.update({
          where: { id: puzzleId },
          data: { isRevealed: true }
        });
        const leaderboard = await getLeaderboard(roomId);
        io.to(`room:${roomId}`).emit("puzzle:revealed", {
          puzzle,
          answer: puzzle.answer,
          leaderboard
        });
        console.log(`[puzzle:reveal] puzzle ${puzzleId} revealed`);
      } catch (err) {
        console.error("[puzzle:reveal] error:", err);
      }
    });
    socket.on("game:end", async ({ roomId }) => {
      try {
        await prisma2.room.update({
          where: { id: roomId },
          data: { status: "FINISHED" }
        });
        const leaderboard = await getLeaderboard(roomId);
        for (let i = 0; i < leaderboard.length; i++) {
          await prisma2.player.update({
            where: { id: leaderboard[i].playerId },
            data: { rank: i + 1 }
          });
        }
        io.to(`room:${roomId}`).emit("game:ended", { leaderboard });
      } catch (err) {
        console.error("[game:end] error:", err);
      }
    });
    socket.on("player:kick", async ({ roomId, playerId }) => {
      try {
        const room = await prisma2.room.findUnique({
          where: { id: roomId },
          select: { id: true, code: true }
        });
        if (!room) {
          socket.emit("error", { message: "Room not found" });
          return;
        }
        await prisma2.player.update({
          where: { id: playerId },
          data: { isActive: false, socketId: null }
        });
        io.to(`room:${roomId}:host`).emit("player:kicked", { playerId });
        const players = await prisma2.player.findMany({
          where: { roomId, isActive: true },
          orderBy: { points: "desc" }
        });
        io.to(`room:${roomId}`).emit("room:players_updated", { players });
        console.log(`[player:kick] Player ${playerId} kicked from room ${roomId}`);
      } catch (err) {
        console.error("[player:kick] error:", err);
      }
    });
    socket.on("disconnect", async () => {
      submitCooldown.delete(socket.id);
      try {
        const player = await prisma2.player.findFirst({ where: { socketId: socket.id } });
        if (player) {
          await prisma2.player.update({
            where: { id: player.id },
            data: { socketId: null, isActive: false }
          });
          const players = await prisma2.player.findMany({
            where: { roomId: player.roomId, isActive: true }
          });
          io.to(`room:${player.roomId}`).emit("room:players_updated", { players });
        }
      } catch {
      }
      console.log(`[socket] disconnected: ${socket.id}`);
    });
  });
  async function getLeaderboard(roomId) {
    const players = await prisma2.player.findMany({
      where: { roomId, isActive: true },
      orderBy: { points: "desc" },
      include: { answers: { where: { isCorrect: true } } }
    });
    return players.map((p, i) => ({
      rank: i + 1,
      playerId: p.id,
      playerName: p.name,
      avatar: p.avatar,
      points: p.points,
      correctAnswers: p.answers.length
    }));
  }
  const startTime = Date.now();
  httpServer.listen(PORT, () => {
    const startupTime = Date.now() - startTime;
    console.log(`> Ready on http://localhost:${PORT}`);
    console.log(`> Socket.io integrated on same port`);
    console.log(`> Startup time: ${startupTime}ms`);
  });
  process.on("SIGTERM", async () => {
    await worker.close();
    await prisma2.$disconnect();
    process.exit(0);
  });
});

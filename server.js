// server.js — Custom Next.js server with Socket.io
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ─── In-memory state (for a single-instance deployment) ──────────────────────
// In production with multiple instances, use Redis adapter for Socket.io
const roomSessions = new Map(); // roomCode → { countdown timer, etc. }

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);
    await handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Make io accessible in API routes via global
  global._io = io;

  // ─── Socket.io Events ────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ── JOIN ROOM ──
    socket.on('join-room', ({ roomCode, playerId, playerName, role }) => {
      socket.join(`room:${roomCode}`);
      socket.data = { roomCode, playerId, playerName, role };

      console.log(`[Socket] ${playerName} (${role}) joined room ${roomCode}`);

      // Notify others in room
      socket.to(`room:${roomCode}`).emit('player-joined', {
        playerId,
        playerName,
        role,
        timestamp: new Date().toISOString(),
      });

      // Confirm to the joining socket
      socket.emit('room-joined', { roomCode, message: 'Joined successfully' });
    });

    // ── ADMIN: START QUESTION SESSION ──
    socket.on('admin:open-clue', ({ roomCode, clueData, duration }) => {
      // Broadcast to all players in room
      io.to(`room:${roomCode}`).emit('game:clue-opened', {
        clue: clueData,
        duration,
        startedAt: new Date().toISOString(),
      });

      // Start server-side countdown broadcast
      let remaining = duration;
      const key = `${roomCode}:countdown`;

      // Clear any existing timer
      if (roomSessions.has(key)) {
        clearInterval(roomSessions.get(key));
      }

      const timer = setInterval(() => {
        remaining -= 1;
        io.to(`room:${roomCode}`).emit('game:tick', { remaining });

        if (remaining <= 0) {
          clearInterval(timer);
          roomSessions.delete(key);
          io.to(`room:${roomCode}`).emit('game:time-up', {
            message: 'Waktu habis! Input dikunci.',
          });
        }
      }, 1000);

      roomSessions.set(key, timer);
    });

    // ── ADMIN: STOP COUNTDOWN ──
    socket.on('admin:stop-countdown', ({ roomCode }) => {
      const key = `${roomCode}:countdown`;
      if (roomSessions.has(key)) {
        clearInterval(roomSessions.get(key));
        roomSessions.delete(key);
      }
      io.to(`room:${roomCode}`).emit('game:time-up', {
        message: 'Admin menghentikan sesi.',
      });
    });

    // ── ADMIN: EXTEND TIME ──
    socket.on('admin:extend-time', ({ roomCode, extraSeconds }) => {
      io.to(`room:${roomCode}`).emit('game:time-extended', { extraSeconds });
    });

    // ── PLAYER: SUBMIT ANSWER ──
    socket.on('player:answer', ({ roomCode, sessionId, playerId, playerName, answer }) => {
      // Forward to admin(s) in the room for live dashboard update
      socket.to(`room:${roomCode}`).emit('game:answer-update', {
        playerId,
        playerName,
        answer,
        submittedAt: new Date().toISOString(),
      });
    });

    // ── ADMIN: VALIDATE ANSWERS ──
    socket.on('admin:validate', ({ roomCode, results }) => {
      // results: [{ playerId, playerName, answer, isCorrect, points, rank }]
      io.to(`room:${roomCode}`).emit('game:validated', {
        results,
        validatedAt: new Date().toISOString(),
      });
    });

    // ── ADMIN: NEXT CLUE ──
    socket.on('admin:next-clue', ({ roomCode }) => {
      io.to(`room:${roomCode}`).emit('game:clue-closed');
    });

    // ── CHAT / NOTIFICATION ──
    socket.on('notify', ({ roomCode, message, type }) => {
      io.to(`room:${roomCode}`).emit('notification', { message, type });
    });

    // ── DISCONNECT ──
    socket.on('disconnect', () => {
      const { roomCode, playerId, playerName, role } = socket.data || {};
      if (roomCode && playerId) {
        io.to(`room:${roomCode}`).emit('player-left', {
          playerId,
          playerName,
          role,
          timestamp: new Date().toISOString(),
        });
      }
      console.log(`[Socket] Disconnected: ${socket.id} (${playerName || 'unknown'})`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`\n🎯 Crossword Multiplayer running at http://${hostname}:${port}`);
    console.log(`   Mode: ${dev ? 'development' : 'production'}\n`);
  });
});

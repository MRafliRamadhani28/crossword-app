# CrosswordLive 🎮

Real-time crossword event platform — host live crossword puzzle sessions for up to 500+ players.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 App Router + Tailwind CSS + Framer Motion |
| Real-time | Socket.io v4 + Redis Adapter (multi-instance scaling) |
| Queue | BullMQ + Redis (answer processing, rate limiting) |
| Database | PostgreSQL 16 + Prisma ORM |
| Infra | Docker Compose + Nginx (load balancing + WebSocket proxy) |

## Architecture

```
Nginx (reverse proxy + SSL + rate limiting)
    ├── Next.js App (2 replicas) → port 3000
    ├── Socket.io Server (2 replicas) → port 3001
    ├── Redis (Socket.io adapter + BullMQ queue + cache)
    └── PostgreSQL (primary)
```

### Clean Architecture Layers

```
src/
├── core/              # Domain (zero dependencies)
│   ├── entities/      # TypeScript interfaces
│   ├── use-cases/     # Score calculator, Crossword generator
│   └── repositories/  # Repository interfaces
├── infrastructure/    # Implementation
│   ├── lib/           # Prisma, Redis, BullMQ
│   └── repositories/  # Prisma implementations
├── app/               # Next.js pages + API routes
├── components/        # UI components
└── hooks/             # useSocket, useTimer
```

## Quick Start

### 1. Environment
```bash
cp .env.example .env
# Edit DATABASE_URL and REDIS_URL
```

### 2. Development
```bash
npm install
npx prisma migrate dev --name init
npx tsx prisma/seed.ts
npm run dev          # Next.js on :3000
# In another terminal:
npx tsx server.ts    # Socket.io on :3001
```

### 3. Docker (Production)
```bash
docker-compose up --build -d
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx tsx prisma/seed.ts
```

## Key Features

### 🎮 Game Flow
1. **Host** creates room with puzzles (manual or CSV/Excel import)
2. **Players** join via QR code or room code (up to 500)
3. **Host** opens puzzles one-by-one from control panel
4. **Players** submit answers in real-time
5. Scoring: `Points = BasePoints + max(0, TimeRemaining × Multiplier)`
6. Live leaderboard with animated rank changes
7. **Host** reveals answer + triggers next puzzle

### ⚡ Scalability
- **Redis Socket.io Adapter** — syncs WebSocket events across multiple server instances
- **BullMQ Answer Queue** — handles burst submissions (65+ players answering simultaneously)
- **Nginx ip_hash** — sticky sessions for WebSocket connections
- **Rate limiting** — Nginx (API) + in-memory cooldown (WebSocket)

### ✏️ Puzzle Editor
- Drag-and-drop puzzle reordering (Framer Motion Reorder)
- Import from CSV or Excel (columns: `answer`, `question`, `hint`)
- Visual grid preview before creating room
- Per-puzzle: custom time limit, base points, hint

### 🎨 UX
- Mobile-first design (HTML input auto-focus, large touch targets)
- Dramatic countdown timer (circular SVG + danger animations)
- Confetti on correct answers (Canvas-based)
- Animated leaderboard rank changes
- Neon arcade aesthetic (Syne + DM Sans fonts)

## CSV Import Format

```csv
answer,question,hint,points,time
BANDUNG,Ibukota Jawa Barat,Kota kembang,100,30
ANGKLUNG,Alat musik bambu,UNESCO heritage,150,30
```

## Socket.io Events

| Event | Direction | Description |
|---|---|---|
| `room:join` | C→S | Player joins room |
| `host:join` | C→S | Host joins room |
| `game:start` | C→S | Host starts game |
| `puzzle:select` | C→S | Host opens a puzzle |
| `answer:submit` | C→S | Player submits answer |
| `puzzle:reveal` | C→S | Host reveals answer |
| `game:end` | C→S | Host ends game |
| `room:joined` | S→C | Confirmed join + room data |
| `puzzle:opened` | S→C | Broadcast new active puzzle |
| `answer:result` | S→C | Player's answer result |
| `answer:received` | S→host | Answer received by host |
| `leaderboard:update` | S→C | Live leaderboard update |
| `puzzle:revealed` | S→C | Answer revealed |
| `game:ended` | S→C | Game over + final scores |

## Score Formula

```
Points = BasePoints + max(0, TimeRemaining × TimeMultiplier)
```

Example: BasePoints=100, TimeLimit=30s, answered at 8s → TimeRemaining=22 → Points = 100 + (22×3) = **166 pts**

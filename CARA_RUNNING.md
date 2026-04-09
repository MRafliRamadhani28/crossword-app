# CrosswordLive - Cara Running Project

## 📋 Overview

CrosswordLive adalah platform real-time crossword event yang memungkinkan host menyelenggarakan sesi crossword puzzle secara live untuk hingga 500+ pemain.

### Tech Stack
- **Frontend**: Next.js 14 App Router + Tailwind CSS + Framer Motion
- **Real-time**: Socket.io v4 + Redis Adapter
- **Queue**: BullMQ + Redis
- **Database**: PostgreSQL 16 + Prisma ORM
- **Infra**: Docker Compose + Nginx

---

## 🚀 Cara Running

### Metode 1: Development Mode (Lokal)

#### Prerequisites
- Node.js 20+
- PostgreSQL database
- Redis server (opsional untuk development)

#### Step 1: Install Dependencies
```bash
npm install
```

#### Step 2: Setup Environment
Buat file `.env` di root directory (copy dari `.env.example` jika ada):
```env
DATABASE_URL="postgresql://username:password@localhost:5432/crossworddb"
REDIS_URL="redis://localhost:6379"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Edit `DATABASE_URL` sesuai dengan kredensial PostgreSQL Anda.

#### Step 3: Setup Database
```bash
# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Seed database dengan data awal (opsional)
npx tsx prisma/seed.ts
```

#### Step 4: Run Application

**Opsi A - Development Server (Port default):**
```bash
npm run dev
```

**Opsi B - Development Server (Port spesifik):**
```bash
npm run dev:3000    # Port 3000
npm run dev:3001    # Port 3001
npm run dev:3002    # Port 3002
```

> **Catatan**: Dalam development mode, server Next.js dan Socket.io berjalan bersamaan dengan auto-reload menggunakan `tsx watch`.

#### Step 5: Akses Application
Buka browser dan akses:
- **App**: http://localhost:3000 (atau port yang Anda pilih)

**Database Management (Opsional):**
```bash
# Buka Prisma Studio (Database GUI)
npm run db:studio
```

---

### Metode 2: Production Mode (Build & Run)

#### Step 1: Build Application
```bash
# Build Next.js app dan Socket.io server
npm run build:all

# Atau build terpisah:
npm run build          # Build Next.js
npm run build:server   # Build Socket.io server
```

#### Step 2: Run Production Server

**Opsi A - Port default:**
```bash
npm start
```

**Opsi B - Port spesifik:**
```bash
npm run start:3000    # Port 3000
npm run start:3001    # Port 3001
npm run start:3002    # Port 3002
```

---

### Metode 3: Docker Compose (Production Environment)

#### Prerequisites
- Docker & Docker Compose installed

#### Step 1: Setup Environment
Pastikan file `.env` sudah ada dengan konfigurasi production:
```env
DATABASE_URL="postgresql://crossword:secret@db:5432/crossworddb"
REDIS_URL="redis://redis:6379"
POSTGRES_USER=crossword
POSTGRES_PASSWORD=secret
POSTGRES_DB=crossworddb
NEXT_PUBLIC_APP_URL="http://localhost"
```

#### Step 2: Run Docker Compose
```bash
# Build dan start semua services
docker-compose up --build -d
```

Services yang akan berjalan:
- **Nginx** (Port 80, 443) - Reverse proxy & load balancer
- **App** (2 replicas) - Next.js + Socket.io
- **PostgreSQL** (db-primary & db-replica)
- **Redis** - Cache & Queue

#### Step 3: Setup Database di Docker
```bash
# Run migrations
docker-compose exec app npx prisma migrate deploy

# Seed database
docker-compose exec app npx tsx prisma/seed.ts
```

#### Step 4: Akses Application
- **App**: http://localhost (via Nginx)
- **Redis Commander** (Debug mode): http://localhost:8081

```bash
# Jalankan dengan debug profile
docker-compose --profile debug up -d
```

#### Step 5: Stop Docker
```bash
# Stop semua services
docker-compose down

# Stop dan hapus volumes (reset data)
docker-compose down -v
```

---

## 📂 Struktur Project

```
crossword-app/
├── src/
│   ├── core/                    # Domain logic (zero dependencies)
│   │   ├── entities/            # TypeScript interfaces
│   │   ├── use-cases/           # Score calculator, Crossword generator
│   │   └── repositories/        # Repository interfaces
│   ├── infrastructure/          # Implementation
│   │   ├── lib/                 # Prisma, Redis, BullMQ setup
│   │   └── repositories/        # Prisma implementations
│   ├── app/                     # Next.js pages + API routes
│   ├── components/              # UI components
│   └── hooks/                   # React hooks (useSocket, useTimer)
├── prisma/
│   └── schema.prisma            # Database schema
├── nginx/                       # Nginx configuration
├── server.ts                    # Custom Next.js server + Socket.io
├── docker-compose.yml           # Docker services
└── package.json                 # Dependencies & scripts
```

---

## 🎮 Fitur Utama

### Game Flow
1. **Host** membuat room dengan puzzles (manual atau import CSV/Excel)
2. **Players** join via QR code atau room code (maksimal 500 pemain)
3. **Host** membuka puzzles satu per satu dari control panel
4. **Players** submit jawaban secara real-time
5. **Scoring**: `Points = BasePoints + max(0, TimeRemaining × Multiplier)`
6. Live leaderboard dengan animasi rank
7. **Host** reveal jawaban + lanjut ke puzzle berikutnya

### Scalability
- **Redis Socket.io Adapter** - Sinkronisasi WebSocket events antar server instances
- **BullMQ Answer Queue** - Handle burst submissions (65+ pemain bersamaan)
- **Nginx ip_hash** - Sticky sessions untuk WebSocket connections
- **Rate limiting** - Nginx (API) + in-memory cooldown (WebSocket)

### Puzzle Editor
- Drag-and-drop puzzle reordering
- Import dari CSV atau Excel (kolom: `answer`, `question`, `hint`)
- Visual grid preview sebelum create room
- Custom time limit, base points, hint per puzzle

---

## 🔧 Available Scripts

| Command | Deskripsi |
|---------|-----------|
| `npm run dev` | Run development server dengan auto-reload |
| `npm run dev:3000` | Run development server di port 3000 |
| `npm run build` | Build Next.js app untuk production |
| `npm run build:server` | Build Socket.io server (server.ts) |
| `npm run build:all` | Build semua (Next.js + Socket.io) |
| `npm start` | Run production server (port default) |
| `npm run db:migrate` | Run Prisma database migrations |
| `npm run db:seed` | Seed database dengan data awal |
| `npm run db:studio` | Buka Prisma Studio (Database GUI) |
| `npm run db:generate` | Generate Prisma Client |

---

## 📊 Database Schema

### Models
- **Room** - Room/session untuk crossword game
- **Player** - Pemain yang join ke room
- **Puzzle** - Soal crossword (question + answer)
- **Answer** - Jawaban player dengan scoring
- **GameEvent** - Log events dalam game

---

## 🐛 Troubleshooting

### Database Connection Error
```bash
# Pastikan PostgreSQL running
# Cek DATABASE_URL di .env sudah benar

# Regenerate Prisma Client
npx prisma generate
```

### Port Already in Use
```bash
# Gunakan port berbeda
npm run dev:3001

# Atau kill process yang menggunakan port
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Docker Issues
```bash
# Clean restart
docker-compose down -v
docker-compose up --build -d

# Cek logs
docker-compose logs -f app
docker-compose logs -f db
docker-compose logs -f redis
```

---

## 📝 CSV Import Format

Untuk import puzzles dari CSV:
```csv
answer,question,hint,points,time
BANDUNG,Ibukota Jawa Barat,Kota kembang,100,30
ANGKLUNG,Alat musik bambu,UNESCO heritage,150,30
```

---

## 🌐 Socket.io Events

### Client → Server
| Event | Deskripsi |
|-------|-----------|
| `room:join` | Player joins room |
| `host:join` | Host joins room |
| `game:start` | Host starts game |
| `puzzle:select` | Host opens a puzzle |
| `answer:submit` | Player submits answer |
| `puzzle:reveal` | Host reveals answer |
| `game:end` | Host ends game |

### Server → Client
| Event | Deskripsi |
|-------|-----------|
| `room:joined` | Confirmed join + room data |
| `puzzle:opened` | Broadcast new active puzzle |
| `answer:result` | Player's answer result |
| `leaderboard:update` | Live leaderboard update |
| `puzzle:revealed` | Answer revealed |
| `game:ended` | Game over + final scores |

---

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Socket.io Documentation](https://socket.io/docs/v4/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Docker Documentation](https://docs.docker.com/)

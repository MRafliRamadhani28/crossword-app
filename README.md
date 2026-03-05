# ⬛ CrossWord Live — Multiplayer TTS Real-Time

Aplikasi web permainan teka-teki silang (TTS) multiplayer real-time dengan tiga peran pengguna, alur permainan terstruktur, dan antarmuka dark mode modern.

---

## 🏗️ Arsitektur

```
crossword-app/
├── server.js                          # Custom server (Next.js + Socket.io)
├── prisma/
│   ├── schema.prisma                  # Database models
│   └── seed.ts                        # Initial data seeder
├── src/
│   ├── lib/
│   │   ├── crossword.ts               # ★ Algoritma generate layout TTS
│   │   ├── socket.ts                  # Client-side Socket.io hook
│   │   ├── prisma.ts                  # Prisma client singleton
│   │   └── auth.ts                    # JWT auth utilities
│   ├── app/
│   │   ├── globals.css                # Dark theme design system
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Landing page
│   │   ├── api/
│   │   │   ├── auth/login/            # POST: Admin login
│   │   │   ├── rooms/                 # GET/POST: Room management
│   │   │   ├── rooms/[id]/            # GET/PATCH/DELETE: Room by ID
│   │   │   ├── rooms/[id]/puzzle/     # POST/GET: Puzzle CRUD
│   │   │   ├── rooms/[id]/join/       # POST: Player join room
│   │   │   ├── rooms/by-code/[code]/  # GET: Lookup room by code
│   │   │   ├── sessions/              # POST: Create game session
│   │   │   ├── sessions/[id]/validate/# POST: Validate answers & score
│   │   │   ├── submissions/           # POST/GET: Player answers
│   │   │   └── super-admin/           # Super admin endpoints
│   │   ├── join/[code]/               # Player join page
│   │   ├── game/[code]/               # ★ Player game experience
│   │   ├── admin/
│   │   │   ├── login/                 # Admin login
│   │   │   ├── page.tsx               # Admin dashboard
│   │   │   └── room/[id]/
│   │   │       ├── setup/             # ★ Puzzle editor + generator
│   │   │       └── play/              # ★ Admin game control center
│   │   └── super-admin/               # Super admin dashboard
│   └── components/
│       ├── CrosswordGrid.tsx          # ★ Interactive grid component
│       ├── Countdown.tsx              # Countdown ring + bar
│       └── Toast.tsx                  # Real-time notifications
└── package.json
```

---

## ⚡ Stack Teknologi

| Lapisan | Teknologi |
|---------|-----------|
| Framework | **Next.js 14** (App Router) |
| Real-time | **Socket.io** (WebSocket + polling fallback) |
| Database | **PostgreSQL** |
| ORM | **Prisma** |
| Auth | **JWT** (via `jsonwebtoken`) |
| UI | Custom CSS (dark theme) |
| Font | Space Mono + Outfit |

---

## 🚀 Setup & Instalasi

### 1. Clone dan install dependencies
```bash
git clone <repo>
cd crossword-app
npm install
```

### 2. Setup database
```bash
# Copy environment variables
cp .env.example .env
# Edit .env dan isi DATABASE_URL + JWT_SECRET

# Push schema ke database
npm run db:push

# Buat data awal (akun admin)
npm run db:seed
```

### 3. Jalankan aplikasi
```bash
npm run dev
# Buka http://localhost:3000
```

---

## 🔐 Akun Default (setelah seed)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `superadmin@cw.live` | `superadmin123` |
| Admin | `admin@cw.live` | `admin123` |

---

## 🎮 Alur Permainan

### 1. Admin Setup
1. Login ke `/admin/login`
2. Buat room baru dari dashboard
3. Di halaman Setup (`/admin/room/[id]/setup`):
   - Input daftar kata jawaban + soal/petunjuk
   - Klik **Generate Layout** → preview grid TTS otomatis
   - Klik **Save & Lanjutkan** untuk simpan puzzle

### 2. Player Bergabung
1. Bagikan kode room, link `/join/CODE`, atau QR code
2. Player buka link → lihat info room → input nama → **Join**
3. Player masuk ke halaman game dan menunggu admin

### 3. Sesi Permainan
1. Admin buka `/admin/room/[id]/play`
2. Klik soal dari daftar atau klik sel di grid → soal aktif
3. Admin atur durasi (detik) → klik soal → **countdown mulai**
4. Player lihat soal + input jawaban selama countdown
5. Countdown habis → input terkunci otomatis
6. Admin klik **Validasi Jawaban** → sistem menilai + kirim hasil
7. Pemain benar mendapat poin (lebih cepat = lebih besar)
8. Lanjut ke soal berikutnya

---

## 🧩 Algoritma Generate Layout TTS

File: `src/lib/crossword.ts`

### Pendekatan: Greedy Placement with Intersection Scoring

```
1. Sort kata berdasarkan panjang (terpanjang duluan)
2. Tempatkan kata pertama secara horizontal di tengah grid
3. Untuk setiap kata berikutnya:
   a. Coba arah horizontal & vertikal
   b. Cari semua posisi valid yang memiliki IRISAN dengan kata yang sudah ada
   c. Score tiap posisi (lebih banyak irisan = score lebih tinggi)
   d. Pilih posisi dengan score tertinggi
4. Crop grid ke bounding box + padding 1 sel
5. Beri nomor urut pada sel awal kata (mendatar/menurun)
6. Generate daftar clues
```

**Kompleksitas**: O(W × G²) di mana W = jumlah kata, G = ukuran grid (21×21)

---

## 📡 Real-Time Events (Socket.io)

### Client → Server (Admin emits)
| Event | Payload | Deskripsi |
|-------|---------|-----------|
| `join-room` | `{roomCode, playerId, playerName, role}` | Join socket room |
| `admin:open-clue` | `{roomCode, clueData, duration}` | Buka soal + mulai countdown |
| `admin:stop-countdown` | `{roomCode}` | Hentikan countdown |
| `admin:extend-time` | `{roomCode, extraSeconds}` | Tambah waktu |
| `admin:validate` | `{roomCode, results}` | Kirim hasil validasi |
| `admin:next-clue` | `{roomCode}` | Tutup sesi saat ini |

### Client → Server (Player emits)
| Event | Payload | Deskripsi |
|-------|---------|-----------|
| `player:answer` | `{roomCode, sessionId, playerId, answer}` | Submit jawaban |

### Server → Client (Broadcasts)
| Event | Payload | Deskripsi |
|-------|---------|-----------|
| `game:clue-opened` | `{clue, duration, startedAt}` | Soal dibuka |
| `game:tick` | `{remaining}` | Update countdown per detik |
| `game:time-up` | `{message}` | Waktu habis, input terkunci |
| `game:answer-update` | `{playerId, answer, submittedAt}` | Jawaban masuk (ke admin) |
| `game:validated` | `{results}` | Hasil validasi + poin |
| `game:clue-closed` | — | Soal ditutup |
| `player-joined` | `{playerId, playerName}` | Pemain bergabung |
| `player-left` | `{playerId, playerName}` | Pemain keluar |

---

## 📊 Sistem Penilaian

```
Poin = basePoints + speedBonus - (rank - 1) × 10

Contoh (basePoints=100, speedBonus=50):
  Rank 1 (tercepat) → 100 + 50 - 0  = 150 poin
  Rank 2            → 100 + 50 - 10 = 140 poin
  Rank 3            → 100 + 50 - 20 = 130 poin
  Jawaban salah     → 0 poin
```

---

## 🔒 Keamanan & Skalabilitas

### Saat Ini
- JWT token untuk autentikasi admin
- Role-based access control (SUPER_ADMIN > ADMIN > PLAYER)
- Input sanitization (uppercase, trim, length validation)
- Prisma sebagai protection terhadap SQL injection

### Untuk Production
- **Multi-instance Socket.io**: Gunakan Redis adapter (`@socket.io/redis-adapter`)
- **Rate limiting**: Tambahkan middleware rate limit di API routes
- **HTTPS**: Wajib untuk WebSocket (WSS)
- **Environment secrets**: Gunakan secret manager (AWS Secrets Manager, dll.)
- **Connection pooling**: Gunakan PgBouncer untuk PostgreSQL

```bash
# Tambah Redis adapter untuk scaling horizontal
npm install @socket.io/redis-adapter ioredis

# Di server.js:
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('ioredis');
const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

---

## 🎨 Design System

Tema: **Dark Mode / Cyberpunk Terminal**

| Token | Nilai |
|-------|-------|
| `--bg-base` | `#0a0a0f` |
| `--accent` | `#00e5c8` (Electric Teal) |
| `--amber` | `#f5a623` |
| `--font-ui` | `Outfit` |
| `--font-mono` | `Space Mono` |

---

## 📝 License

MIT — Bebas digunakan untuk proyek pribadi & komersial.

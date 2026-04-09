# Loading States Implementation

## Perubahan yang Sudah Ditambahkan

### 1. Komponen Loading Baru

File baru: `src/components/ui/Loading.tsx`

#### Komponen yang tersedia:

**LoadingSpinner**
- Spinner animasi dengan 3 layer (outer ring, inner ring, center dot)
- 4 ukuran: `sm`, `md`, `lg`, `xl`
- Support `fullScreen` mode untuk overlay
- Props: `size`, `text`, `fullScreen`

**SkeletonCard**
- Placeholder card dengan animasi shimmer
- Cocok untuk loading state yang mengambil data

**LoadingDots**
- 3 dots animasi untuk inline text
- Digunakan pada button text saat loading

---

### 2. Halaman yang Sudah Diupdate

#### **Host Setup Page** (`/host/setup`)

| Aksi | Loading State |
|------|---------------|
| Preview Grid | Button text berubah ke "Membuat Preview" dengan LoadingDots |
| Buat Room | Button text berubah ke "Membuat Room" dengan LoadingDots + overlay di preview card |
| Import CSV | Button text berubah ke LoadingDots |

**Detail:**
- `previewLoading` state ditambahkan untuk track preview generation
- Overlay muncul di preview card saat "Buat Room" diklik
- Simulasi delay 800ms saat preview agar loading terlihat smooth

---

#### **Lobby Page** (`/`)

| Aksi | Loading State |
|------|---------------|
| Join Room | Button text berubah ke "Bergabung" dengan LoadingDots |

---

#### **Waiting Room Page** (`/room/[code]`)

| State | Loading State |
|-------|---------------|
| Initial load | LoadingSpinner full dengan text "Menghubungkan ke Room..." |
| Room data belum ada | Header menampilkan spinner instead of "Loading..." text |

---

### 3. Fitur Loading

**LoadingSpinner:**
- ✅ Outer ring ber lambat (1.5s rotation)
- ✅ Inner ring berputar cepat (0.8s rotation)
- ✅ Center dot berkedip (pulse animation)
- ✅ Text berkedip dengan opacity animation
- ✅ Full screen mode dengan backdrop blur

**LoadingDots:**
- ✅ 3 dots dengan stagger animation
- ✅ Scale + opacity animation
- ✅ Ringan dan smooth

**SkeletonCard:**
- ✅ Shimmer effect dengan opacity animation
- ✅ Placeholder untuk card layout
- ✅ Stagger delay untuk multiple elements

---

### 4. Cara Penggunaan

```tsx
import { LoadingSpinner, LoadingDots, SkeletonCard } from '@/components/ui/Loading';

// Spinner dengan text
<LoadingSpinner size="lg" text="Loading data..." />

// Full screen overlay
<LoadingSpinner size="xl" text="Processing..." fullScreen />

// Inline dots pada button
<button disabled={loading}>
  {loading ? (
    <span className="flex items-center gap-2">
      <LoadingDots /> Processing
    </span>
  ) : 'Submit'}
</button>

// Skeleton untuk card
{isLoading ? <SkeletonCard /> : <YourCard />}
```

---

### 5. Animasi Details

**LoadingSpinner:**
- Outer ring: rotate 360° in 1.5s (linear, infinite)
- Inner ring: rotate 360° in 0.8s (linear, infinite)
- Center dot: scale 0.5→1→0.5 in 1.5s (easeInOut, infinite)
- Text: opacity 0.5→1→0.5 in 1.5s (easeInOut, infinite)

**LoadingDots:**
- Each dot: scale 1→1.5→1 in 0.8s (infinite)
- Stagger delay: 0s, 0.2s, 0.4s

---

## Best Practices yang Diterapkan

1. ✅ **Visual feedback** - User selalu tahu apa yang sedang terjadi
2. ✅ **Smooth transitions** - Tidak ada perubahan yang abrupt
3. ✅ **Contextual loading** - Berbeda untuk setiap jenis aksi
4. ✅ **Non-blocking UX** - Button disabled saat loading untuk prevent double-submit
5. ✅ **Aesthetic** - Loading state sesuai dengan design system (yellow accent + dark theme)

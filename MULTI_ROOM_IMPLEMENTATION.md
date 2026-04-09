# Multiple Rooms Implementation

## Perubahan yang Sudah Dilakukan

### 1. Lobby Page (`/`) - Multi-Room Support

#### Fitur Baru:
✅ **User bisa membuat room berkali-kali** - Tidak ada batasan jumlah room
✅ **List room yang dibuat user** - Ditampilkan di bawah tombol aksi
✅ **Tracking room via localStorage** - Semua room disimpan di `host_rooms` key
✅ **Backward compatibility** - Support data dari key lama (`host_room_code`, `host_room_id`)

#### UI Changes:

**Sebelum:**
- Hanya menampilkan 1 room terakhir
- Harus klik "Kelola" untuk melihat detail
- Ada tombol "Buat Room Baru" yang tersembunyi di balik `hasStartedPlaying` flag

**Sesudah:**
- **2 tombol utama selalu terlihat:**
  - 🎮 **Ikut Main** (join room orang lain)
  - 🎛️ **Buat Room Baru** (buat room baru)
- **List room ditampilkan di bawah** dengan fitur:
  - Scrollable (max-height 60px)
  - Custom scrollbar dengan accent color kuning
  - Loading indicator saat load rooms
  - Counter jumlah room
  - Status badge dengan emoji (🎮 Bermain, ⏳ Menunggu)
  - Tombol "Kelola →" di setiap room
  - Hover effect pada room item
  - Animasi masuk untuk setiap room

---

### 2. Host Setup Page (`/host/setup`) - Room Persistence

#### Perubahan:
✅ **Simpan room ke `host_rooms` array** saat berhasil membuat room
✅ **Update room jika sudah ada** (berdasarkan `room.id`)
✅ **Tetap backward compatible** dengan key lama

#### Code Flow:
```
handleCreate() 
  → API call buat room
  → Load rooms dari localStorage
  → Update/add room ke array
  → Save ke localStorage
  → Set step ke 'created'
```

---

### 3. LocalStorage Structure

#### Key: `host_rooms`
```json
[
  {
    "id": "clx123abc",
    "code": "BDG01K",
    "name": "Teka-Teki Bandung 2025",
    "status": "WAITING",
    "createdAt": "2025-04-08T10:30:00.000Z"
  },
  {
    "id": "clx456def",
    "code": "JKT02A",
    "name": "Crossword Jakarta",
    "status": "PLAYING",
    "createdAt": "2025-04-07T15:00:00.000Z"
  }
]
```

#### Status Values:
- `WAITING` - Room belum dimulai (⏳ Menunggu)
- `PLAYING` - Game sedang berlangsung (🎮 Bermain)
- `FINISHED` - Game selesai (otomatis di-filter dari list)

---

### 4. Functions Added

#### Lobby Page:

**`loadHostRooms()`**
- Load rooms dari localStorage
- Filter hanya room yang statusnya bukan `FINISHED`
- Set loading state

**`saveRoomToStorage(room)`**
- Tambah/update room ke array
- Cek apakah room sudah ada berdasarkan `id`
- Save ke localStorage
- Update state

#### Host Setup Page:

**Updated `handleCreate()`**
- Setelah berhasil buat room, simpan ke `host_rooms` array
- Update jika room sudah ada
- Backward compatible dengan key lama

---

### 5. CSS Updates

**Custom Scrollbar untuk Room List:**
```css
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { 
  background: rgba(255,255,255,0.03); 
  border-radius: 3px; 
}
.custom-scrollbar::-webkit-scrollbar-thumb { 
  background: rgba(255,229,0,0.3); 
  border-radius: 3px; 
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover { 
  background: rgba(255,229,0,0.5); 
}
```

---

### 6. User Flow

#### Membuat Room Pertama Kali:
1. User klik "Buat Room Baru" di lobby
2. Isi form dan buat room
3. Room otomatis tersimpan ke `host_rooms`
4. Kembali ke lobby, room muncul di list

#### Membuat Room Berikutnya:
1. User klik "Buat Room Baru" lagi
2. Isi form dan buat room baru
3. Room ditambahkan ke array
4. Kembali ke lobby, sekarang ada 2 room di list

#### Mengelola Room:
1. User lihat list room di lobby
2. Klik "Kelola →" pada room yang diinginkan
3. Redirect ke `/host/game/[code]`

---

### 7. Benefits

✅ **Unlimited rooms** - User bisa buat room sebanyak yang diinginkan
✅ **Easy access** - Semua room terlihat di lobby
✅ **Quick management** - Langsung klik "Kelola" tanpa perlu navigasi ekstra
✅ **Status visibility** - User tahu status setiap room (WAITING/PLAYING/FINISHED)
✅ **Persistent storage** - Room terseven even after browser refresh
✅ **Clean UI** - List tidak memenuhi layar (scrollable, max-height 60px)

---

### 8. Future Enhancements (Opsional)

- [ ] Delete room dari list
- [ ] Filter rooms by status
- [ ] Sort rooms by createdAt/name
- [ ] Search rooms
- [ ] Pagination jika rooms > 10
- [ ] Auto-refresh room status dari API
- [ ] Archive finished rooms (bukan di-delete)

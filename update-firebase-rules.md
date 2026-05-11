# 🔐 Panduan Update Firebase Security Rules — v2.0

> **Untuk:** Junior programmer  
> **Durasi:** ~10 menit  
> **Prasyarat:** Sudah punya akses ke Firebase Console project Smart Price Tag

---

## 📌 Kenapa Perlu Update Rules?

Di versi 1.0, Firebase RTDB hanya punya 3 node:
- `/tags` — data tag RFID
- `/device_state` — status ESP32
- `/scan_logs` — log scan

Di versi 2.0, kita menambahkan **2 node baru**:

| Node Baru | Fungsi | Siapa yang Akses |
|-----------|--------|------------------|
| `/cart` | Menyimpan keranjang belanja kiosk | **Customer (tanpa login)** + ESP32 |
| `/orders` | Menyimpan histori pesanan | **Customer write** (tanpa login) + **Admin read** (perlu login) |

Karena kiosk diakses **tanpa autentikasi** (tidak ada login), kita harus mengatur rules agar:
- `/cart` → bisa dibaca DAN ditulis oleh siapa saja (public)
- `/orders` → bisa **ditulis** oleh siapa saja (kiosk push order) tapi hanya bisa **dibaca** oleh admin yang sudah login

---

## 📋 Langkah-Langkah

---

### Langkah 1: Buka Firebase Console

1. Buka browser dan akses: **https://console.firebase.google.com/**
2. Login dengan akun Google yang terdaftar di project
3. Klik project **Smart Price Tag** (atau nama project kamu)

---

### Langkah 2: Navigasi ke Realtime Database Rules

1. Di sidebar kiri Firebase Console, klik **Build** → **Realtime Database**
2. Di halaman Realtime Database, klik tab **Rules** (tab kedua, setelah "Data")

Kamu akan melihat rules yang saat ini aktif. Kemungkinan isinya seperti ini (versi 1.0):

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

atau mungkin sudah punya rules per-node dari setup sebelumnya.

---

### Langkah 3: Salin Rules Baru

**Hapus seluruh isi** di editor rules, lalu **ganti** dengan rules berikut:

```json
{
  "rules": {
    "tags": {
      ".read": "auth != null",
      ".write": "auth != null",
      ".indexOn": ["alias", "is_active"]
    },
    "device_state": {
      ".read": "auth != null",
      ".write": true
    },
    "scan_logs": {
      ".read": "auth != null",
      ".write": true,
      ".indexOn": ["timestamp", "tag_uid"]
    },
    "cart": {
      ".read": true,
      ".write": true
    },
    "orders": {
      ".read": "auth != null",
      ".write": true,
      ".indexOn": ["status", "created_at"]
    }
  }
}
```

---

### Langkah 4: Klik "Publish"

1. Klik tombol **Publish** di atas editor rules
2. Tunggu sampai muncul notifikasi **"Rules published"** (biasanya 1–2 detik)
3. Rules langsung aktif, tidak perlu restart apapun

---

### Langkah 5: Verifikasi Rules Sudah Aktif

Setelah publish, cek kembali dengan cara:

1. Masih di tab **Rules**, baca ulang isi rules yang ditampilkan
2. Pastikan ada 5 node: `tags`, `device_state`, `scan_logs`, `cart`, `orders`
3. Pastikan `cart` punya `.read: true` dan `.write: true`

---

## 🔍 Penjelasan Detail Setiap Node

### `/tags`
```json
"tags": {
  ".read": "auth != null",
  ".write": "auth != null",
  ".indexOn": ["alias", "is_active"]
}
```
- **Read/Write:** Hanya user yang sudah login (**admin**)
- **Index:** `alias` dan `is_active` di-index supaya query lebih cepat
- **Alasan:** Data tag berisi informasi produk dan harga, hanya admin yang bisa ubah

### `/device_state`
```json
"device_state": {
  ".read": "auth != null",
  ".write": true
}
```
- **Read:** Hanya admin yang login
- **Write:** Terbuka (`true`) — karena ESP32 menulis heartbeat dan pending_uid **tanpa auth token** (ESP32 pakai legacy database secret, bukan Firebase Auth)
- **Alasan:** ESP32 butuh write akses tanpa melalui Firebase Auth

### `/scan_logs`
```json
"scan_logs": {
  ".read": "auth != null",
  ".write": true,
  ".indexOn": ["timestamp", "tag_uid"]
}
```
- **Read:** Hanya admin
- **Write:** Terbuka — ESP32 menulis log setiap kali tag di-scan
- **Index:** `timestamp` untuk query sortir berdasarkan waktu, `tag_uid` untuk filter per tag

### `/cart` 🆕
```json
"cart": {
  ".read": true,
  ".write": true
}
```
- **Read/Write:** Fully public (terbuka untuk siapa saja tanpa login)
- **Alasan:** Halaman kiosk (`/kiosk`) diakses oleh customer **tanpa login**. Customer harus bisa melihat isi keranjang dan menghapus item.
- ⚠️ **Trade-off keamanan:** Ini bukan best practice untuk production, tapi cukup untuk scope project IoT ini. Kalau mau lebih aman, bisa pakai Firebase Anonymous Auth di kiosk.

### `/orders` 🆕
```json
"orders": {
  ".read": "auth != null",
  ".write": true,
  ".indexOn": ["status", "created_at"]
}
```
- **Read:** Hanya admin yang login — customer tidak seharusnya lihat semua order orang lain
- **Write:** Terbuka — kiosk perlu push order baru saat checkout (tanpa login)
- **Index:** `status` untuk filter pending/done, `created_at` untuk sortir berdasarkan waktu

---

## 📐 Langkah 6: Inisialisasi Data Awal Cart (Opsional)

Untuk memastikan node `/cart` ada di database, buat data awal:

1. Di Firebase Console → tab **Data** (bukan Rules)
2. Klik pada root database (paling atas)
3. Klik ikon **+** untuk menambah child
4. Buat struktur berikut:

```
cart
├── status: "idle"
├── last_updated: 0
└── items: (biarkan kosong / jangan dibuat dulu)
```

**Cara memasukkan:**

| Field | Key | Value | Type |
|-------|-----|-------|------|
| 1 | `cart/status` | `idle` | String |
| 2 | `cart/last_updated` | `0` | Number |

> 💡 Node `items` tidak perlu dibuat sekarang. Node ini akan otomatis muncul saat ESP32 menulis item pertama ke `/cart/items/{uid}`.

---

## ⚠️ Troubleshooting Rules

| Masalah | Penyebab | Solusi |
|---------|----------|--------|
| Kiosk gagal baca cart — error "Permission denied" | Rules `/cart` masih `auth != null` | Pastikan `.read: true` (tanpa quotes di `true`) |
| Admin tidak bisa baca orders | Rules `/orders` read salah | Pastikan `.read: "auth != null"` (string expression) |
| Firebase Console menolak publish | Syntax JSON salah | Cek tanda kurung, koma, dan petik. Gunakan JSON validator online |
| Warning "rules are not secure" | Firebase mengingatkan bahwa ada node yang terbuka public | Ini normal untuk project ini. Klik **Dismiss** atau abaikan warning |
| Index warning di console log | Query memakai orderByChild tapi field belum di-index | Pastikan `.indexOn` sudah benar di setiap node |

---

## ✅ Checklist Selesai

- [ ] Rules sudah di-publish di Firebase Console
- [ ] Node `/cart` punya `.read: true` dan `.write: true`
- [ ] Node `/orders` punya `.read: "auth != null"` dan `.write: true`
- [ ] Index sudah ditambahkan: `["status", "created_at"]` di orders
- [ ] Data awal `/cart/status: "idle"` sudah dibuat (opsional)
- [ ] Tidak ada error "Permission denied" saat akses `/cart` tanpa login
- [ ] Admin masih bisa akses `/tags`, `/scan_logs`, `/orders` setelah login

---

*Update Firebase Rules selesai! Lanjut ke update firmware ESP32 →*

# Smart Price Tag System
## Product Requirements Document — Web Dashboard, Kiosk & Management Interface
|

### Changelog

| Versi | Perubahan |
|---|---|
| 1.1 | Initial PRD — web admin dashboard |
| 2.0 | Tambah halaman kiosk customer, node `/cart` & `/orders`, update firmware ESP32, tab Orders di admin |

---

## Daftar Isi

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Struktur Data Firebase](#3-struktur-data-firebase)
4. [Halaman & Fitur Web](#4-halaman--fitur-web)
5. [Logika Bisnis & Alur Sistem](#5-logika-bisnis--alur-sistem)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Struktur Project Next.js](#7-struktur-project-nextjs)
8. [Open Issues & Keputusan yang Dibutuhkan](#8-open-issues--keputusan-yang-dibutuhkan)
9. [Milestone Pengerjaan](#9-milestone-pengerjaan)

---

## 1. Project Overview

Smart Price Tag System adalah sistem label harga digital berbasis IoT yang memungkinkan pengelolaan harga produk secara real-time. Sistem ini terdiri dari dua antarmuka utama:

- **Web Admin Dashboard** — diakses oleh admin untuk mengelola tag RFID, produk, harga, dan melihat histori transaksi.
- **Halaman Kiosk** — diakses oleh customer melalui tablet yang selalu menyala. Customer cukup scan tag RFID ke reader, barang otomatis masuk keranjang, dan customer dapat checkout sendiri tanpa bantuan kasir.

### 1.1 Tujuan Sistem

- Menyediakan antarmuka terpusat untuk manajemen 5 tag RFID fisik
- Memungkinkan customer melakukan self-order via kiosk tablet
- Menampilkan status koneksi dan aktivitas ESP32 secara real-time
- Mencatat riwayat scan dan transaksi
- Menjamin keamanan akses admin melalui autentikasi Firebase

### 1.2 Ruang Lingkup (Scope)

> ✅ **Dalam Scope (MVP)**
> Manajemen 5 tag RFID | Registrasi tag baru | Update produk & harga | Kiosk self-order customer | Keranjang real-time | Histori transaksi | Monitoring status ESP32 | Autentikasi admin

> ❌ **Di Luar Scope**
> Multi-device ESP32 | Multi-kiosk | Laporan & analitik lanjutan | Manajemen user multi-role | Integrasi payment gateway

---

## 2. Tech Stack

| Layer | Teknologi | Alasan Pemilihan |
|---|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS | SSR/CSR flexibility, routing modern, styling cepat |
| State Management | React Context + useReducer | Cukup untuk scope project ini, tanpa overhead Redux |
| Realtime & DB | Firebase Realtime Database (RTDB) | Low-latency listener, library Arduino ESP32 tersedia |
| Auth | Firebase Authentication | Terintegrasi native dengan RTDB Security Rules |
| Hosting | Vercel (opsional) | Zero-config deployment untuk Next.js |

---

## 3. Struktur Data Firebase

### 3.1 Schema JSON (RTDB) — Lengkap

```json
{
  "tags": {
    "E2801108": {
      "alias": "Tag-01",
      "product_name": "Kemeja Flanel",
      "price": 199000,
      "is_active": true,
      "last_scanned_at": 1720000000,
      "scan_count": 12
    }
  },

  "device_state": {
    "mode": "standby",
    "lcd_line1": "Kemeja Flanel",
    "lcd_line2": "Rp 199.000",
    "online": true,
    "last_heartbeat": 1720001234,
    "pending_uid": null
  },

  "scan_logs": {
    "-NxABCD1234": {
      "tag_uid": "E2801108",
      "alias": "Tag-01",
      "product_name": "Kemeja Flanel",
      "price": 199000,
      "timestamp": 1720000000
    }
  },

  "cart": {
    "status": "idle",
    "last_updated": 1720000000,
    "items": {
      "E2801108": {
        "alias": "Tag-01",
        "product_name": "Kemeja Flanel",
        "price": 199000,
        "scanned_at": 1720000000
      }
    }
  },

  "orders": {
    "-NxPUSHKEY": {
      "items": [
        {
          "tag_uid": "E2801108",
          "alias": "Tag-01",
          "product_name": "Kemeja Flanel",
          "price": 199000
        }
      ],
      "total": 199000,
      "item_count": 1,
      "status": "pending",
      "created_at": 1720000000,
      "completed_at": null
    }
  }
}
```

### 3.2 Penjelasan Field — Semua Node

#### Node `/tags/{uid}`

| Field | Tipe | Keterangan |
|---|---|---|
| `alias` | string | Nama tetap tag, e.g. `Tag-01`. Tidak pernah berubah. |
| `product_name` | string | Nama produk yang di-assign ke tag saat ini. |
| `price` | number | Harga dalam Rupiah (integer, tanpa titik/koma). |
| `is_active` | boolean | `true` = produk tersedia. `false` = sudah terjual/kosong. |
| `last_scanned_at` | number | Unix timestamp terakhir kali tag di-scan. |
| `scan_count` | number | Total scan sejak tag didaftarkan. |

#### Node `/device_state`

| Field | Tipe | Keterangan |
|---|---|---|
| `online` | boolean | Status koneksi ESP32. Di-update via heartbeat tiap 30 detik. |
| `mode` | string | Mode ESP32 saat ini: `standby` atau `register`. |
| `lcd_line1` / `lcd_line2` | string | Teks yang sedang ditampilkan di LCD ESP32. |
| `pending_uid` | string / null | UID yang baru di-scan saat mode registrasi. `null` jika idle. |
| `last_heartbeat` | number | Unix timestamp heartbeat terakhir dari ESP32. |

#### Node `/scan_logs/{push_key}`

| Field | Tipe | Keterangan |
|---|---|---|
| `tag_uid` | string | UID fisik tag yang di-scan. |
| `alias` | string | Snapshot alias saat di-scan. |
| `product_name` | string | Snapshot nama produk saat di-scan. |
| `price` | number | Snapshot harga saat di-scan. |
| `timestamp` | number | Unix timestamp waktu scan. |

#### Node `/cart` 🆕

| Field | Tipe | Keterangan |
|---|---|---|
| `status` | string | `idle` = tidak ada sesi aktif. `active` = sedang digunakan customer. |
| `last_updated` | number | Unix timestamp terakhir kali cart diupdate. |
| `items/{uid}` | object | Item yang sudah di-scan. Key = UID tag. |
| `items/{uid}/alias` | string | Alias tag. |
| `items/{uid}/product_name` | string | Nama produk saat di-scan. |
| `items/{uid}/price` | number | Harga saat di-scan. |
| `items/{uid}/scanned_at` | number | Waktu item ini di-scan. |

> ⚠️ **Catatan:** Satu cart = satu sesi belanja aktif. UID dipakai sebagai key di `/cart/items` sehingga satu tag tidak bisa masuk keranjang dua kali (no duplikat).

#### Node `/orders/{push_key}` 🆕

| Field | Tipe | Keterangan |
|---|---|---|
| `items` | array | Snapshot semua item saat checkout. |
| `total` | number | Total harga semua item. |
| `item_count` | number | Jumlah item dalam order. |
| `status` | string | `pending` = menunggu pembayaran. `done` = selesai dibayar. |
| `created_at` | number | Unix timestamp saat order dibuat. |
| `completed_at` | number / null | Unix timestamp saat admin mark done. `null` jika belum. |

### 3.3 Security Rules (Lengkap)

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

> `/cart` fully public karena diakses kiosk tanpa auth. `/orders` write-nya terbuka supaya kiosk bisa push order baru, tapi read hanya admin.

---

## 4. Halaman & Fitur Web

Sistem memiliki dua kelompok halaman dengan akses berbeda:

| Kelompok | Route | Auth | Perangkat |
|---|---|---|---|
| Admin Dashboard | `/dashboard`, `/products`, `/tags/register`, `/history`, `/orders` | ✅ Wajib login | PC / laptop admin |
| Customer Kiosk | `/kiosk` | ❌ Tidak perlu | Tablet yang selalu menyala |

---

### 4.1 Autentikasi (Admin)

Seluruh halaman admin wajib dilindungi autentikasi. Gunakan **Firebase Authentication** dengan metode Email/Password. Halaman `/kiosk` dikecualikan dari proteksi ini.

| Flow | Detail |
|---|---|
| Login | Admin input email + password. Firebase Auth memvalidasi. Jika gagal, tampilkan pesan error spesifik. |
| Session | Token Firebase dipertahankan di browser. Admin tidak perlu login ulang selama token valid. |
| Logout | Tombol logout tersedia di navbar. Memanggil `signOut()` dan redirect ke `/login`. |
| Protected Routes | Semua route kecuali `/login` dan `/kiosk` dilindungi. Jika belum auth, redirect ke `/login`. |

> ⚠️ **Firebase Security Rules**
> ```json
> { ".read": "auth != null", ".write": "auth != null" }
> ```
> Berlaku untuk semua node kecuali `/cart` (public) dan `/orders` (write public, read auth).

---

### 4.2 Dashboard (Halaman Utama Admin)

**Route:** `/dashboard`

#### Komponen Statistik

| Kartu | Data yang Ditampilkan | Sumber Data |
|---|---|---|
| Tag Terpakai | Jumlah tag dengan `is_active: false` | RTDB `/tags` |
| Tag Tersedia | Jumlah tag dengan `is_active: true` | RTDB `/tags` |
| Total Scan Hari Ini | Jumlah log dengan timestamp = hari ini | RTDB `/scan_logs` |
| Order Pending | Jumlah order dengan `status: pending` | RTDB `/orders` |
| Status Perangkat | Online / Offline berdasarkan `last_heartbeat` | RTDB `/device_state` |

#### Indikator Status ESP32

- Badge **hijau (Online)** jika `last_heartbeat` < 60 detik yang lalu
- Badge **merah (Offline)** jika `last_heartbeat` >= 60 detik yang lalu
- Teks sekunder: *Terakhir aktif: 2 menit lalu*

#### Monitor LCD Real-time

- Subscribe ke `/device_state` menggunakan Firebase `onValue` listener
- Tampilkan `lcd_line1` dan `lcd_line2` dalam UI berbentuk kotak LCD
- Jika `device_state.online = false`, overlay dengan pesan **Perangkat Offline**

---

### 4.3 Registrasi Tag (First-Time Setup)

**Route:** `/tags/register`

#### Flow Registrasi

1. Admin klik **Mulai Scan**.
2. Web tulis `mode: "register"` ke `/device_state/mode`.
3. ESP32 masuk mode registrasi, LCD tampilkan `Waiting for scan...`
4. Admin tempelkan sticker RFID ke reader.
5. ESP32 tulis UID ke `/device_state/pending_uid`.
6. Web deteksi perubahan `pending_uid`, tampilkan UID ke admin.
7. Admin isi form: **Alias**, **Nama Barang awal**, **Harga awal**.
8. Klik **Simpan**: Web simpan ke `/tags/{UID}`, hapus `pending_uid`, mode kembali `standby`.

#### Validasi Form

- **Alias:** wajib, unik, format `Tag-XX`
- **Nama Barang:** wajib, minimal 3 karakter
- **Harga:** wajib, angka positif
- **UID:** tidak boleh duplikat — cek `/tags` sebelum menyimpan

> 💡 Komponen ini harus `"use client"` — Firebase listener tidak berjalan di Server Components.

---

### 4.4 Product Management (Core Feature Admin)

**Route:** `/products`

#### Tampilan Daftar Tag

| Kolom | Keterangan |
|---|---|
| Alias | Nama tetap tag. Read-only. |
| Nama Produk | Produk yang sedang di-assign. |
| Harga | Format Rupiah, e.g. `Rp 199.000`. |
| Status | Badge: **Tersedia** (hijau) atau **Terjual** (merah). |
| Terakhir Di-scan | Format relatif, e.g. *5 menit lalu*. |
| Aksi | Tombol **Ubah Barang** dan **Toggle Status**. |

#### Flow Update Produk

1. Klik **Ubah Barang** → modal muncul dengan data lama.
2. Admin ubah Nama Barang dan/atau Harga → klik **Update**.
3. Web write ke `/tags/{UID}/product_name` dan `/tags/{UID}/price`.
4. `is_active` otomatis di-set kembali ke `true`.

#### Toggle Status

- Gunakan **Firebase Transactions** untuk mencegah race condition.
- Tampilkan konfirmasi dialog sebelum menonaktifkan tag.

---

### 4.5 Riwayat & Monitoring

**Route:** `/history`

#### Live Log Feed

- Subscribe ke `/scan_logs` menggunakan `onChildAdded` listener.
- Format: `Tag-01 (Kemeja Flanel) — Rp 199.000 — 10:05:32`
- Batasi ke **50 entri terakhir**.

#### Tabel Riwayat

| Kolom | Keterangan |
|---|---|
| Waktu | `DD/MM/YYYY HH:mm:ss`. Sort descending. |
| Tag | Alias tag yang di-scan. |
| Produk | Nama produk saat di-scan. |
| Harga | Harga saat di-scan. |

- Filter berdasarkan rentang tanggal dan tag alias.
- Query: `orderByChild("timestamp").limitToLast(100)`.

---

### 4.6 Orders (Tab Baru Admin) 🆕

**Route:** `/orders`

Menampilkan semua order yang masuk dari kiosk secara real-time.

#### Tampilan List Order

| Kolom | Keterangan |
|---|---|
| No. Order | Urutan otomatis berdasarkan waktu. |
| Waktu | Format: `DD/MM/YYYY HH:mm:ss`. |
| Item | List nama produk dalam order. |
| Total | Total harga order. |
| Status | Badge: **Pending** (kuning) atau **Selesai** (hijau). |
| Aksi | Tombol **Tandai Selesai** untuk order berstatus pending. |

- Subscribe ke `/orders` menggunakan `onChildAdded`.
- Filter: semua / pending / selesai.
- Klik **Tandai Selesai** → Firebase update `status: done` dan isi `completed_at`.

---

### 4.7 Halaman Kiosk Customer 🆕

**Route:** `/kiosk` — Tidak butuh auth. Dirancang untuk tablet landscape yang selalu menyala.

Halaman ini memiliki **4 state** yang transisi otomatis berdasarkan data Firebase.

---

#### State 1 · Idle

**Kondisi:** `/cart/items` kosong.

Layar standby fullscreen. Teks besar di tengah: *"Silakan scan barang"* dengan instruksi singkat di bawahnya. Animasi subtle (ikon scan berdenyut pelan) supaya layar tidak terlihat mati. Tidak ada tombol apapun.

**Trigger transisi ke State 2:** `onChildAdded` di `/cart/items` mendeteksi item pertama masuk.

---

#### State 2 · Scan Feedback

**Durasi:** ~1.5 detik, otomatis.

Setiap kali item baru di-scan, layar menampilkan feedback fullscreen sesaat — nama barang dan harga muncul besar di tengah dengan animasi slide-in. Memberikan konfirmasi visual yang jelas bahwa scan berhasil.

**Trigger transisi ke State 3:** Setelah 1.5 detik, otomatis masuk ke tampilan keranjang.

> 💡 State ini juga muncul kembali setiap kali ada item baru ditambahkan saat sedang di State 3 (customer scan barang lagi).

---

#### State 3 · Keranjang Aktif

**Kondisi:** ada minimal 1 item di `/cart/items`.

Layout dua kolom:

**Kolom kiri — List item:**
- Nama produk dan harga per item
- Tombol hapus (X) per item untuk koreksi salah scan
- Setiap item baru muncul dengan animasi slide-in dari bawah

**Kolom kanan — Ringkasan:**
- Jumlah item
- Total harga (update real-time)
- Hint: *"Scan barang lagi untuk menambah"* (teks kecil, tidak perlu sentuh layar)
- Tombol besar **Selesai & Order**

**Trigger transisi ke State 4:** Customer tekan *Selesai & Order*.

**Trigger kembali ke State 1:** Semua item dihapus manual (keranjang kosong).

---

#### State 4 · Konfirmasi & Selesai

Muncul setelah customer tekan *Selesai & Order*.

Tampil ringkasan final — list semua item dan total — dengan dua tombol: **Konfirmasi** dan **Batal** (kembali ke State 3).

**Jika Konfirmasi ditekan:**
1. Firebase push data ke `/orders` dengan `status: pending`.
2. Firebase reset `/cart/items` jadi kosong, `status` jadi `idle`.
3. Tampil animasi sukses + pesan *"Pesanan berhasil! Silakan ke kasir untuk pembayaran"*.
4. Setelah 5 detik, otomatis kembali ke State 1.

---

## 5. Logika Bisnis & Alur Sistem

### 5.1 Alur Scan di Kiosk (Update v2.0)

| Kondisi | Aksi ESP32 | Aksi Firebase |
|---|---|---|
| Scan, `is_active: true`, item belum di cart | Tampilkan nama & harga di LCD. Buzzer 200ms. LED hijau. | Set `is_active: false`. Tulis ke `/scan_logs`. **Push item ke `/cart/items/{uid}`.** Update `/cart/last_updated`. |
| Scan, `is_active: true`, item sudah di cart | LCD tampilkan `Sudah di keranjang!`. Buzzer 2x pendek. | Tidak ada perubahan data. |
| Scan, `is_active: false` | LCD tampilkan `Tag Inactive / Sold`. Buzzer 2x pendek. LED merah. | Tidak ada perubahan data. |
| UID tidak dikenal | LCD tampilkan `Unknown Tag`. Buzzer 3x cepat. | Tidak ada perubahan data. |

### 5.2 Alur Checkout

1. Customer tekan **Konfirmasi** di kiosk.
2. Kiosk push order ke `/orders` (snapshot semua item + total).
3. Kiosk hapus semua item di `/cart/items`, set `status: idle`.
4. ESP32 mendeteksi `/cart/status` berubah ke `idle` → LCD kembali ke `Ready!`.
5. Admin melihat order baru muncul di tab Orders dashboard.
6. Setelah pembayaran diterima, admin klik **Tandai Selesai** → `status: done`.

### 5.3 Sinkronisasi ESP32 & Web

- ESP32 listen `/tags/{UID}` — data terbaru langsung terdeteksi tanpa polling.
- ESP32 listen `/device_state/mode` — untuk masuk/keluar mode registrasi.
- **Baru:** ESP32 listen `/cart/status` — untuk reset LCD setelah checkout selesai.
- **Heartbeat:** ESP32 tulis ke `/device_state/last_heartbeat` setiap 30 detik.
- **Offline cache:** Jika WiFi putus, ESP32 cache data terakhir di `Preferences/SPIFFS`.

---

## 6. Non-Functional Requirements

| Aspek | Requirement | Catatan Implementasi |
|---|---|---|
| Performa | Real-time update < 500ms dari Firebase ke UI | Gunakan Firebase listener, bukan polling. |
| Keamanan | Akses admin diproteksi Firebase Auth & Security Rules | Tidak ada data admin yang bisa diakses tanpa token. |
| Kiosk — Akses Publik | `/kiosk` tidak butuh auth, tapi data write dibatasi hanya ke `/cart` dan `/orders` | Security Rules memisahkan akses per node. |
| Responsivitas Admin | UI responsif di desktop dan tablet (min. 768px) | Tailwind breakpoints `md:` dan `lg:`. |
| Kiosk — Layout | Dioptimalkan untuk layar tablet landscape (min. 1024px) | Tailwind breakpoint `lg:` dan `landscape:`. |
| Error Handling | Setiap Firebase operation dibungkus try/catch dengan feedback ke user | Toast notification untuk admin. Visual feedback untuk kiosk. |
| Offline State | Web menampilkan banner peringatan jika ESP32 offline > 60 detik | Berdasarkan `last_heartbeat` dari RTDB. |
| Race Condition | Operasi `is_active` dan `cart` menggunakan Firebase Transactions | Mencegah double-scan / konflik tulis. |
| Kiosk — Auto Reset | Halaman kiosk otomatis kembali ke State 1 setelah checkout | Tidak perlu interaksi manual dari siapapun. |

---

## 7. Struktur Project Next.js

```
src/
  app/
    (auth)/
      login/page.tsx
    (dashboard)/
      layout.tsx                # Protected layout + navbar admin
      dashboard/page.tsx        # 4.2 Dashboard
      tags/
        register/page.tsx       # 4.3 Registrasi Tag
      products/page.tsx         # 4.4 Product Management
      history/page.tsx          # 4.5 Riwayat & Monitoring
      orders/page.tsx           # 4.6 Orders (baru)
    kiosk/
      page.tsx                  # 4.7 Kiosk Customer (baru, no auth)

  lib/
    firebase.ts                 # Firebase init & config
    auth.ts                     # Auth helper functions
    tags.ts                     # RTDB operations untuk /tags
    logs.ts                     # RTDB operations untuk /scan_logs
    cart.ts                     # RTDB operations untuk /cart (baru)
    orders.ts                   # RTDB operations untuk /orders (baru)

  components/
    ui/                         # Shared UI components
    tags/                       # Tag-specific components
    dashboard/                  # Dashboard widgets
    kiosk/                      # Kiosk-specific components (baru)
      IdleScreen.tsx            # State 1 — layar idle
      ScanFeedback.tsx          # State 2 — feedback sesaat setelah scan
      CartView.tsx              # State 3 — tampilan keranjang
      ConfirmScreen.tsx         # State 4 — konfirmasi & selesai
    orders/                     # Orders components (baru)
      OrderList.tsx             # List order untuk admin
      OrderCard.tsx             # Card per order
```

---

## 8. Open Issues & Keputusan yang Dibutuhkan

| # | Issue | Opsi | Status |
|---|---|---|---|
| 1 | Apakah `scan_logs` perlu di-cleanup otomatis? | A) Biarkan tumbuh &nbsp; B) Auto-delete log > 30 hari via Cloud Function | ⏳ Belum diputuskan |
| 2 | Apakah perlu export data log/order ke CSV? | A) Tidak untuk MVP &nbsp; B) Tambahkan tombol export | ⏳ Belum diputuskan |
| 3 | Jika tablet kiosk mati saat ada item di cart, bagaimana recovery-nya? | A) Cart otomatis di-reset saat kiosk restart &nbsp; B) Lanjutkan sesi sebelumnya | ⏳ Belum diputuskan |
| 4 | Apakah customer bisa hapus semua item sekaligus (clear cart)? | A) Hapus per item saja &nbsp; B) Tambah tombol "Kosongkan Keranjang" | ⏳ Belum diputuskan |

---

## 9. Milestone Pengerjaan

| Fase | Target | Deliverable |
|---|---|---|
| **Fase 1 — Setup** | Minggu 1 | Init project Next.js, konfigurasi Firebase Auth + RTDB, setup Security Rules, protected routing. |
| **Fase 2 — Core Admin** | Minggu 2 | Halaman Product Management (4.4) + Registrasi Tag (4.3). |
| **Fase 3 — Dashboard** | Minggu 3 | Dashboard (4.2) dengan statistik dan monitor LCD real-time. |
| **Fase 4 — History** | Minggu 3–4 | Halaman Riwayat (4.5) dengan live log dan tabel histori. |
| **Fase 5 — Polish Admin** | Minggu 4 | Error handling, loading states, responsivitas, testing end-to-end dengan hardware. |
| **Fase 6 — Kiosk & Schema** | Minggu 5 | Update Firebase schema + Security Rules. Update firmware ESP32. Bangun halaman `/kiosk` dengan 4 state. |
| **Fase 7 — Orders & Polish** | Minggu 6 | Tab Orders di dashboard admin (4.6). Testing end-to-end: scan → keranjang → checkout → admin terima order. Polish animasi dan transisi kiosk. |

---

*Smart Price Tag System — Web PRD v2.0*
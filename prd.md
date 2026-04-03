# Smart Price Tag System

## Product Requirements Document — Web Dashboard & Management Interface

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

Smart Price Tag System adalah sistem label harga digital berbasis IoT yang memungkinkan pengelolaan harga produk secara real-time. Admin dapat mengubah nama barang dan harga melalui web dashboard, dan perubahan tersebut langsung terefleksi di perangkat ESP32 ketika sticker RFID di-scan.

### 1.1 Tujuan Web Dashboard

- Menyediakan antarmuka terpusat untuk manajemen 5 tag RFID fisik
- Menampilkan status koneksi dan aktivitas ESP32 secara real-time
- Mencatat riwayat scan dan perubahan produk
- Menjamin keamanan akses melalui autentikasi Firebase

### 1.2 Ruang Lingkup (Scope)

> ✅ **Dalam Scope (MVP)**
> Manajemen 5 tag RFID | Registrasi tag baru | Update produk & harga | Monitoring status ESP32 | Live log aktivitas | Autentikasi admin


---

## 2. Tech Stack

| Layer            | Teknologi                           | Alasan Pemilihan                                     |
| ---------------- | ----------------------------------- | ---------------------------------------------------- |
| Frontend         | Next.js (App Router) + Tailwind CSS | SSR/CSR flexibility, routing modern, styling cepat   |
| State Management | React Context + useReducer          | Cukup untuk scope project ini, tanpa overhead Redux  |
| Realtime & DB    | Firebase Realtime Database (RTDB)   | Low-latency listener, library Arduino ESP32 tersedia |
| Auth             | Firebase Authentication             | Terintegrasi native dengan RTDB Security Rules       |
| Hosting          | Vercel (opsional)                   | Zero-config deployment untuk Next.js                 |

---

## 3. Struktur Data Firebase

### 3.1 Schema JSON (RTDB)

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
  }
}
```

### 3.2 Penjelasan Field

| Field                      | Tipe          | Keterangan                                                    |
| -------------------------- | ------------- | ------------------------------------------------------------- |
| `alias`                    | string        | Nama tetap tag, e.g. `Tag-01`. Tidak pernah berubah.          |
| `product_name`             | string        | Nama produk yang di-assign ke tag saat ini.                   |
| `price`                    | number        | Harga dalam Rupiah (integer, tanpa titik/koma).               |
| `is_active`                | boolean       | `true` = produk tersedia. `false` = sudah terjual/kosong.     |
| `last_scanned_at`          | number        | Unix timestamp terakhir kali tag di-scan.                     |
| `scan_count`               | number        | Total scan sejak tag didaftarkan.                             |
| `device_state.online`      | boolean       | Status koneksi ESP32. Di-update via heartbeat tiap 30 detik.  |
| `device_state.mode`        | string        | Mode ESP32 saat ini: `standby` atau `register`.               |
| `device_state.lcd_line1/2` | string        | Teks yang sedang ditampilkan di LCD ESP32.                    |
| `device_state.pending_uid` | string / null | UID yang baru di-scan saat mode registrasi. `null` jika idle. |
| `scan_logs`                | object        | Log setiap scan. Key = Firebase push key (auto-generated).    |

---

## 4. Halaman & Fitur Web

### 4.1 Autentikasi

Seluruh halaman web wajib dilindungi autentikasi. Gunakan **Firebase Authentication** dengan metode Email/Password.

| Flow             | Detail                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Login            | Admin input email + password. Firebase Auth memvalidasi. Jika gagal, tampilkan pesan error spesifik (email tidak terdaftar / password salah). |
| Session          | Token Firebase dipertahankan di browser. Admin tidak perlu login ulang selama token valid.                                                    |
| Logout           | Tombol logout tersedia di navbar. Memanggil `Firebase signOut()` dan redirect ke halaman login.                                               |
| Protected Routes | Semua route kecuali `/login` dilindungi. Jika belum auth, redirect otomatis ke `/login`.                                                      |

> ⚠️ **Firebase Security Rules**
> Terapkan rules RTDB yang memastikan: (1) hanya authenticated user yang bisa read/write, (2) node `scan_logs` hanya bisa di-write oleh ESP32 service account atau dari client yang auth.
>
> ```json
> { ".read": "auth != null", ".write": "auth != null" }
> ```

---

### 4.2 Dashboard (Halaman Utama)

**Route:** `/dashboard` — Halaman pertama setelah login. Memberikan gambaran umum status sistem.

#### Komponen Statistik

| Kartu               | Data yang Ditampilkan                         | Sumber Data          |
| ------------------- | --------------------------------------------- | -------------------- |
| Tag Terpakai        | Jumlah tag dengan `is_active: false`          | RTDB `/tags`         |
| Tag Tersedia        | Jumlah tag dengan `is_active: true`           | RTDB `/tags`         |
| Total Scan Hari Ini | Jumlah log dengan timestamp = hari ini        | RTDB `/scan_logs`    |
| Status Perangkat    | Online / Offline berdasarkan `last_heartbeat` | RTDB `/device_state` |

#### Indikator Status ESP32

- Tampilkan badge **hijau (Online)** jika `last_heartbeat` < 60 detik yang lalu
- Tampilkan badge **merah (Offline)** jika `last_heartbeat` >= 60 detik yang lalu
- Timestamp `last_heartbeat` ditampilkan sebagai teks sekunder, e.g. _Terakhir aktif: 2 menit lalu_

#### Monitor LCD Real-time

- Subscribe ke `/device_state` menggunakan Firebase `onValue` listener
- Tampilkan `lcd_line1` dan `lcd_line2` dalam UI berbentuk kotak yang mensimulasikan layar LCD fisik
- Jika `device_state.online = false`, overlay tampilan LCD dengan pesan **Perangkat Offline**

---

### 4.3 Registrasi Tag (First-Time Setup)

**Route:** `/tags/register` — Digunakan untuk mendaftarkan sticker RFID baru ke dalam sistem. Halaman ini hanya relevan untuk setup awal.

#### Flow Registrasi

1. Admin klik tombol **Mulai Scan** di halaman ini.
2. Web menulis nilai `mode: "register"` ke RTDB path `/device_state/mode`.
3. ESP32 yang sedang listen path tersebut masuk ke mode registrasi dan menampilkan `Waiting for scan...` di LCD.
4. Admin menempelkan sticker RFID ke reader RC522.
5. ESP32 membaca UID dan menulis UID tersebut ke path `/device_state/pending_uid`.
6. Web mendeteksi perubahan di `pending_uid` dan menampilkan UID yang terdeteksi ke admin.
7. Admin mengisi form: **Alias** (e.g., `Tag-01`), **Nama Barang awal**, dan **Harga awal**.
8. Klik **Simpan**: Web menyimpan data ke `/tags/{UID}` dan menghapus `pending_uid`. Mode kembali ke `standby`.

#### Validasi Form

- **Alias:** wajib diisi, unik (tidak boleh duplikat), format `Tag-XX`
- **Nama Barang:** wajib diisi, minimal 3 karakter
- **Harga:** wajib diisi, angka positif
- **UID:** tidak boleh duplikat — cek `/tags` sebelum menyimpan

> 💡 **Catatan Implementasi**
> Komponen halaman ini harus menggunakan `"use client"` karena Firebase listener hanya berjalan di sisi klien (browser), bukan di Next.js Server Components.

---

### 4.4 Product Management (Core Feature)

**Route:** `/products` — Halaman utama untuk operasional sehari-hari. Admin dapat mengubah produk yang di-assign ke setiap tag kapan saja.

#### Tampilan Daftar Tag

| Kolom            | Keterangan                                                                    |
| ---------------- | ----------------------------------------------------------------------------- |
| Alias            | Nama tetap tag, e.g. `Tag-01`. Read-only.                                     |
| Nama Produk      | Produk yang sedang di-assign.                                                 |
| Harga            | Ditampilkan dalam format Rupiah, e.g. `Rp 199.000`.                           |
| Status           | Badge: **Tersedia** (hijau) atau **Terjual** (merah) berdasarkan `is_active`. |
| Terakhir Di-scan | Format relatif, e.g. _5 menit lalu_ atau _Belum pernah di-scan_.              |
| Aksi             | Tombol **Ubah Barang** dan **Toggle Status**.                                 |

#### Flow Update Produk (Re-assign)

1. Admin klik **Ubah Barang** pada baris tag yang ingin diubah.
2. Modal/drawer muncul dengan field **Nama Barang Baru** dan **Harga Baru** yang sudah terisi data lama.
3. Admin mengubah data dan klik **Update**.
4. Web melakukan write ke `/tags/{UID}/product_name` dan `/tags/{UID}/price`.
5. Secara otomatis, `is_active` di-set kembali ke `true` (produk baru = tersedia).
6. ESP32 akan mengambil data terbaru dari path tersebut saat tag di-scan berikutnya.

#### Toggle Status Aktif

- Tombol toggle memungkinkan admin mengubah `is_active` secara manual
- Gunakan **Firebase Transactions** untuk operasi ini guna mencegah race condition
- Tampilkan konfirmasi dialog sebelum menonaktifkan tag (`is_active: false`)

---

### 4.5 Riwayat & Monitoring

**Route:** `/history` — Menampilkan log aktivitas scan secara real-time dan histori lengkap.

#### Live Log Feed

- Subscribe ke `/scan_logs` menggunakan `onChildAdded` listener (bukan `onValue`) untuk efisiensi
- Setiap entri log baru muncul di bagian atas list secara otomatis
- Format tampilan: `Tag-01 (Kemeja Flanel) — Rp 199.000 — 10:05:32`
- Batasi tampilan live feed ke **50 entri terakhir** untuk performa

#### Tabel Riwayat Lengkap

| Kolom  | Keterangan                                                 |
| ------ | ---------------------------------------------------------- |
| Waktu  | Format: `DD/MM/YYYY HH:mm:ss`. Sort descending by default. |
| Tag    | Alias tag yang di-scan.                                    |
| Produk | Nama produk saat di-scan (snapshot dari data saat itu).    |
| Harga  | Harga saat di-scan.                                        |

- Tambahkan filter berdasarkan rentang tanggal dan filter berdasarkan tag alias
- Data diambil dengan query Firebase: `orderByChild("timestamp").limitToLast(100)`

---

## 5. Logika Bisnis & Alur Sistem

### 5.1 Alur Scan di Kasir

| Kondisi                             | Aksi ESP32                                                        | Aksi Web (Firebase)                                                                |
| ----------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Tag di-scan, `is_active: true`      | Tampilkan nama & harga di LCD. Buzzer 200ms. LED hijau.           | Set `is_active: false` via Firebase Transaction. Tulis entry baru ke `/scan_logs`. |
| Tag di-scan, `is_active: false`     | LCD tampilkan `Tag Inactive / Sold`. Buzzer 2x pendek. LED merah. | Tidak ada perubahan data.                                                          |
| UID tidak dikenal (belum terdaftar) | LCD tampilkan `Unknown Tag`. Buzzer 3x cepat.                     | Tidak ada perubahan data.                                                          |

### 5.2 Sinkronisasi ESP32 & Web

- ESP32 menggunakan Firebase listener (`setOn`) untuk path `/tags/{UID}` — data terbaru langsung terdeteksi tanpa polling
- **Heartbeat:** ESP32 menulis timestamp ke `/device_state/last_heartbeat` setiap 30 detik selama online
- **Offline cache:** Jika koneksi WiFi putus, ESP32 cache data terakhir di `Preferences/SPIFFS` dan tetap bisa menampilkan info produk dari cache
- **Mode registrasi:** Web menulis ke `/device_state/mode`, ESP32 listen path ini untuk masuk/keluar mode registrasi

---

## 6. Non-Functional Requirements

| Aspek          | Requirement                                                           | Catatan Implementasi                                |
| -------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
| Performa       | Real-time update < 500ms dari Firebase ke UI                          | Gunakan Firebase listener, bukan polling.           |
| Keamanan       | Seluruh akses RTDB diproteksi Firebase Auth & Security Rules          | Tidak ada data yang bisa diakses tanpa token valid. |
| Responsivitas  | UI responsif di desktop dan tablet (min. 768px)                       | Tailwind breakpoints: `md:` dan `lg:`               |
| Error Handling | Setiap Firebase operation dibungkus try/catch dengan feedback ke user | Toast notification untuk success/error.             |
| Offline State  | Web menampilkan banner peringatan jika ESP32 offline > 60 detik       | Berdasarkan `last_heartbeat` dari RTDB.             |
| Race Condition | Operasi `is_active` menggunakan Firebase Transactions                 | Mencegah double-scan / konflik tulis.               |

---

## 7. Struktur Project Next.js

```
src/
  app/
    (auth)/
      login/page.tsx
    (dashboard)/
      layout.tsx              # Protected layout + navbar
      dashboard/page.tsx      # 4.2 Dashboard
      tags/
        register/page.tsx     # 4.3 Registrasi Tag
      products/page.tsx       # 4.4 Product Management
      history/page.tsx        # 4.5 Riwayat & Monitoring
  lib/
    firebase.ts               # Firebase init & config
    auth.ts                   # Auth helper functions
    tags.ts                   # RTDB operations untuk /tags
    logs.ts                   # RTDB operations untuk /scan_logs
  components/
    ui/                       # Shared UI components
    tags/                     # Tag-specific components
    dashboard/                # Dashboard widgets
```

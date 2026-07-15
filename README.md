# Smart Price Tag System

Sistem label harga digital berbasis Internet of Things (IoT) yang menggabungkan perangkat keras (ESP32) dan perangkat lunak (Dashboard Next.js) menggunakan sinkronisasi Firebase Realtime Database. Proyek ini bertujuan untuk mengatasi masalah pembaruan label harga konvensional di ritel dengan memungkinkan perubahan nama barang dan harga secara *real-time* langsung dari web tanpa menyentuh perangkat fisik.

## 🌟 Fitur Utama

### 💻 Web Dashboard (Next.js)
- **Real-time Synchronization:** Perubahan harga dan data produk dari web langsung tersinkronisasi ke perangkat ESP32 secara instan.
- **Device Management:** Memantau status perangkat (*heartbeat*) apakah sedang *online* atau *offline*.
- **Mode Kontrol Alat:** Mengontrol perangkat ESP32 untuk berpindah antara **Mode Standby/Kiosk** (cek harga) atau **Mode Register** (pendaftaran RFID Card/Tag baru) dari jarak jauh.
- **Kiosk Display Mode:** Antarmuka khusus untuk menampilkan informasi produk di layar yang lebih besar kepada pelanggan.

### 🔌 IoT Hardware (ESP32)
- **Pendeteksi RFID:** Membaca tag MFRC522 dan menampilkan detail barang pada LCD 16x2.
- **Offline Cache Memory:** ESP32 menyimpan data harga terakhir di memori lokal (*Preferences*). Jika WiFi/Internet terputus, perangkat tetap bisa menampilkan harga terakhir dari tag yang di-scan.
- **Indikator Visual & Audio:** Menggunakan LED (Hijau & Merah) dan Buzzer aktif untuk memberikan umpan balik saat proses *scan* berhasil atau gagal.

## 🛠️ Tech Stack

### Web Application
- **Framework:** [Next.js 16](https://nextjs.org/) (React 19)
- **Styling:** Tailwind CSS v4 & Lucide React
- **Database / Backend:** Firebase Realtime Database
- **Language:** TypeScript

### Hardware
- **Microcontroller:** ESP32 DevKit V1
- **RFID Module:** MFRC522 (Interface SPI)
- **Display:** LCD I2C 16x2
- **Language:** C++ (Arduino IDE)

## 📁 Struktur Proyek Utama

```text
Project/
├── esp32/
│   └── SmartPriceTag/       # Folder source code Arduino (C++) untuk ESP32
│       ├── smart_price_tag.ino
│       └── README.md        # Dokumentasi khusus instalasi hardware & skema kabel
├── src/
│   ├── app/                 # Routing aplikasi Next.js (Auth, Dashboard, Kiosk)
│   ├── components/          # Komponen UI Reusable (React)
│   ├── lib/                 # Utilitas (Konfigurasi Firebase, Device Handler)
│   └── types/               # Definisi Type/Interface TypeScript
└── .env.local.example       # Contoh environment variable untuk Web
```

## 🚀 Panduan Instalasi (Web Dashboard)

1. **Clone repository ini:**
   ```bash
   git clone <repo-url>
   cd "Project"
   ```

2. **Instal dependensi web:**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment Variables:**
   Salin `.env.local.example` menjadi `.env.local` dan isi dengan konfigurasi Firebase Anda:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_FIREBASE_DATABASE_URL=your_database_url
   ```

4. **Jalankan Development Server:**
   ```bash
   npm run dev
   ```
   Buka [http://localhost:3000](http://localhost:3000) pada browser Anda.

## 🔌 Panduan Instalasi (Perangkat Keras / ESP32)

Kode sumber untuk perangkat keras ESP32 tersedia di repositori terpisah yang diintegrasikan sebagai *Git submodule*:
🔗 **[Repository ESP32: Kyz-Riki/SmartPriceTag](https://github.com/Kyz-Riki/SmartPriceTag.git)**

Untuk melihat skema perkabelan (*wiring*), dependensi *library* Arduino, dan cara me-*flash* kode ke ESP32 secara lokal, silakan merujuk ke dokumentasi khusus perangkat keras di direktori `esp32` proyek ini:
👉 **[Dokumentasi Hardware ESP32](./esp32/SmartPriceTag/README.md)**

---

*Dikembangkan untuk efisiensi ritel masa depan.*

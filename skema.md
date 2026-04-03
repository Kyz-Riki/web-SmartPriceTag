# 🔌 Skema Hardware — Smart Price Tag System

> **Komponen:** ESP32 · RC522 RFID Reader · LCD I2C 16x2 · LED Hijau · LED Merah · Buzzer · Resistor 220Ω (×2) · Breadboard · Kabel Jumper · RFID Sticker (×5) · USB · Powerbank

---

## 📋 Daftar Komponen Lengkap

| No | Komponen | Jumlah | Keterangan |
|----|----------|--------|------------|
| 1 | ESP32 DevKit v1 | 1 | Mikrokontroler utama |
| 2 | RFID Reader RC522 | 1 | Baca sticker RFID (SPI) |
| 3 | RFID Sticker / Tag | 5 | Satu per produk |
| 4 | LCD 16×2 + Modul I2C | 1 | Tampilkan nama & harga produk |
| 5 | LED Hijau | 1 | Indikator tag aktif / scan berhasil |
| 6 | LED Merah | 1 | Indikator tag nonaktif / error |
| 7 | Buzzer Aktif | 1 | Bunyi saat scan |
| 8 | Resistor 220Ω | 2 | Satu untuk LED Hijau, satu untuk LED Merah |
| 9 | Breadboard | 1 | Papan rangkaian prototipe |
| 10 | Kabel Jumper | ±25 | Male-to-male (M2M) dan Male-to-female (M2F) |
| 11 | Kabel USB | 1 | Micro-USB atau USB-C (sesuai ESP32) |
| 12 | Powerbank | 1 | Sumber daya portabel via USB |

---

## 📌 Peta Pin ESP32

| GPIO | Terhubung ke | Fungsi |
|------|-------------|--------|
| **GPIO 5** | RC522 → SDA/SS | SPI Chip Select RFID |
| **GPIO 18** | RC522 → SCK | SPI Clock |
| **GPIO 23** | RC522 → MOSI | SPI Data (ESP→RFID) |
| **GPIO 19** | RC522 → MISO | SPI Data (RFID→ESP) |
| **GPIO 27** | RC522 → RST | Reset RFID Reader |
| **GPIO 21** | LCD → SDA | I2C Data |
| **GPIO 22** | LCD → SCL | I2C Clock |
| **GPIO 2** | Resistor 220Ω → LED Hijau | Output digital |
| **GPIO 4** | Resistor 220Ω → LED Merah | Output digital |
| **GPIO 15** | Buzzer (+) | Output digital |
| **3.3V** | RC522 → 3.3V | Sumber daya RFID |
| **5V (VIN)** | LCD → VCC | Sumber daya LCD |
| **GND** | Semua GND | Ground bersama |

---

## 🗺️ Diagram Wiring (Blok)

```
                        ┌─────────────────────┐
                        │       ESP32          │
                        │                      │
  ┌──────────────┐      │  GPIO 5  ←── SDA/SS ─┼────┐
  │  RC522 RFID  │      │  GPIO 18 ←── SCK    ─┼────┤
  │   Reader     │──────│  GPIO 23 ──→ MOSI   ─┼────┤  SPI Bus
  │              │      │  GPIO 19 ←── MISO   ─┼────┤
  │              │      │  GPIO 27 ──→ RST    ─┼────┘
  └──────────────┘      │                      │
                        │  GPIO 21 ←──→ SDA   ─┼────┐
  ┌──────────────┐      │  GPIO 22 ←──→ SCL   ─┼────┤  I2C Bus
  │  LCD 16×2   │──────│  5V      ──→ VCC    ─┼────┤
  │  + I2C Modul │      │  GND     ──→ GND    ─┼────┘
  └──────────────┘      │                      │
                        │  GPIO 2  ──→ [220Ω]─LED(H)─→ GND
                        │  GPIO 4  ──→ [220Ω]─LED(M)─→ GND
                        │  GPIO 15 ──→ Buzzer(+)       │
                        │  GND     ──────────── Buzzer(-)
                        │                      │
                        │  USB ←── Powerbank   │
                        └─────────────────────┘
```

---

## 🔍 Detail Wiring Per Komponen

---

### 1. RFID Reader RC522

> Operasi di tegangan **3.3V** — jangan hubungkan ke 5V, bisa rusak!

| Pin RC522 | → | Pin ESP32 | Warna Kabel (Saran) |
|-----------|---|-----------|---------------------|
| SDA (SS) | → | GPIO 5  | Kuning |
| SCK      | → | GPIO 18 | Oranye |
| MOSI     | → | GPIO 23 | Hijau  |
| MISO     | → | GPIO 19 | Biru   |
| RST      | → | GPIO 27 | Putih  |
| 3.3V     | → | 3.3V    | Merah  |
| GND      | → | GND     | Hitam  |
| IRQ      | - | (tidak dipakai) | — |

---

### 2. LCD 16×2 + Modul I2C

> Modul I2C ditempel di belakang LCD. Hanya butuh **4 kabel** saja!

| Pin I2C Modul | → | Pin ESP32 | Warna Kabel (Saran) |
|---------------|---|-----------|---------------------|
| VCC | → | 5V (VIN) | Merah |
| GND | → | GND | Hitam |
| SDA | → | GPIO 21 | Biru |
| SCL | → | GPIO 22 | Kuning |

> 💡 **Cek alamat I2C:** Jalankan sketch `I2C Scanner` dulu. Alamat LCD biasanya `0x27` atau `0x3F`. Ukur dengan multimeter jika tidak tahu.

---

### 3. LED Hijau (Indikator Tag Aktif)

```
GPIO 2 ──── [Resistor 220Ω] ──── (Anoda/+) LED Hijau (Katoda/-) ──── GND
```

> ⚠️ **Resistor wajib!** Tanpa resistor 220Ω, LED akan putus karena kelebihan arus.
> - Kaki (+) LED = kaki yang lebih **panjang**
> - Kaki (−) LED = kaki yang lebih **pendek**

---

### 4. LED Merah (Indikator Tag Nonaktif / Error)

```
GPIO 4 ──── [Resistor 220Ω] ──── (Anoda/+) LED Merah (Katoda/-) ──── GND
```

---

### 5. Buzzer Aktif

> Gunakan **buzzer aktif** (berbunyi saat diberi tegangan), bukan buzzer pasif.

```
GPIO 15 ──── Pin (+) Buzzer
GND     ──── Pin (−) Buzzer
```

> 💡 Buzzer aktif biasanya ada tanda `+` di body-nya. Tegangan operasi: 3.3V–5V.

---

### 6. Power Supply

```
Powerbank ──── Kabel USB ──── Port USB ESP32
                                    │
                              ESP32 regulator
                            ┌───────┴───────┐
                          3.3V            5V (VIN)
                            │               │
                        RC522 VCC       LCD VCC
```

> ✅ Powerbank yang mendukung output 5V/1A sudah cukup.  
> ESP32 mengonsumsi sekitar 240mA saat WiFi aktif.

---

## 📐 Layout Breadboard (Panduan Pemasangan)

```
     Breadboard
┌─────────────────────────────────────┐
│  [+] ─────────────────────── [+]   │  ← Rail 5V (dari VIN ESP32)
│  [-] ─────────────────────── [-]   │  ← Rail GND
│                                     │
│  [ESP32]  di tengah breadboard      │
│                                     │
│  [RC522]  di sisi kiri              │
│  → hubungkan ke ESP32 via jumper    │
│                                     │
│  [LED H] [R220] ← GPIO2             │
│  [LED M] [R220] ← GPIO4             │
│  [BUZZER]       ← GPIO15            │
│                                     │
└─────────────────────────────────────┘

[LCD + I2C] → Di luar breadboard (punya konektor sendiri)
              Hubungkan via 4 kabel jumper M2F ke ESP32
```

---

## ✅ Checklist Perakitan

Ikuti urutan ini agar tidak keliru:

- [ ] **Step 1:** Pasang ESP32 di tengah breadboard
- [ ] **Step 2:** Hubungkan rail GND breadboard ke pin GND ESP32
- [ ] **Step 3:** Hubungkan rail 5V breadboard ke pin VIN ESP32
- [ ] **Step 4:** Pasang RC522 — hubungkan 7 kabel SPI + VCC 3.3V + GND
- [ ] **Step 5:** Hubungkan LCD I2C — 4 kabel (VCC, GND, SDA, SCL)
- [ ] **Step 6:** Pasang resistor 220Ω untuk LED Hijau, hubungkan ke GPIO 2
- [ ] **Step 7:** Pasang resistor 220Ω untuk LED Merah, hubungkan ke GPIO 4
- [ ] **Step 8:** Pasang buzzer — (+) ke GPIO 15, (−) ke GND
- [ ] **Step 9:** Double-check semua koneksi GND terhubung ke rail GND yang sama
- [ ] **Step 10:** Hubungkan USB ke Powerbank → ESP32 menyala
- [ ] **Step 11:** Upload sketch dan buka Serial Monitor (115200 baud) untuk cek koneksi

---

## 🔎 Troubleshooting Umum

| Gejala | Kemungkinan Penyebab | Solusi |
|--------|----------------------|--------|
| LCD tidak tampil apapun | Alamat I2C salah | Jalankan I2C Scanner, coba `0x3F` |
| LCD tampil kotak-kotak | Kontras terlalu rendah | Putar potensio di belakang modul I2C |
| RFID tidak terbaca | Pin SPI salah / tegangan 5V | Periksa wiring, pastikan pakai 3.3V |
| LED tidak nyala | Polaritas terbalik / tanpa resistor | Balik kaki LED, pastikan resistor terpasang |
| Buzzer berbunyi terus | Pakai buzzer pasif, bukan aktif | Ganti ke buzzer aktif |
| ESP32 tidak connect WiFi | SSID/Password salah di `config.h` | Cek kembali string WiFi |
| Firebase gagal | `DATABASE_URL` salah / rules blokir | Cek `.env.local` dan security rules |

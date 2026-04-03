# 📗 Backend Implementation Notes — Smart Price Tag System

> **Untuk:** Programmer junior yang akan mengimplementasikan firmware ESP32  
> **Stack:** ESP32 · Arduino Framework · Firebase RTDB (ESP32 Library) · MFRC522 (RC522 RFID) · LCD I2C

> 📐 **Lihat `skema.md`** untuk diagram wiring lengkap, layout breadboard, dan checklist perakitan hardware.

---

## 🧠 Gambaran Besar Sistem

```
[Web Dashboard] ──── Firebase RTDB ──── [ESP32]
     ↕                    ↕                ↕
  Admin ubah           Database        Baca/tulis
  produk & harga      realtime         data, scan RFID
```

ESP32 **tidak komunikasi langsung** dengan web. Semua lewat Firebase RTDB sebagai "perantara". ESP32 membaca data dari RTDB, dan web membaca/menulis data yang sama.

---

## 📦 Library yang Dibutuhkan (Arduino / PlatformIO)

Install via Library Manager Arduino IDE atau `platformio.ini`:

| Library | Fungsi |
|---------|--------|
| `Firebase ESP32 Client` by Mobizt | Koneksi ke Firebase RTDB |
| `MFRC522` by GithubCommunity | Baca RFID tag RC522 |
| `LiquidCrystal_I2C` | Kontrol LCD I2C (16x2) |
| `WiFi.h` | Sudah built-in di ESP32 |
| `Preferences.h` | Simpan data ke flash (offline cache) |

**PlatformIO `platformio.ini`:**
```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps =
  mobizt/Firebase ESP32 Client@^4.4.17
  miguelbalboa/MFRC522@^1.4.11
  marcoschwartz/LiquidCrystal_I2C@^1.1.4
```

---

## 🔧 Konfigurasi Awal (Wajib Diisi)

Buat file `config.h` dan isi dengan data Firebase kamu:

```cpp
// config.h — JANGAN commit file ini ke git publik!

#ifndef CONFIG_H
#define CONFIG_H

// WiFi
#define WIFI_SSID     "nama_wifi_kamu"
#define WIFI_PASSWORD "password_wifi_kamu"

// Firebase
// Ambil dari Firebase Console → Project Settings → Service Accounts
#define FIREBASE_HOST "smart-price-tag-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_AUTH "DATABASE_SECRET_KAMU" // Legacy secret atau ID Token

// Pin RFID RC522 (SPI)
#define RFID_SS_PIN   5   // SS / SDA
#define RFID_RST_PIN  27  // RST  ← GPIO 27 (bukan 22! GPIO 22 dipakai SCL LCD)

// Pin LCD I2C (GPIO 21=SDA, GPIO 22=SCL — default ESP32 I2C)
#define LCD_ADDRESS   0x27  // Coba 0x3F jika LCD tidak muncul
#define LCD_COLS      16
#define LCD_ROWS      2

// Pin LED & Buzzer
// LED dihubungkan via resistor 220Ω ke GPIO → resistor → anoda(+) LED → katoda(-) → GND
#define LED_GREEN_PIN 2
#define LED_RED_PIN   4
#define BUZZER_PIN    15  // Buzzer AKTIF (bukan pasif)

#endif
```

> ⚠️ **Penting:** `FIREBASE_AUTH` isi dengan **Database Secret** dari Firebase Console → Project Settings → Service Accounts → Database Secrets. Ini berbeda dengan API Key web!

---

## 🏗️ Struktur Kode ESP32

Pisahkan kode ke beberapa file agar mudah dipelihara:

```
firmware/
  main.ino (atau main.cpp)   ← setup() dan loop() utama
  config.h                   ← Konfigurasi WiFi & Firebase
  firebase_helper.h/.cpp     ← Fungsi baca/tulis Firebase
  rfid_handler.h/.cpp        ← Fungsi scan RFID
  lcd_handler.h/.cpp         ← Fungsi tampilkan LCD
  buzzer_led.h/.cpp          ← Fungsi buzzer dan LED
```

---

## 🔌 Wiring / Koneksi Hardware

### RFID RC522 → ESP32 (SPI)
| RC522 Pin | ESP32 Pin | Catatan |
|-----------|-----------|--------|
| SDA (SS)  | GPIO 5    | Chip Select |
| SCK       | GPIO 18   | SPI Clock |
| MOSI      | GPIO 23   | Data ESP→RFID |
| MISO      | GPIO 19   | Data RFID→ESP |
| RST       | **GPIO 27** | Reset — **bukan GPIO 22!** (GPIO 22 dipakai SCL LCD) |
| 3.3V      | 3.3V      | ⚠️ Jangan pakai 5V, bisa rusak! |
| GND       | GND       | |

### LCD I2C → ESP32
| LCD Pin | ESP32 Pin | Catatan |
|---------|-----------|---------|
| SDA     | GPIO 21   | I2C Data (default ESP32) |
| SCL     | GPIO 22   | I2C Clock (default ESP32) |
| VCC     | 5V (VIN)  | LCD butuh 5V |
| GND     | GND       | |

> ⚠️ LCD I2C biasanya pakai alamat `0x27` atau `0x3F`. Jalankan I2C Scanner sketch untuk cek.

### LED + Resistor 220Ω → ESP32
| Komponen | Wiring |
|----------|--------|
| LED Hijau | GPIO 2 → **[220Ω]** → Anoda(+) LED → Katoda(−) → GND |
| LED Merah | GPIO 4 → **[220Ω]** → Anoda(+) LED → Katoda(−) → GND |

> ⚠️ **Resistor 220Ω wajib dipasang!** Tanpa resistor, LED akan terbakar karena arus terlalu besar.  
> Kaki LED yang **panjang** = Anoda (+), kaki **pendek** = Katoda (−).

### Buzzer Aktif → ESP32
| Buzzer Pin | ESP32 Pin |
|------------|-----------|
| (+) | GPIO 15 |
| (−) | GND |

---

## 📡 Cara Kerja Firebase ESP32

### Setup Koneksi

```cpp
#include <Firebase_ESP_Client.h>
#include "config.h"

FirebaseData fbdo;      // Objek untuk read/write
FirebaseAuth auth;
FirebaseConfig config;

void setupFirebase() {
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}
```

### Membaca Data dari RTDB

```cpp
// Baca string dari path tertentu
String getStringValue(const char* path) {
  if (Firebase.RTDB.getString(&fbdo, path)) {
    return fbdo.stringData();
  }
  Serial.println("Read failed: " + fbdo.errorReason());
  return "";
}

// Contoh penggunaan:
// String mode = getStringValue("/device_state/mode");
```

### Menulis Data ke RTDB

```cpp
// Tulis string
void setStringValue(const char* path, const char* value) {
  if (!Firebase.RTDB.setString(&fbdo, path, value)) {
    Serial.println("Write failed: " + fbdo.errorReason());
  }
}

// Tulis integer
void setIntValue(const char* path, int value) {
  if (!Firebase.RTDB.setInt(&fbdo, path, value)) {
    Serial.println("Write failed: " + fbdo.errorReason());
  }
}

// Tulis timestamp sekarang (Unix seconds)
void writeTimestampNow(const char* path) {
  time_t now;
  time(&now);
  setIntValue(path, (int)now);
}
```

---

## 🔄 Alur Program Utama (`loop()`)

```cpp
void loop() {
  // 1. Kirim heartbeat ke Firebase setiap 30 detik
  sendHeartbeat();

  // 2. Baca mode dari Firebase
  String mode = getStringValue("/device_state/mode");

  if (mode == "register") {
    // 3A. Mode registrasi: tunggu scan tag baru
    handleRegisterMode();
  } else {
    // 3B. Mode standby: scan tag untuk tampilkan produk
    handleStandbyMode();
  }
}
```

---

## 💓 Heartbeat (Penting!)

Web dashboard menentukan ESP32 "online" atau "offline" berdasarkan `last_heartbeat`. **Wajib** kirim heartbeat setiap 30 detik:

```cpp
unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 30000; // 30 detik

void sendHeartbeat() {
  if (millis() - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    // Tulis Unix timestamp sekarang
    // Perlu sync waktu dulu via NTP
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
      time_t now;
      time(&now);
      Firebase.RTDB.setInt(&fbdo, "/device_state/last_heartbeat", (int)now);
      Firebase.RTDB.setBool(&fbdo, "/device_state/online", true);
    }
    lastHeartbeat = millis();
  }
}
```

**Setup NTP (sync waktu internet) di `setup()`:**
```cpp
configTime(7 * 3600, 0, "pool.ntp.org"); // GMT+7 (WIB)
```

---

## 📖 Mode Standby — Scan Tag di Kasir

Ini adalah mode operasional normal. Setiap kali tag di-scan:

```
1. Baca UID dari RC522
2. Baca data tag dari /tags/{UID} di Firebase
3. Cek is_active:
   - true  → Tampilkan nama & harga di LCD, buzzer 200ms, LED hijau
             → Tulis scan_log ke /scan_logs (push)
             → Set is_active = false (tandai sudah terjual)
   - false → LCD "Tag Inactive / Sold", buzzer 2x, LED merah
4. Jika UID tidak ada di /tags → LCD "Unknown Tag", buzzer 3x cepat
```

```cpp
void handleStandbyMode() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  // Ambil UID sebagai string hex
  String uid = getUIDString(rfid.uid.uidByte, rfid.uid.size);
  String path = "/tags/" + uid;

  // Baca data tag
  if (Firebase.RTDB.get(&fbdo, path.c_str())) {
    // Data ada
    String productName = fbdo.to<FirebaseJson>()... // parse JSON
    int price = ...;
    bool isActive = ...;

    if (isActive) {
      displayOnLCD(productName, "Rp " + formatPrice(price));
      buzzerBeep(200);    // 1x buzzer 200ms
      ledGreen();
      writeScanLog(uid, productName, price);
      Firebase.RTDB.setBool(&fbdo, (path + "/is_active").c_str(), false);
    } else {
      displayOnLCD("Tag Inactive", "Sold");
      buzzerBeep(100); delay(100); buzzerBeep(100); // 2x pendek
      ledRed();
    }
  } else {
    // UID tidak dikenal
    displayOnLCD("Unknown Tag", uid.c_str());
    for (int i = 0; i < 3; i++) { buzzerBeep(50); delay(50); } // 3x cepat
  }

  rfid.PICC_HaltA();
}
```

### Menulis Scan Log ke Firebase

Firebase RTDB punya fungsi **push** yang auto-generate key unik (seperti `-NxABCD1234`):

```cpp
void writeScanLog(String uid, String productName, int price) {
  FirebaseJson logEntry;
  time_t now; time(&now);

  logEntry.set("tag_uid", uid);
  logEntry.set("alias", getTagAlias(uid));    // Baca alias dari /tags/{uid}/alias
  logEntry.set("product_name", productName);
  logEntry.set("price", price);
  logEntry.set("timestamp", (int)now);

  // pushJSON otomatis buat key unik
  Firebase.RTDB.pushJSON(&fbdo, "/scan_logs", &logEntry);
}
```

---

## 📝 Mode Register — Daftarkan Tag Baru

Mode ini diaktifkan oleh web dashboard. ESP32 hanya perlu:
1. Deteksi mode berubah jadi `"register"`
2. Scan tag RFID baru
3. Tulis UID yang di-scan ke `/device_state/pending_uid`
4. Tunggu web selesai simpan data, mode akan kembali ke `"standby"`

```cpp
void handleRegisterMode() {
  displayOnLCD("Register Mode", "Scan tag...");

  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  String uid = getUIDString(rfid.uid.uidByte, rfid.uid.size);

  // Tulis UID ke pending_uid — web akan ambil ini
  Firebase.RTDB.setString(&fbdo, "/device_state/pending_uid", uid.c_str());

  displayOnLCD("UID Detected:", uid.c_str());
  buzzerBeep(500); // 1x panjang → tanda berhasil scan

  rfid.PICC_HaltA();

  // Tunggu web hapus pending_uid (artinya tag sudah tersimpan)
  // Loop sampai pending_uid jadi null atau mode kembali ke standby
  while (true) {
    delay(1000);
    String mode = getStringValue("/device_state/mode");
    if (mode == "standby") break; // Web sudah selesai
  }
}
```

---

## 💾 Offline Cache (Fitur Tambahan)

Kalau WiFi putus, ESP32 harus tetap bisa tampilkan info produk dari data terakhir yang di-cache. Gunakan `Preferences` library:

```cpp
#include <Preferences.h>
Preferences prefs;

// Simpan data tag ke flash
void cacheTagData(String uid, String productName, int price) {
  prefs.begin("tags", false);
  prefs.putString((uid + "_name").c_str(), productName);
  prefs.putInt((uid + "_price").c_str(), price);
  prefs.end();
}

// Baca data tag dari cache
String getCachedProductName(String uid) {
  prefs.begin("tags", true); // read-only
  String name = prefs.getString((uid + "_name").c_str(), "Unknown");
  prefs.end();
  return name;
}
```

**Gunakan cache saat Firebase tidak bisa diakses:**
```cpp
if (Firebase.RTDB.get(&fbdo, path.c_str())) {
  // Firebase berhasil → tampilkan data + update cache
  cacheTagData(uid, productName, price);
} else {
  // Firebase gagal → tampilkan dari cache
  String cachedName = getCachedProductName(uid);
  displayOnLCD(cachedName, "(Cached)");
}
```

---

## ⚠️ Hal-Hal yang Sering Salah (Common Pitfalls)

| Kesalahan | Cara Benar |
|-----------|------------|
| `fbdo` dipakai bersamaan untuk read & write sekaligus | Gunakan **satu `fbdo` per operasi** secara bergantian, atau buat 2 objek `FirebaseData` |
| Firebase operasi di dalam interrupt | Firebase tidak boleh dipanggil dari ISR. Pakai flag boolean, handle di `loop()` |
| Tidak sync waktu NTP → timestamp salah | Selalu `configTime()` di `setup()` dan tunggu sync berhasil |
| `delay()` terlalu lama → heartbeat terlambat | Pakai `millis()` untuk timing, hindari `delay()` besar |
| UID dibaca berbeda tiap scan | UID RC522 bisa 4 atau 7 byte — pastikan format hex konsisten (uppercase, no space) |
| WiFi putus tidak di-handle | Cek `WiFi.status() != WL_CONNECTED` dan reconnect di awal `loop()` |

---

## 🧪 Cara Test Tanpa Hardware Lengkap

**Test Firebase tanpa RFID:**
```cpp
// Di setup(), simulate scan dengan UID hardcoded:
String testUID = "E2801108";
handleTagScan(testUID); // Panggil langsung fungsi handler
```

**Cek koneksi Firebase:**
```cpp
if (Firebase.ready()) {
  Serial.println("Firebase OK!");
} else {
  Serial.println("Firebase GAGAL: " + String(fbdo.errorReason().c_str()));
}
```

**Monitor Serial untuk debugging:**
```cpp
Serial.begin(115200);
// Semua error Firebase print via Serial.println(fbdo.errorReason())
```

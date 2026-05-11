# 🔧 Panduan Update Firmware ESP32 — v2.0 (Kiosk & Cart)

> **Untuk:** Junior programmer yang sudah berhasil menjalankan firmware v1.0  
> **Durasi:** ~1–2 jam  
> **Prasyarat:** ESP32 sudah bisa scan RFID + tulis ke Firebase (versi 1.0 berjalan)

---

## 📌 Apa yang Berubah di Firmware?

Di versi 1.0, saat tag RFID di-scan (mode standby), ESP32 melakukan:
1. Baca data tag dari `/tags/{UID}`
2. Tampilkan di LCD
3. Tulis scan log ke `/scan_logs`
4. Set `is_active = false`

Di versi 2.0, **ada 3 perubahan besar:**

| No | Perubahan | Deskripsi |
|----|-----------|-----------|
| 1 | **Push item ke cart** | Saat scan berhasil, ESP32 juga menulis item ke `/cart/items/{UID}` |
| 2 | **Cek duplikat di cart** | Sebelum proses scan, cek apakah item sudah ada di keranjang |
| 3 | **Listen cart status** | ESP32 memantau `/cart/status` — reset LCD saat checkout selesai |

**Yang TIDAK berubah:**
- Setup WiFi, Firebase, NTP — tetap sama
- Mode Register — tetap sama
- Heartbeat — tetap sama
- Fungsi `writeScanLog()` — tetap sama
- Offline cache — tetap sama

---

## 📋 Urutan Pengerjaan

---

### LANGKAH 1: Backup Firmware Lama

Sebelum mengubah apapun, **simpan salinan firmware yang sudah berjalan**:

```
1. Buka folder firmware project kamu
2. Copy file main.ino (atau main.cpp)
3. Rename jadi main_v1_backup.ino
4. Simpan di tempat yang aman
```

> ⚠️ Ini penting! Kalau update gagal, kamu bisa kembali ke versi lama.

---

### LANGKAH 2: Tambah Variabel Global Baru

Buka file utama firmware (`main.ino` atau `main.cpp`).

**Tambahkan variabel global berikut** di bagian atas file (setelah deklarasi `fbdo`, `auth`, `config`):

```cpp
// ============================================
// UPDATE v2.0 — Cart tracking
// ============================================

// Menyimpan status cart terakhir untuk deteksi perubahan
String lastCartStatus = "";

// FirebaseData kedua — khusus untuk operasi cart
// Mencegah konflik dengan fbdo utama
FirebaseData fbdoCart;
```

**Kenapa butuh `fbdoCart` terpisah?**

> Object `FirebaseData` (`fbdo`) menyimpan response terakhir dari Firebase. Kalau kamu pakai satu `fbdo` untuk baca tag DAN tulis cart secara bergantian, datanya bisa tertimpa.  
> Dengan 2 objek terpisah (`fbdo` untuk tag/scan_logs, `fbdoCart` untuk cart), operasi jadi lebih aman.

---

### LANGKAH 3: Buat Fungsi `pushToCart()`

**Tambahkan fungsi BARU** ini di file firmware kamu. Tempatkan **setelah** fungsi `writeScanLog()`:

```cpp
/**
 * v2.0: Push item yang baru di-scan ke keranjang kiosk
 * 
 * Path Firebase: /cart/items/{uid}
 * Menggunakan UID sebagai key agar tidak ada duplikat
 * 
 * @param uid          UID tag RFID (hex string)
 * @param alias        Alias tag, e.g. "Tag-01"
 * @param productName  Nama produk
 * @param price        Harga dalam Rupiah (integer)
 */
void pushToCart(String uid, String alias, String productName, int price) {
  // Buat JSON object untuk item cart
  FirebaseJson cartItem;
  time_t now;
  time(&now);

  cartItem.set("alias", alias);
  cartItem.set("product_name", productName);
  cartItem.set("price", price);
  cartItem.set("scanned_at", (int)now);

  // Tulis ke /cart/items/{uid}
  // Karena key = UID, item yang sama tidak bisa masuk dua kali
  String cartItemPath = "/cart/items/" + uid;
  if (Firebase.RTDB.setJSON(&fbdoCart, cartItemPath.c_str(), &cartItem)) {
    Serial.println("[CART] Item pushed: " + productName);
  } else {
    Serial.println("[CART] Push FAILED: " + fbdoCart.errorReason());
  }

  // Update status cart jadi "active"
  Firebase.RTDB.setString(&fbdoCart, "/cart/status", "active");
  
  // Update last_updated timestamp
  Firebase.RTDB.setInt(&fbdoCart, "/cart/last_updated", (int)now);
}
```

**Penjelasan baris per baris:**

| Baris | Penjelasan |
|-------|-----------|
| `FirebaseJson cartItem;` | Buat object JSON baru untuk disimpan ke Firebase |
| `cartItem.set("alias", alias);` | Masukkan data alias, product_name, price, scanned_at |
| `"/cart/items/" + uid` | Path penyimpanan. Pakai UID sebagai key → otomatis no duplikat |
| `Firebase.RTDB.setJSON(...)` | Tulis JSON ke Firebase. Return `true` kalau berhasil |
| `"/cart/status", "active"` | Ubah status cart jadi "active" (ada item) |
| `"/cart/last_updated"` | Catat waktu terakhir cart diupdate |

---

### LANGKAH 4: Buat Fungsi `isItemInCart()`

**Tambahkan fungsi BARU** ini untuk mengecek apakah item sudah ada di cart:

```cpp
/**
 * v2.0: Cek apakah UID sudah ada di keranjang
 * 
 * @param uid  UID tag RFID
 * @return     true jika item sudah ada di cart, false jika belum
 */
bool isItemInCart(String uid) {
  String cartCheckPath = "/cart/items/" + uid;
  
  if (Firebase.RTDB.get(&fbdoCart, cartCheckPath.c_str())) {
    // Jika Firebase mengembalikan data (bukan null) → item ada di cart
    if (fbdoCart.dataType() != "null" && fbdoCart.dataType() != "") {
      Serial.println("[CART] Item " + uid + " sudah ada di cart");
      return true;
    }
  }
  // Jika Firebase error atau data null → anggap item belum di cart
  return false;
}
```

**Kenapa perlu cek ini?**

> Di update.md (PRD v2.0), ada skenario baru:  
> *"Scan, `is_active: true`, item sudah di cart → LCD tampilkan `Sudah di keranjang!`, Buzzer 2x pendek"*
>
> Tanpa pengecekan ini, item yang dibeli customer bisa masuk cart berkali-kali jika admin sudah re-activate tag tersebut, maka tag `is_active` kembali `true`, tapi item masih di cart customer.

---

### LANGKAH 5: Update Fungsi `handleStandbyMode()` — INI YANG PALING PENTING

Ini adalah perubahan **inti** dari update v2.0. Kamu perlu menambahkan logika pengecekan cart dan push ke cart di dalam fungsi `handleStandbyMode()`.

**⚡ Perubahan ditandai dengan komentar `// [v2.0]`**

**Ganti fungsi `handleStandbyMode()` kamu dengan versi berikut:**

```cpp
void handleStandbyMode() {
  // Cek apakah ada kartu RFID baru
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  // Ambil UID sebagai string hex (uppercase, tanpa spasi)
  String uid = getUIDString(rfid.uid.uidByte, rfid.uid.size);
  String tagPath = "/tags/" + uid;

  Serial.println("[SCAN] UID detected: " + uid);

  // Baca data tag dari Firebase
  if (Firebase.RTDB.get(&fbdo, tagPath.c_str())) {
    
    // ✅ Tag ditemukan di database
    FirebaseJson &json = fbdo.jsonObject();
    FirebaseJsonData jsonData;

    // Parse field dari JSON
    String productName = "";
    String alias = "";
    int price = 0;
    bool isActive = false;

    json.get(jsonData, "product_name");
    if (jsonData.success) productName = jsonData.stringValue;

    json.get(jsonData, "alias");
    if (jsonData.success) alias = jsonData.stringValue;

    json.get(jsonData, "price");
    if (jsonData.success) price = jsonData.intValue;

    json.get(jsonData, "is_active");
    if (jsonData.success) isActive = jsonData.boolValue;

    // ---- Logika scan berdasarkan kondisi ----

    if (isActive) {
      // [v2.0] CEK DUPLIKAT DI CART DULU!
      // Skenario: admin sudah re-activate tag, tapi item masih di cart customer
      if (isItemInCart(uid)) {
        // ❌ Item sudah di keranjang — jangan proses lagi
        displayOnLCD("Sudah di", "keranjang!");
        buzzerBeep(100);
        delay(100);
        buzzerBeep(100);  // 2x pendek
        Serial.println("[SCAN] Item already in cart, skipping");

      } else {
        // ✅ Item belum di cart — proses normal + push ke cart

        // 1. Tampilkan di LCD
        displayOnLCD(productName, "Rp " + formatPrice(price));
        
        // 2. Feedback: buzzer 1x 200ms + LED hijau
        buzzerBeep(200);
        ledGreen();
        
        // 3. Tulis scan log ke /scan_logs (sama seperti v1.0)
        writeScanLog(uid, productName, price);
        
        // 4. Set is_active = false (sudah terjual)
        Firebase.RTDB.setBool(&fbdo, (tagPath + "/is_active").c_str(), false);
        
        // 5. Update scan_count (increment +1)
        // Baca dulu scan_count saat ini
        int currentScanCount = 0;
        if (Firebase.RTDB.getInt(&fbdo, (tagPath + "/scan_count").c_str())) {
          currentScanCount = fbdo.intData();
        }
        Firebase.RTDB.setInt(&fbdo, (tagPath + "/scan_count").c_str(), currentScanCount + 1);
        
        // 6. Update last_scanned_at
        time_t now;
        time(&now);
        Firebase.RTDB.setInt(&fbdo, (tagPath + "/last_scanned_at").c_str(), (int)now);

        // 7. [v2.0] PUSH ITEM KE CART KIOSK
        pushToCart(uid, alias, productName, price);

        Serial.println("[SCAN] Success! Product: " + productName + " | Price: " + String(price));
      }

    } else {
      // ❌ Tag tidak aktif (sudah terjual)
      displayOnLCD("Tag Inactive", "Sold");
      buzzerBeep(100);
      delay(100);
      buzzerBeep(100);  // 2x pendek
      ledRed();
      Serial.println("[SCAN] Tag inactive: " + uid);
    }

  } else {
    // ❌ UID tidak ditemukan di database
    displayOnLCD("Unknown Tag", uid.c_str());
    for (int i = 0; i < 3; i++) {
      buzzerBeep(50);
      delay(50);
    }  // 3x cepat
    Serial.println("[SCAN] Unknown tag: " + uid);
  }

  // Halt card agar tidak terbaca berulang
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}
```

**Ringkasan apa yang berubah dari v1.0:**

| Langkah | v1.0 | v2.0 |
|---------|------|------|
| Cek cart sebelum proses | ❌ Tidak ada | ✅ `isItemInCart(uid)` |
| Response "Sudah di keranjang!" | ❌ Tidak ada | ✅ LCD + 2x buzzer |
| Push ke cart | ❌ Tidak ada | ✅ `pushToCart(...)` setelah scan berhasil |
| Update scan_count | ⚠️ Mungkin belum | ✅ Increment +1 |
| Update last_scanned_at | ⚠️ Mungkin belum | ✅ Tulis timestamp |

---

### LANGKAH 6: Buat Fungsi `checkCartReset()`

Fungsi ini memantau status cart. Saat customer selesai checkout dari kiosk, web akan mengubah `/cart/status` dari `"active"` menjadi `"idle"`. ESP32 mendeteksi ini dan reset LCD.

**Tambahkan fungsi BARU:**

```cpp
/**
 * v2.0: Pantau perubahan status cart
 * 
 * Jika status berubah dari "active" ke "idle" (checkout selesai),
 * reset tampilan LCD ke "Ready!"
 * 
 * Dipanggil di loop() setiap iterasi
 */
void checkCartReset() {
  // Baca status cart dari Firebase
  if (Firebase.RTDB.getString(&fbdoCart, "/cart/status")) {
    String currentStatus = fbdoCart.stringData();

    // Deteksi transisi: active → idle (checkout baru terjadi)
    if (lastCartStatus == "active" && currentStatus == "idle") {
      Serial.println("[CART] Checkout detected! Resetting LCD...");

      // Reset LCD
      displayOnLCD("Ready!", "Scan barang...");
      
      // Feedback: LED hijau + buzzer panjang sebagai tanda checkout berhasil
      ledGreen();
      buzzerBeep(500);  // 1x panjang

      // Update LCD line di Firebase juga
      Firebase.RTDB.setString(&fbdo, "/device_state/lcd_line1", "Ready!");
      Firebase.RTDB.setString(&fbdo, "/device_state/lcd_line2", "Scan barang...");
    }

    // Update tracking variable
    lastCartStatus = currentStatus;
  }
}
```

**Kenapa penting?**

> Tanpa ini, setelah customer checkout, LCD ESP32 masih menampilkan produk terakhir yang di-scan.  
> Dengan `checkCartReset()`, LCD otomatis kembali ke "Ready!" setelah keranjang dikosongkan oleh kiosk.

---

### LANGKAH 7: Update Fungsi `loop()` Utama

**Tambahkan pemanggilan `checkCartReset()`** di dalam `loop()`:

**SEBELUM (v1.0):**
```cpp
void loop() {
  // 1. Kirim heartbeat
  sendHeartbeat();

  // 2. Cek koneksi WiFi
  if (WiFi.status() != WL_CONNECTED) {
    reconnectWiFi();
    return;
  }

  // 3. Baca mode
  String mode = getStringValue("/device_state/mode");

  if (mode == "register") {
    handleRegisterMode();
  } else {
    handleStandbyMode();
  }
}
```

**SESUDAH (v2.0):**
```cpp
void loop() {
  // 1. Kirim heartbeat
  sendHeartbeat();

  // 2. Cek koneksi WiFi
  if (WiFi.status() != WL_CONNECTED) {
    reconnectWiFi();
    return;
  }

  // 3. [v2.0] Pantau status cart untuk reset LCD setelah checkout
  checkCartReset();

  // 4. Baca mode
  String mode = getStringValue("/device_state/mode");

  if (mode == "register") {
    handleRegisterMode();
  } else {
    handleStandbyMode();
  }
}
```

> ⚠️ **Posisi `checkCartReset()` harus SEBELUM `handleStandbyMode()`**  
> Agar deteksi checkout terjadi di awal setiap iterasi loop, sebelum proses scan baru.

---

### LANGKAH 8: Update `setup()` — Inisialisasi fbdoCart

Tidak banyak yang berubah di `setup()`, cukup pastikan `fbdoCart` siap dipakai.

**Tambahkan baris berikut** di akhir fungsi `setup()`, setelah `Firebase.begin(...)`:

```cpp
void setup() {
  Serial.begin(115200);
  
  // ... existing setup code (WiFi, NTP, Firebase, RFID, LCD, LED, Buzzer) ...

  // Setup Firebase
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // [v2.0] Inisialisasi cart status tracking
  // Baca status cart saat startup agar tracking benar
  if (Firebase.RTDB.getString(&fbdoCart, "/cart/status")) {
    lastCartStatus = fbdoCart.stringData();
    Serial.println("[CART] Initial status: " + lastCartStatus);
  } else {
    lastCartStatus = "idle";
    Serial.println("[CART] Could not read initial status, defaulting to 'idle'");
  }

  // Tampilkan LCD awal
  displayOnLCD("Ready!", "Scan barang...");
  Serial.println("=== Smart Price Tag v2.0 Ready ===");
}
```

---

## 📐 LANGKAH 9: Cek Ulang Fungsi Helper yang Dibutuhkan

Pastikan kamu sudah punya fungsi-fungsi helper ini dari versi 1.0. Jika belum, tambahkan:

### a) `getUIDString()` — Konversi UID byte ke hex string

```cpp
/**
 * Konversi UID dari byte array ke hex string (uppercase)
 * Contoh: {0xE2, 0x80, 0x11, 0x08} → "E2801108"
 */
String getUIDString(byte *buffer, byte bufferSize) {
  String uid = "";
  for (byte i = 0; i < bufferSize; i++) {
    if (buffer[i] < 0x10) uid += "0";  // Padding nol di depan
    uid += String(buffer[i], HEX);
  }
  uid.toUpperCase();  // Konsisten uppercase
  return uid;
}
```

> ⚠️ **PENTING:** UID **harus selalu uppercase** dan **tanpa spasi/separator**.  
> Contoh benar: `"E2801108"` | Contoh salah: `"e2 80 11 08"` atau `"E2:80:11:08"`

### b) `formatPrice()` — Format harga dengan titik ribuan

```cpp
/**
 * Format harga integer ke string dengan titik ribuan
 * Contoh: 199000 → "199.000"
 */
String formatPrice(int price) {
  String priceStr = String(price);
  String formatted = "";
  int count = 0;
  
  for (int i = priceStr.length() - 1; i >= 0; i--) {
    formatted = priceStr[i] + formatted;
    count++;
    if (count % 3 == 0 && i > 0) {
      formatted = "." + formatted;
    }
  }
  return formatted;
}
```

### c) `displayOnLCD()` — Tampilkan 2 baris di LCD

```cpp
/**
 * Tampilkan 2 baris teks di LCD 16x2
 * Otomatis potong teks yang lebih dari 16 karakter
 */
void displayOnLCD(String line1, String line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1.substring(0, LCD_COLS));  // Max 16 char
  lcd.setCursor(0, 1);
  lcd.print(line2.substring(0, LCD_COLS));

  // Update Firebase agar web dashboard bisa lihat LCD
  Firebase.RTDB.setString(&fbdo, "/device_state/lcd_line1", line1.c_str());
  Firebase.RTDB.setString(&fbdo, "/device_state/lcd_line2", line2.c_str());
}
```

### d) `buzzerBeep()` dan LED functions

```cpp
/**
 * Bunyikan buzzer selama durasi tertentu (ms)
 */
void buzzerBeep(int durationMs) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(durationMs);
  digitalWrite(BUZZER_PIN, LOW);
}

/**
 * Nyalakan LED hijau, matikan LED merah
 */
void ledGreen() {
  digitalWrite(LED_GREEN_PIN, HIGH);
  digitalWrite(LED_RED_PIN, LOW);
}

/**
 * Nyalakan LED merah, matikan LED hijau
 */
void ledRed() {
  digitalWrite(LED_GREEN_PIN, LOW);
  digitalWrite(LED_RED_PIN, HIGH);
}

/**
 * Matikan semua LED
 */
void ledOff() {
  digitalWrite(LED_GREEN_PIN, LOW);
  digitalWrite(LED_RED_PIN, LOW);
}
```

### e) `getTagAlias()` — Baca alias dari Firebase

```cpp
/**
 * Baca alias tag dari Firebase (misal "Tag-01")
 * Dipakai untuk writeScanLog()
 */
String getTagAlias(String uid) {
  String path = "/tags/" + uid + "/alias";
  if (Firebase.RTDB.getString(&fbdo, path.c_str())) {
    return fbdo.stringData();
  }
  return "Unknown";
}
```

---

## 🧪 LANGKAH 10: Upload & Testing

### A. Upload Firmware

1. Hubungkan ESP32 ke komputer via USB
2. Buka Arduino IDE / PlatformIO
3. Pilih board **ESP32 Dev Module**
4. Pilih port COM yang benar
5. Klik **Upload** (atau `Ctrl+U`)
6. Buka **Serial Monitor** (baud rate: `115200`)

### B. Cek Serial Monitor

Setelah upload, Serial Monitor harus menampilkan:

```
Connecting to WiFi...
WiFi connected! IP: 192.168.x.x
NTP time synced
Firebase connected!
[CART] Initial status: idle
=== Smart Price Tag v2.0 Ready ===
```

> ❌ Jika muncul `Firebase GAGAL` → cek `FIREBASE_HOST` dan `FIREBASE_AUTH` di `config.h`  
> ❌ Jika WiFi tidak connect → cek `WIFI_SSID` dan `WIFI_PASSWORD`

### C. Test Skenario Satu-Per-Satu

**Test 1: Scan tag aktif** (`is_active: true`)

| Langkah | Yang Dilakukan | Yang Diharapkan |
|---------|----------------|-----------------|
| 1 | Scan tag RFID | Serial: `[SCAN] UID detected: E2801108` |
| 2 | | LCD: `Kemeja Flanel` / `Rp 199.000` |
| 3 | | Buzzer: 1x 200ms, LED: hijau |
| 4 | | Serial: `[CART] Item pushed: Kemeja Flanel` |
| 5 | | Serial: `[SCAN] Success! Product: Kemeja Flanel | Price: 199000` |
| 6 | Cek Firebase Console | `/cart/items/E2801108` ada data baru |
| 7 | Cek Firebase Console | `/cart/status` = `"active"` |
| 8 | Cek Firebase Console | `/tags/E2801108/is_active` = `false` |
| 9 | Buka halaman kiosk web | Item muncul di keranjang |

**Test 2: Scan tag yang sudah di cart**

| Langkah | Yang Dilakukan | Yang Diharapkan |
|---------|----------------|-----------------|
| 1 | Dari admin dashboard, set `is_active` = true kembali | Tag aktif lagi tapi masih di cart |
| 2 | Scan tag yang sama lagi | Serial: `[CART] Item E2801108 sudah ada di cart` |
| 3 | | LCD: `Sudah di` / `keranjang!` |
| 4 | | Buzzer: 2x pendek |
| 5 | | **TIDAK** ada entry baru di `/scan_logs` |
| 6 | | **TIDAK** ada duplikat di `/cart/items` |

**Test 3: Cart reset setelah checkout**

| Langkah | Yang Dilakukan | Yang Diharapkan |
|---------|----------------|-----------------|
| 1 | Buka halaman kiosk web | Klik "Selesai & Order" → "Konfirmasi" |
| 2 | | `/cart/status` berubah jadi `"idle"` |
| 3 | | `/cart/items` kosong |
| 4 | Lihat ESP32 | Serial: `[CART] Checkout detected! Resetting LCD...` |
| 5 | | LCD: `Ready!` / `Scan barang...` |
| 6 | | Buzzer: 1x panjang 500ms |

**Test 4: Scan tag tidak aktif** (`is_active: false`)

| Langkah | Yang Dilakukan | Yang Diharapkan |
|---------|----------------|-----------------|
| 1 | Scan tag yang `is_active` = false | LCD: `Tag Inactive` / `Sold` |
| 2 | | Buzzer: 2x pendek, LED: merah |
| 3 | | Tidak ada perubahan di cart/scan_logs |

**Test 5: Scan tag yang tidak terdaftar**

| Langkah | Yang Dilakukan | Yang Diharapkan |
|---------|----------------|-----------------|
| 1 | Scan tag RFID yang belum didaftarkan | LCD: `Unknown Tag` / `{UID}` |
| 2 | | Buzzer: 3x cepat |
| 3 | | Tidak ada perubahan di Firebase |

---

## ⚠️ Troubleshooting Firmware v2.0

| Gejala | Kemungkinan Penyebab | Solusi |
|--------|----------------------|--------|
| `[CART] Push FAILED` di Serial | Firebase rules belum diupdate | Pastikan `/cart` punya `.write: true` di Security Rules |
| Item masuk cart dua kali | `isItemInCart()` return false padahal ada | Cek format UID — harus uppercase konsisten |
| LCD tidak reset setelah checkout | `checkCartReset()` tidak dipanggil | Pastikan `checkCartReset()` ada di `loop()` sebelum `handleStandbyMode()` |
| `lastCartStatus` selalu kosong | `fbdoCart` belum diinisialisasi | Pastikan `Firebase.begin()` sudah dipanggil sebelum baca `/cart/status` |
| Heartbeat terlambat / ESP32 offline di dashboard | `checkCartReset()` atau `isItemInCart()` terlalu lambat | Kurangi frekuensi cek cart (gunakan interval `millis()`) |
| Compile error: `fbdoCart not declared` | Lupa deklarasi variabel global | Tambahkan `FirebaseData fbdoCart;` di bagian atas file |
| Crash / restart loop | Stack overflow dari Firebase calls | Tambahkan delay kecil antara Firebase calls: `delay(50)` |

---

## 🚀 Optimasi (Opsional tapi Direkomendasikan)

### A. Rate Limiting untuk Cart Check

`isItemInCart()` dan `checkCartReset()` membaca Firebase setiap iterasi `loop()` — ini bisa jadi terlalu sering. Tambahkan interval:

```cpp
unsigned long lastCartCheck = 0;
const unsigned long CART_CHECK_INTERVAL = 2000; // Cek tiap 2 detik

void loop() {
  sendHeartbeat();

  if (WiFi.status() != WL_CONNECTED) {
    reconnectWiFi();
    return;
  }

  // [v2.0] Rate-limited cart check
  if (millis() - lastCartCheck >= CART_CHECK_INTERVAL) {
    checkCartReset();
    lastCartCheck = millis();
  }

  String mode = getStringValue("/device_state/mode");
  if (mode == "register") {
    handleRegisterMode();
  } else {
    handleStandbyMode();
  }
}
```

### B. Update displayOnLCD ke Firebase hanya saat berubah

Untuk menghemat Firebase write calls (quota terbatas di free plan):

```cpp
String lastLCDLine1 = "";
String lastLCDLine2 = "";

void displayOnLCD(String line1, String line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1.substring(0, LCD_COLS));
  lcd.setCursor(0, 1);
  lcd.print(line2.substring(0, LCD_COLS));

  // Hanya update Firebase kalau text berbeda dari sebelumnya
  if (line1 != lastLCDLine1 || line2 != lastLCDLine2) {
    Firebase.RTDB.setString(&fbdo, "/device_state/lcd_line1", line1.c_str());
    Firebase.RTDB.setString(&fbdo, "/device_state/lcd_line2", line2.c_str());
    lastLCDLine1 = line1;
    lastLCDLine2 = line2;
  }
}
```

---

## ✅ Checklist Akhir Update Firmware

- [ ] Backup firmware v1.0 sudah disimpan
- [ ] Variabel `fbdoCart` dan `lastCartStatus` sudah dideklarasikan
- [ ] Fungsi `pushToCart()` sudah dibuat dan bisa tulis ke `/cart/items/{uid}`
- [ ] Fungsi `isItemInCart()` sudah dibuat dan return bool
- [ ] `handleStandbyMode()` sudah diupdate:
  - [ ] Cek duplikat cart sebelum proses
  - [ ] Response "Sudah di keranjang!" jika duplikat
  - [ ] Push ke cart setelah scan berhasil
- [ ] Fungsi `checkCartReset()` sudah dibuat
- [ ] `loop()` memanggil `checkCartReset()` sebelum handle mode
- [ ] `setup()` membaca initial cart status
- [ ] Test 1: Scan tag aktif → item masuk cart ✅
- [ ] Test 2: Scan tag duplikat → ditolak dengan pesan ✅
- [ ] Test 3: Checkout → LCD reset ke "Ready!" ✅
- [ ] Test 4: Scan tag inactive → pesan "Sold" ✅
- [ ] Test 5: Scan unknown tag → pesan "Unknown Tag" ✅
- [ ] Cek Serial Monitor tidak ada error berulang

---

## 📊 Diagram Alur Lengkap (v2.0)

```
              ESP32 Standby Mode
                     │
              Tag RFID di-scan
                     │
           ┌─── UID ada di /tags? ───┐
           │                          │
          YES                         NO
           │                          │
    ┌── is_active? ──┐         LCD: "Unknown Tag"
    │                 │         Buzzer: 3x cepat
   TRUE             FALSE
    │                 │
    │           LCD: "Tag Inactive"
    │           Buzzer: 2x pendek
    │           LED: Merah
    │
  [v2.0] Cek: item sudah di cart?
    │
  ┌─┴─┐
  YES  NO
  │     │
  │     ├── LCD: Nama + Harga
  │     ├── Buzzer: 1x 200ms
  │     ├── LED: Hijau
  │     ├── Tulis /scan_logs (push)
  │     ├── Set is_active = false
  │     ├── Update scan_count +1
  │     ├── Update last_scanned_at
  │     └── [v2.0] Push ke /cart/items/{uid}
  │
  ├── LCD: "Sudah di keranjang!"
  └── Buzzer: 2x pendek
```

---

*Update Firmware ESP32 v2.0 selesai!*

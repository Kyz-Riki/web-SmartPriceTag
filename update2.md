1. Struktur Data Firebase (Pusat Kendali)
Buat satu variabel kontrol di Firebase untuk menentukan status mode alat secara global:
•	system_mode: "STANDBY" (Default) | "ADMIN" | "CHECKOUT"
2. Alur 3 Mode Utama & Perilaku Perangkat
A. Mode Standby (Mode Netral / Idle)
•	Kondisi Awal: Ketika ESP32 pertama kali dinyalakan, alat akan fokus mencari koneksi Wi-Fi. Setelah berhasil connect, ESP32 wajib otomatis masuk ke mode STANDBY ini.
•	Perilaku Alat: * LCD menampilkan: [ Kios Pameran ] / Standby Mode.
o	Sensor RFID dikunci/dimatikan.
o	Jika ada kartu yang sengaja/tidak sengaja menempel, ESP32 menolak proses (LCD tetap standby, LED mati, buzzer diam, tidak ada data yang dikirim ke Firebase).
•	Tampilan Web Kiosk (Customer): Hanya menampilkan halaman idle atau welcome screen dengan instruksi bagi customer untuk menekan tombol mulai.
B. Mode Admin (Registrasi / Mapping Tag)
•	Pemicu: Admin menekan [Tombol Masuk Mode Admin] di halaman Web Admin. Status Firebase berubah menjadi "ADMIN".
•	Perilaku Alat: * LCD berubah menjadi: [ Mode Admin ] / Siap Registrasi.
o	Sensor RFID aktif khusus untuk meregistrasi tag baru.
•	Pemicu Keluar: Admin menekan [Tombol Keluar / Standby] di Web Admin. Status Firebase kembali ke "STANDBY", dan alat langsung kembali mengunci sensor RFID.
C. Mode Checkout (Siap Scan Barang)
•	Pemicu: Customer menekan tombol di Web Kiosk/Display Tablet untuk masuk ke sesi checkout. Status Firebase berubah menjadi "CHECKOUT".
•	Perilaku Alat: * LCD berubah menjadi: [ Mode Checkout ] / Silahkan Scan....
o	Sensor RFID aktif dan siap membaca tag produk koleksi.
•	Pemicu Keluar: Begitu kartu berhasil di-scan atau transaksi diselesaikan di web, sistem web secara otomatis (auto-trigger) mengubah kembali status Firebase ke "STANDBY". Alat langsung kembali ke mode netral.
3. Skema Arsitektur Logika Sistem
4. Checklist Perubahan Coding (Intinya Saja)
•	Pada Web Admin: Tambahkan 2 tombol fungsi (Event Click) $\rightarrow$ Satu untuk set system_mode = "ADMIN", satu lagi untuk set system_mode = "STANDBY".
•	Pada Web Kiosk (Customer): Tambahkan tombol awal untuk set system_mode = "CHECKOUT". Pastikan di akhir fungsi sukses transaksi, web menembak ulang nilai system_mode = "STANDBY".
•	Pada ESP32 (void loop): Gunakan fungsi if-else atau switch-case berdasarkan string system_mode dari Firebase. Fungsi pembacaan RFID (rfid.PICC_IsNewCardPresent()) hanya boleh ditaruh di dalam blok if (system_mode == "CHECKOUT") dan if (system_mode == "ADMIN").


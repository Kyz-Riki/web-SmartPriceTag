Walkthrough Update v2.0 — Kiosk Customer & Admin Orders Tab
Semua modifikasi pada framework Next.js untuk mendukung layanan Kiosk dan Orders pada pembaruan v2.0 ke dalam Smart Price Tag System telah diimplementasikan dengan sukses sesuai dokumen implementasi.md. Berikut adalah rangkuman perubahan dan langkah-langkah untuk memverifikasi fitur baru ini.

Apa yang Ditambahkan dan Diubah
1. Library Firebase RTDB Baru
src/lib/cart.ts: Menangani operasi cart secara real-time. Memungkinkan web app dan komponen Kiosk me-listen ke node RTDB /cart.
src/lib/orders.ts: Menangani push pesanan baru dari Kiosk, dan membaca (onValue dan onChildAdded) list order admin via node /orders.
2. Tab Admin Orders
Update Menu Sidebar (src/app/(dashboard)/layout.tsx): Menambahkan menu "Orders".
Kartu Statistik (src/app/(dashboard)/dashboard/page.tsx): Jumlah order "Pending" telah diintegrasikan pada Dashboard.
Halaman Riwayat Orders (src/app/(dashboard)/orders/page.tsx): Data order dari pelanggan tersaji secara real-time. Admin juga dapat menekan "Tandai Selesai" untuk menyelesaikan pesanan.
3. Kiosk Customer Interface (Sisi Pelanggan)
Aplikasi memuat state machine modern untuk flow penggunaan secara lanskap dan tablet-friendly tanpa memblokir / membutuhkan autentikasi pengguna (src/app/kiosk/page.tsx), berisikan 4 tahapan State:

State 1 — Idle Screen (IdleScreen.tsx): Berjalan saat tidak ada barang di keranjang.
State 2 — Scan Feedback (ScanFeedback.tsx): Tampil sesaat memberitahukan notifikasi berhasil untuk pelanggan.
State 3 — Cart Component (CartView.tsx): Daftar tagihan secara responsif saat ada antrian di list tagihan keranjang.
State 4 — Konfirmasi Order (ConfirmScreen.tsx): Mengesahkan list barang yang di scan untuk masuk ke Database dan diteruskan ke kasir.
🧪 Langkah Pengujian (Testing)
Untuk merasakan pembaruan saat ini, jalankan langkah-langkah verifikasi pada localhost di PC/Laptop Anda:

1. Test Simulasi Melalui Firebase Console (Tanpa Alat)
Alat tidak perlu diflashing jika Anda ingin segera melihat tampilan secara langsung:

Akses web http://localhost:3000/kiosk
Buka Firebase Realtime Database
Tambahkan node: /cart/items/E2801108 → Berikan { alias: "Tag-1", product_name: "Item X", price: 10000, scanned_at: 172... } dan set /cart/status menjadi "active".
Halaman akan transisi otomatis ke State Feedback, dan menuju ke halaman Keranjang (CartView.tsx).
Cobalah tekan "Selesai & Order" lalu Konfirmasi. Di Firebase Console, node /orders baru akan tercipta.
2. Test Melalui Dashboard (Admin Panel)
Kunjungi http://localhost:3000/orders
Orderan percobaan Anda pada test no 1 di atas kini terlihat dengan state kuning "Pending" dan di panel /dashboard juga bertambah count angkanya.
Tekan "Tandai Selesai" dan orderan akan ditandai valid selesai dengan rona hijau.
TIP

Jika telah menguji skenario via console di atas, Anda siap mengujinya secara E2E di lapangan bersama ESP32 yang telah di-flash Firmware C++ nya. Pindai sticker tag secara langsung dan layar Anda akan berjalan lancar secara otomatis.
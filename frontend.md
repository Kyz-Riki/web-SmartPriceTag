# 📘 Frontend Implementation Notes — Smart Price Tag System

> **Untuk:** Programmer junior yang akan mengimplementasikan web dashboard Next.js  
> **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS · Firebase Web SDK v10+

---

## 🗂️ Struktur Folder yang Harus Kamu Buat

```
src/
  app/
    (auth)/
      login/
        page.tsx          ← Halaman login
    (dashboard)/
      layout.tsx          ← Layout utama + navbar (PROTECTED)
      dashboard/
        page.tsx          ← Halaman dashboard
      tags/
        register/
          page.tsx        ← Halaman registrasi RFID tag
      products/
        page.tsx          ← Halaman manajemen produk
      history/
        page.tsx          ← Halaman riwayat scan
  lib/                    ← Sudah dibuat! Jangan diubah dulu.
  types/                  ← Sudah dibuat! Pakai interface yang ada.
  components/
    ui/                   ← Button, Badge, Modal, dll
    tags/                 ← Komponen khusus tag
    dashboard/            ← Widget dashboard
```

---

## 🔑 Konsep Penting Sebelum Mulai

### 1. Route Groups `(auth)` dan `(dashboard)` — Apa itu?

Tanda kurung `()` artinya folder itu **tidak ikut jadi URL**. Ini cuma untuk mengelompokkan halaman yang punya `layout.tsx` berbeda.

```
(auth)/login/page.tsx   → URL: /login      ✅
(dashboard)/dashboard/  → URL: /dashboard  ✅
```

### 2. `"use client"` vs Server Component

Next.js 16 App Router: **semua `page.tsx` secara default adalah Server Component** (tidak bisa pakai `useState`, `useEffect`, Firebase listener).

**Aturan praktis:**
- Kalau butuh `useState`, `useEffect`, onClick, atau Firebase listener → tambahkan `"use client"` di baris pertama file.
- Halaman yang pakai RTDB listener **wajib** `"use client"`.

```tsx
"use client"; // ← Wajib ada di halaman yang pakai Firebase listener

import { useEffect, useState } from "react";
```

### 3. Import Library yang Sudah Dibuat

Selalu import dari `@/lib/...` (bukan path relatif):

```ts
import { listenTags } from "@/lib/tags";
import { listenDeviceState, isDeviceOnline } from "@/lib/device";
import { listenRecentLogs } from "@/lib/logs";
import { signIn, signOut } from "@/lib/auth";
import type { Tag, DeviceState, ScanLog } from "@/types";
```

---

## 📋 Panduan Per Halaman

---

### 🔐 `/login` — Halaman Login

**File:** `src/app/(auth)/login/page.tsx`

**Yang harus dibuat:**
- Form dengan input `email` dan `password`
- Tombol "Login"
- Tampilkan pesan error jika gagal (email tidak terdaftar / password salah)

**Cara pakai:**

```tsx
"use client";
import { signIn } from "@/lib/auth";
import { useRouter } from "next/navigation";

// Di dalam komponen:
const router = useRouter();

async function handleLogin(email: string, password: string) {
  try {
    await signIn(email, password);
    router.push("/dashboard"); // ← Redirect setelah berhasil
  } catch (err: any) {
    // Firebase error codes:
    // "auth/user-not-found"    → Email tidak terdaftar
    // "auth/wrong-password"    → Password salah
    // "auth/invalid-credential"→ Kombinasi email/password salah
    console.error(err.code);
  }
}
```

> ⚠️ **Catatan:** Akun admin harus dibuat dulu secara manual di Firebase Console → Authentication → Users → Add User.

---

### 🛡️ `(dashboard)/layout.tsx` — Protected Layout

**File:** `src/app/(dashboard)/layout.tsx`

Ini adalah layout yang **membungkus semua halaman dashboard**. Tugasnya adalah:
1. Cek apakah user sudah login
2. Kalau belum → redirect ke `/login`
3. Kalau sudah → tampilkan navbar + children

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChange } from "@/lib/auth";
import type { User } from "firebase/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChange((u) => {
      setUser(u);
      setLoading(false);
      if (!u) router.push("/login"); // ← Redirect jika belum login
    });
    return () => unsub(); // ← Wajib cleanup listener!
  }, [router]);

  if (loading) return <div>Loading...</div>;
  if (!user) return null;

  return (
    <div>
      <nav>/* Navbar + tombol logout */</nav>
      {children}
    </div>
  );
}
```

---

### 📊 `/dashboard` — Halaman Dashboard

**File:** `src/app/(dashboard)/dashboard/page.tsx`

**Yang harus ditampilkan:**
| Kartu | Cara Hitung |
|-------|-------------|
| Tag Tersedia | `Object.values(tags).filter(t => t.is_active).length` |
| Tag Terpakai | `Object.values(tags).filter(t => !t.is_active).length` |
| Total Scan Hari Ini | Filter `scan_logs` by timestamp = hari ini |
| Status Perangkat | `isDeviceOnline(deviceState)` → Online / Offline |

**Cara subscribe ke data real-time:**

```tsx
"use client";
import { useEffect, useState } from "react";
import { listenTags } from "@/lib/tags";
import { listenDeviceState, isDeviceOnline } from "@/lib/device";
import type { TagsRecord, DeviceState } from "@/types";

export default function DashboardPage() {
  const [tags, setTags] = useState<TagsRecord>({});
  const [deviceState, setDeviceState] = useState<DeviceState | null>(null);

  useEffect(() => {
    const unsubTags = listenTags(setTags);
    const unsubDevice = listenDeviceState(setDeviceState);

    // Cleanup: detach listener saat komponen di-unmount
    return () => {
      unsubTags();
      unsubDevice();
    };
  }, []);

  const isOnline = isDeviceOnline(deviceState);
  // ... render
}
```

**LCD Monitor:**
```tsx
// Tampilkan lcd_line1 dan lcd_line2 dari deviceState
// Jika offline, overlay dengan pesan "Perangkat Offline"
<div className="font-mono bg-green-900 text-green-300 p-4 rounded">
  <p>{deviceState?.lcd_line1 ?? "---"}</p>
  <p>{deviceState?.lcd_line2 ?? "---"}</p>
  {!isOnline && <div className="overlay">Perangkat Offline</div>}
</div>
```

---

### 📡 `/tags/register` — Registrasi Tag Baru

**File:** `src/app/(dashboard)/tags/register/page.tsx`

**Alur (ikuti urutan PRD section 4.3):**

```
Klik "Mulai Scan"
  → setDeviceMode("register")           [tulis ke RTDB]
  → Pasang listener ke pending_uid
  → ESP32 scan tag → tulis UID ke pending_uid
  → Web deteksi pending_uid berisi UID
  → Tampilkan form (alias, nama barang, harga)
  → Klik "Simpan"
    → registerTag(uid, alias, nama, harga)  [tulis ke /tags]
    → clearPendingUid()                     [hapus pending_uid, set mode: standby]
```

```tsx
import { setDeviceMode, listenDeviceState, clearPendingUid } from "@/lib/device";
import { registerTag } from "@/lib/tags";

// Pantau pending_uid dari device state
useEffect(() => {
  const unsub = listenDeviceState((state) => {
    if (state?.pending_uid) {
      setDetectedUid(state.pending_uid); // ← Tampilkan ke user
    }
  });
  return () => unsub();
}, []);
```

**Validasi form sebelum simpan:**
- Alias harus format `Tag-XX` dan belum dipakai tag lain
- Nama barang minimal 3 karakter
- Harga harus angka positif
- UID tidak boleh duplikat (sudah dicek di `registerTag()`)

---

### 🛍️ `/products` — Manajemen Produk

**File:** `src/app/(dashboard)/products/page.tsx`

**Tampilkan tabel semua tag dari `listenTags`:**

```tsx
const [tags, setTags] = useState<TagsRecord>({});

useEffect(() => {
  const unsub = listenTags(setTags);
  return () => unsub();
}, []);

// Render tabel
Object.entries(tags).map(([uid, tag]) => (
  <tr key={uid}>
    <td>{tag.alias}</td>
    <td>{tag.product_name}</td>
    <td>Rp {tag.price.toLocaleString("id-ID")}</td>
    <td>{tag.is_active ? "Tersedia" : "Terjual"}</td>
    <td>{tag.last_scanned_at ? formatRelative(tag.last_scanned_at) : "Belum pernah"}</td>
    <td>
      <button onClick={() => openEditModal(uid, tag)}>Ubah Barang</button>
      <button onClick={() => handleToggle(uid)}>Toggle Status</button>
    </td>
  </tr>
))
```

**Update produk:**
```tsx
import { updateTag } from "@/lib/tags";

// Di dalam handler tombol "Update":
await updateTag(uid, newProductName, newPrice);
// updateTag otomatis set is_active = true
```

**Toggle status (pakai konfirmasi dulu!):**
```tsx
import { toggleTagStatus } from "@/lib/tags";

async function handleToggle(uid: string) {
  const ok = confirm("Yakin ingin menonaktifkan tag ini?");
  if (!ok) return;
  await toggleTagStatus(uid); // ← Menggunakan Firebase Transaction (aman dari race condition)
}
```

---

### 📜 `/history` — Riwayat & Monitoring

**File:** `src/app/(dashboard)/history/page.tsx`

**Live Feed (50 entri terbaru):**
```tsx
import { listenRecentLogs } from "@/lib/logs";
import type { ScanLog } from "@/types";

const [logs, setLogs] = useState<Array<{ key: string; log: ScanLog }>>([]);

useEffect(() => {
  const unsub = listenRecentLogs((key, log) => {
    // Tambahkan entry baru di paling atas
    setLogs((prev) => [{ key, log }, ...prev].slice(0, 50));
  });
  return () => unsub();
}, []);
```

**Format waktu:**
```ts
// Timestamp di Firebase adalah Unix seconds → kalikan 1000 untuk ms
const date = new Date(log.timestamp * 1000);
const formatted = date.toLocaleString("id-ID"); // "3/4/2026, 10.05.32"
```

**Filter by tanggal:**
```tsx
import { listenLogsByDateRange } from "@/lib/logs";

// Contoh: filter hari ini
const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
const endOfDay = new Date(); endOfDay.setHours(23,59,59,999);

listenLogsByDateRange(
  startOfDay.getTime() / 1000,  // ← Konversi ke Unix seconds
  endOfDay.getTime() / 1000,
  (logs) => setFilteredLogs(logs)
);
```

---

## ⚠️ Hal-Hal yang Sering Salah (Common Pitfalls)

| Kesalahan | Cara Benar |
|-----------|------------|
| Lupa `"use client"` pada komponen yang pakai `useState`/`useEffect` | Tambahkan di baris **paling pertama** file |
| Tidak cleanup Firebase listener | Selalu `return () => unsub()` di dalam `useEffect` |
| Lupa perkalian ×1000 untuk timestamp | Firebase simpan Unix **seconds**, JS butuh **milliseconds** |
| Hardcode harga tanpa `toLocaleString` | Pakai `price.toLocaleString("id-ID")` untuk format Rupiah |
| Tidak handle loading state | Tampilkan skeleton/spinner saat data belum datang |
| Tidak handle error Firebase | Bungkus semua operasi write dengan `try/catch` |

---

## 🧪 Cara Test Tanpa ESP32

Kamu bisa **simulasi aksi ESP32** langsung dari Firebase Console → Realtime Database → Edit data:

| Simulasi | Yang Diubah di Firebase Console |
|----------|----------------------------------|
| ESP32 online | Set `/device_state/last_heartbeat` = timestamp sekarang (Unix) |
| Tag di-scan | Set `/device_state/pending_uid` = `"E2801108"` |
| Heartbeat | Update `/device_state/last_heartbeat` setiap 30 detik |
| Scan log masuk | Tambah entry baru di `/scan_logs` |

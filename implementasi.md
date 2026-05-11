# 📋 Panduan Implementasi Update v2.0 — Smart Price Tag System

> **Untuk:** Junior programmer yang sudah mengimplementasikan PRD v1.0
> **Tujuan update:** Menambahkan halaman **Kiosk Customer** dan tab **Orders** di admin dashboard
> **Estimasi:** 2 minggu (Fase 6 + Fase 7 dari milestone PRD)

---

## 📌 Ringkasan Perubahan

Update v2.0 menambahkan **3 fitur utama**:

| No | Fitur | Deskripsi Singkat |
|----|-------|-------------------|
| 1 | Node Firebase baru: `/cart` dan `/orders` | Menyimpan data keranjang belanja dan riwayat order |
| 2 | Halaman Kiosk (`/kiosk`) | Halaman publik (tanpa login) untuk customer self-order via tablet |
| 3 | Tab Orders admin (`/orders`) | Admin bisa lihat dan kelola order yang masuk dari kiosk |

---

## 🗺️ Peta File yang Harus Diubah / Dibuat

```
STATUS LEGEND:
  ✏️ = file yang sudah ada, perlu DIUBAH
  🆕 = file BARU yang harus DIBUAT

src/
  types/
    ✏️ index.ts                          ← Tambah interface Cart, CartItem, Order
  lib/
    🆕 cart.ts                           ← RTDB operations untuk /cart
    🆕 orders.ts                         ← RTDB operations untuk /orders
  app/
    (dashboard)/
      ✏️ layout.tsx                      ← Tambah link "Orders" di navbar
      dashboard/
        ✏️ page.tsx                      ← Tambah kartu "Order Pending"
      🆕 orders/
        🆕 page.tsx                      ← Halaman manajemen orders
    🆕 kiosk/
      🆕 page.tsx                        ← Halaman kiosk customer (4 state)
  🆕 components/
    🆕 kiosk/
      🆕 IdleScreen.tsx                  ← State 1 — layar idle "Silakan scan barang"
      🆕 ScanFeedback.tsx                ← State 2 — feedback sesaat setelah scan
      🆕 CartView.tsx                    ← State 3 — tampilan keranjang
      🆕 ConfirmScreen.tsx               ← State 4 — konfirmasi & selesai
```

---

## 📐 Urutan Pengerjaan (Step-by-Step)

> ⚠️ **PENTING:** Kerjakan sesuai urutan! Setiap langkah bergantung pada langkah sebelumnya.

---

### LANGKAH 1: Update Firebase Security Rules

**Apa yang dilakukan:** Menambahkan rules untuk node `/cart` dan `/orders` yang baru.

**Di mana:** Firebase Console → Realtime Database → Rules

**Rules yang harus diterapkan:**

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

**Catatan penting:**
- `/cart` → `.read: true` dan `.write: true` karena kiosk diakses tanpa login
- `/orders` → `.write: true` agar kiosk bisa push order baru, tapi `.read: "auth != null"` agar hanya admin yang bisa lihat daftar order
- Jangan lupa klik **Publish** setelah mengubah rules!

---

### LANGKAH 2: Update TypeScript Types (`src/types/index.ts`)

**Apa yang dilakukan:** Menambahkan interface baru untuk `CartItem`, `Cart`, dan `Order`.

**File:** `src/types/index.ts`

**Yang ditambahkan di BAWAH kode yang sudah ada (jangan hapus yang lama):**

```ts
// ============================================
// UPDATE v2.0 — Cart & Orders
// ============================================

/** Item di dalam keranjang kiosk */
export interface CartItem {
  alias: string;
  product_name: string;
  price: number;
  scanned_at: number;
}

/** Record of cart items keyed by RFID UID */
export type CartItemsRecord = Record<string, CartItem>;

/** State keseluruhan cart */
export interface Cart {
  status: "idle" | "active";
  last_updated: number;
  items: CartItemsRecord | null; // null jika kosong
}

/** Item snapshot di dalam order (sudah di-checkout) */
export interface OrderItem {
  tag_uid: string;
  alias: string;
  product_name: string;
  price: number;
}

/** Satu order yang dibuat dari kiosk */
export interface Order {
  items: OrderItem[];
  total: number;
  item_count: number;
  status: "pending" | "done";
  created_at: number;
  completed_at: number | null;
}

/** Record of orders keyed by Firebase push key */
export type OrdersRecord = Record<string, Order>;
```

**Checklist:**
- [ ] Interface `CartItem` sudah ada
- [ ] Interface `Cart` sudah ada dengan field `status`, `last_updated`, `items`
- [ ] Interface `OrderItem` sudah ada
- [ ] Interface `Order` sudah ada dengan field `items`, `total`, `item_count`, `status`, `created_at`, `completed_at`
- [ ] Type alias `CartItemsRecord` dan `OrdersRecord` sudah ada

---

### LANGKAH 3: Buat Library Cart (`src/lib/cart.ts`)

**Apa yang dilakukan:** Membuat semua fungsi Firebase RTDB untuk operasi keranjang.

**File BARU:** `src/lib/cart.ts`

**Fungsi-fungsi yang harus ada:**

```ts
// src/lib/cart.ts
// Firebase RTDB operations untuk /cart node

import {
  ref,
  onValue,
  set,
  remove,
  update,
  Unsubscribe,
  DataSnapshot,
} from "firebase/database";
import { db } from "./firebase";
import type { Cart, CartItem, CartItemsRecord } from "@/types";

const CART_PATH = "cart";

/**
 * Subscribe ke seluruh cart secara real-time.
 * Returns unsubscribe function.
 *
 * Contoh penggunaan:
 *   const unsub = listenCart((cart) => setCart(cart));
 *   return () => unsub();
 */
export function listenCart(
  callback: (cart: Cart | null) => void
): Unsubscribe {
  const cartRef = ref(db, CART_PATH);
  return onValue(cartRef, (snapshot: DataSnapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as Cart) : null);
  });
}

/**
 * Subscribe hanya ke items di cart.
 * Lebih efisien kalau cuma butuh daftar item.
 */
export function listenCartItems(
  callback: (items: CartItemsRecord) => void
): Unsubscribe {
  const itemsRef = ref(db, `${CART_PATH}/items`);
  return onValue(itemsRef, (snapshot: DataSnapshot) => {
    callback((snapshot.val() as CartItemsRecord) ?? {});
  });
}

/**
 * Hapus satu item dari cart berdasarkan UID.
 * Dipakai saat customer salah scan dan ingin menghapus item.
 */
export async function removeCartItem(uid: string): Promise<void> {
  await remove(ref(db, `${CART_PATH}/items/${uid}`));
  // Update last_updated
  await update(ref(db, CART_PATH), {
    last_updated: Math.floor(Date.now() / 1000),
  });
}

/**
 * Kosongkan seluruh cart dan set status ke "idle".
 * Dipanggil setelah checkout berhasil.
 */
export async function clearCart(): Promise<void> {
  await update(ref(db, CART_PATH), {
    status: "idle",
    items: null,
    last_updated: Math.floor(Date.now() / 1000),
  });
}

/**
 * Set status cart (idle / active).
 */
export async function setCartStatus(
  status: "idle" | "active"
): Promise<void> {
  await update(ref(db, CART_PATH), { status });
}
```

**Checklist:**
- [ ] File `src/lib/cart.ts` sudah dibuat
- [ ] Fungsi `listenCart()` ada dan return `Unsubscribe`
- [ ] Fungsi `listenCartItems()` ada dan return `Unsubscribe`
- [ ] Fungsi `removeCartItem(uid)` ada
- [ ] Fungsi `clearCart()` ada — reset items ke null dan status ke "idle"
- [ ] Fungsi `setCartStatus()` ada

---

### LANGKAH 4: Buat Library Orders (`src/lib/orders.ts`)

**Apa yang dilakukan:** Membuat semua fungsi Firebase RTDB untuk operasi orders.

**File BARU:** `src/lib/orders.ts`

**Fungsi-fungsi yang harus ada:**

```ts
// src/lib/orders.ts
// Firebase RTDB operations untuk /orders node

import {
  ref,
  push,
  update,
  onValue,
  onChildAdded,
  query,
  orderByChild,
  equalTo,
  Unsubscribe,
  DataSnapshot,
} from "firebase/database";
import { db } from "./firebase";
import type { Order, OrderItem, OrdersRecord, CartItemsRecord } from "@/types";

const ORDERS_PATH = "orders";

/**
 * Buat order baru dari item-item di keranjang.
 * Dipanggil saat customer tekan "Konfirmasi" di kiosk.
 * Returns push key dari order yang baru dibuat.
 */
export async function createOrder(
  cartItems: CartItemsRecord
): Promise<string> {
  // Konversi CartItemsRecord ke array OrderItem
  const items: OrderItem[] = Object.entries(cartItems).map(
    ([uid, item]) => ({
      tag_uid: uid,
      alias: item.alias,
      product_name: item.product_name,
      price: item.price,
    })
  );

  const total = items.reduce((sum, item) => sum + item.price, 0);

  const orderData: Order = {
    items,
    total,
    item_count: items.length,
    status: "pending",
    created_at: Math.floor(Date.now() / 1000),
    completed_at: null,
  };

  const ordersRef = ref(db, ORDERS_PATH);
  const newRef = await push(ordersRef, orderData);

  if (!newRef.key) throw new Error("Gagal membuat order.");
  return newRef.key;
}

/**
 * Subscribe ke semua orders secara real-time.
 * Untuk halaman admin /orders.
 */
export function listenOrders(
  callback: (orders: OrdersRecord) => void
): Unsubscribe {
  const ordersRef = ref(db, ORDERS_PATH);
  return onValue(ordersRef, (snapshot: DataSnapshot) => {
    callback((snapshot.val() as OrdersRecord) ?? {});
  });
}

/**
 * Subscribe ke orders baru yang masuk (pakai onChildAdded).
 * Lebih efisien untuk notifikasi real-time.
 */
export function listenNewOrders(
  callback: (key: string, order: Order) => void
): Unsubscribe {
  const ordersRef = ref(db, ORDERS_PATH);
  return onChildAdded(ordersRef, (snapshot: DataSnapshot) => {
    if (snapshot.key && snapshot.val()) {
      callback(snapshot.key, snapshot.val() as Order);
    }
  });
}

/**
 * Tandai order sebagai selesai (done).
 * Dipanggil admin saat pembayaran sudah diterima.
 */
export async function markOrderDone(orderKey: string): Promise<void> {
  const orderRef = ref(db, `${ORDERS_PATH}/${orderKey}`);
  await update(orderRef, {
    status: "done",
    completed_at: Math.floor(Date.now() / 1000),
  });
}

/**
 * Hitung jumlah order dengan status tertentu.
 * Berguna untuk statistik dashboard.
 */
export function countOrdersByStatus(
  orders: OrdersRecord,
  status: "pending" | "done"
): number {
  return Object.values(orders).filter((o) => o.status === status).length;
}
```

**Checklist:**
- [ ] File `src/lib/orders.ts` sudah dibuat
- [ ] Fungsi `createOrder(cartItems)` ada — konversi cart items ke order dan push ke Firebase
- [ ] Fungsi `listenOrders()` ada — subscribe semua orders
- [ ] Fungsi `listenNewOrders()` ada — subscribe order baru via `onChildAdded`
- [ ] Fungsi `markOrderDone(orderKey)` ada — update status jadi "done" + isi completed_at
- [ ] Fungsi `countOrdersByStatus()` ada — helper untuk dashboard

---

### LANGKAH 5: Update Dashboard Layout — Tambah Link Orders (`src/app/(dashboard)/layout.tsx`)

**Apa yang dilakukan:** Menambahkan menu "Orders" di sidebar navigasi admin.

**File:** `src/app/(dashboard)/layout.tsx`

**Yang diubah:**

1. **Import ikon baru** — tambahkan `ShoppingCart` dari lucide-react:

```tsx
// SEBELUM:
import { LayoutDashboard, Tags, History, PlusSquare, LogOut, Menu, X, Tag } from "lucide-react";

// SESUDAH:
import { LayoutDashboard, Tags, History, PlusSquare, LogOut, Menu, X, Tag, ShoppingCart } from "lucide-react";
```

2. **Tambah item navigasi** — di array `navigation`, tambahkan entry Orders:

```tsx
// SEBELUM:
const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Produk", href: "/products", icon: Tags },
  { name: "Registrasi Tag", href: "/tags/register", icon: PlusSquare },
  { name: "Riwayat", href: "/history", icon: History },
];

// SESUDAH:
const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Produk", href: "/products", icon: Tags },
  { name: "Registrasi Tag", href: "/tags/register", icon: PlusSquare },
  { name: "Riwayat", href: "/history", icon: History },
  { name: "Orders", href: "/orders", icon: ShoppingCart },   // ← BARU
];
```

**Checklist:**
- [ ] Import `ShoppingCart` dari lucide-react
- [ ] Entry "Orders" dengan href `/orders` sudah ada di array `navigation`

---

### LANGKAH 6: Update Dashboard Page — Tambah Kartu Order Pending (`src/app/(dashboard)/dashboard/page.tsx`)

**Apa yang dilakukan:** Menambahkan kartu statistik "Order Pending" di halaman dashboard.

**File:** `src/app/(dashboard)/dashboard/page.tsx`

**Perubahan yang diperlukan:**

1. **Import fungsi orders:**

```tsx
import { listenOrders } from "@/lib/orders";
import { countOrdersByStatus } from "@/lib/orders";
import type { OrdersRecord } from "@/types";
```

2. **Tambah state untuk orders:**

```tsx
const [orders, setOrders] = useState<OrdersRecord>({});
```

3. **Tambah listener di useEffect (di dalam useEffect yang sudah ada):**

```tsx
useEffect(() => {
  const unsubTags = listenTags(setTags);
  const unsubDevice = listenDeviceState(setDeviceState);
  const unsubOrders = listenOrders(setOrders);  // ← BARU

  return () => {
    unsubTags();
    unsubDevice();
    unsubOrders();  // ← BARU: jangan lupa cleanup!
  };
}, []);
```

4. **Hitung order pending:**

```tsx
const pendingOrders = countOrdersByStatus(orders, "pending");
```

5. **Tambah kartu di JSX** (setelah kartu "Status Perangkat"):

```tsx
<div className="bg-white rounded-xl border border-neutral-200 p-6">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-neutral-500">Order Pending</p>
      <p className="text-3xl font-bold text-amber-600 mt-1">{pendingOrders}</p>
    </div>
    <div className="bg-amber-100 rounded-lg p-3">
      <ShoppingCart className="w-6 h-6 text-amber-600" />
    </div>
  </div>
</div>
```

> ⚠️ Jangan lupa import `ShoppingCart` dari `lucide-react` juga!

**Checklist:**
- [ ] Import `listenOrders` dan `countOrdersByStatus` dari `@/lib/orders`
- [ ] Import type `OrdersRecord` dari `@/types`
- [ ] State `orders` dengan `useState<OrdersRecord>({})` ditambahkan
- [ ] Listener `listenOrders` ditambahkan di `useEffect` + cleanup
- [ ] Kartu "Order Pending" muncul di dashboard

---

### LANGKAH 7: Buat Halaman Orders Admin (`src/app/(dashboard)/orders/page.tsx`)

**Apa yang dilakukan:** Membuat halaman baru untuk menampilkan dan mengelola orders dari kiosk.

**File BARU:** `src/app/(dashboard)/orders/page.tsx`

**Fitur yang harus ada:**

| Fitur | Detail |
|-------|--------|
| List semua order | Urutkan berdasarkan `created_at` descending (terbaru di atas) |
| Kolom No. Order | Numbering otomatis berdasarkan urutan |
| Kolom Waktu | Format: `DD/MM/YYYY HH:mm:ss` |
| Kolom Items | Nama produk di dalam order, dipisah koma |
| Kolom Total | Format Rupiah: `Rp 199.000` |
| Kolom Status | Badge: **Pending** (kuning) atau **Selesai** (hijau) |
| Tombol Tandai Selesai | Hanya muncul jika status = `pending` |
| Filter status | Dropdown/tab: Semua / Pending / Selesai |

**Struktur komponen:**

```tsx
"use client";

import { useEffect, useState } from "react";
import { listenOrders, markOrderDone } from "@/lib/orders";
import type { OrdersRecord } from "@/types";
import { ShoppingCart, Check, Clock, Filter } from "lucide-react";

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrdersRecord>({});
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = listenOrders((data) => {
      setOrders(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Sort orders by created_at descending
  const sortedOrders = Object.entries(orders)
    .filter(([, order]) => filter === "all" || order.status === filter)
    .sort(([, a], [, b]) => b.created_at - a.created_at);

  async function handleMarkDone(key: string) {
    const ok = confirm("Tandai order ini sebagai selesai?");
    if (!ok) return;
    try {
      await markOrderDone(key);
    } catch (err) {
      alert("Gagal mengupdate order: " + (err as Error).message);
    }
  }

  // Format timestamp ke string readable
  function formatTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  if (loading) return <div>Loading orders...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Orders</h1>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "pending", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {f === "all" ? "Semua" : f === "pending" ? "Pending" : "Selesai"}
          </button>
        ))}
      </div>

      {/* Tabel Orders */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-4 py-3 text-left">No.</th>
              <th className="px-4 py-3 text-left">Waktu</th>
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sortedOrders.map(([key, order], index) => (
              <tr key={key} className="hover:bg-neutral-50">
                <td className="px-4 py-3">{index + 1}</td>
                <td className="px-4 py-3">{formatTimestamp(order.created_at)}</td>
                <td className="px-4 py-3">
                  {order.items.map((item) => item.product_name).join(", ")}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  Rp {order.total.toLocaleString("id-ID")}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      order.status === "pending"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {order.status === "pending" ? "Pending" : "Selesai"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {order.status === "pending" && (
                    <button
                      onClick={() => handleMarkDone(key)}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Tandai Selesai
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sortedOrders.length === 0 && (
          <div className="text-center py-12 text-neutral-400">
            Belum ada order.
          </div>
        )}
      </div>
    </div>
  );
}
```

**Checklist:**
- [ ] File `src/app/(dashboard)/orders/page.tsx` sudah dibuat
- [ ] Menggunakan `"use client"` di baris pertama
- [ ] Subscribe ke `listenOrders()` dengan cleanup di useEffect
- [ ] Tabel menampilkan: No, Waktu, Items, Total, Status, Aksi
- [ ] Filter tab: Semua / Pending / Selesai berfungsi
- [ ] Tombol "Tandai Selesai" memanggil `markOrderDone()` dengan konfirmasi
- [ ] Format timestamp menggunakan `toLocaleString("id-ID")`
- [ ] Format harga menggunakan `toLocaleString("id-ID")`

---

### LANGKAH 8: Buat Komponen Kiosk — IdleScreen (`src/components/kiosk/IdleScreen.tsx`)

**Apa yang dilakukan:** Membuat layar standby yang tampil saat keranjang kosong.

**File BARU:** `src/components/kiosk/IdleScreen.tsx`

**Spesifikasi:**
- Fullscreen, centered text
- Teks besar: "Silakan scan barang"
- Instruksi kecil di bawahnya: "Tempelkan tag RFID ke reader untuk mulai belanja"
- Animasi subtle: ikon scan berdenyut pelan (pulse) supaya layar tidak terlihat mati
- Tidak ada tombol apapun

**Contoh implementasi:**

```tsx
"use client";

import { Scan } from "lucide-react";

export default function IdleScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Ikon scan dengan animasi pulse */}
      <div className="animate-pulse mb-8">
        <div className="bg-blue-600 rounded-full p-8">
          <Scan className="w-16 h-16 text-white" />
        </div>
      </div>

      <h1 className="text-4xl lg:text-5xl font-bold text-neutral-800 mb-4 text-center">
        Silakan Scan Barang
      </h1>
      <p className="text-lg text-neutral-500 text-center max-w-md">
        Tempelkan tag RFID ke reader untuk mulai belanja
      </p>
    </div>
  );
}
```

**Checklist:**
- [ ] File `src/components/kiosk/IdleScreen.tsx` sudah dibuat
- [ ] Tampilan fullscreen, centered
- [ ] Ada animasi pulse pada ikon scan
- [ ] Teks "Silakan Scan Barang" besar dan jelas
- [ ] Instruksi singkat di bawah

---

### LANGKAH 9: Buat Komponen Kiosk — ScanFeedback (`src/components/kiosk/ScanFeedback.tsx`)

**Apa yang dilakukan:** Membuat animasi feedback sesaat setelah item baru di-scan.

**File BARU:** `src/components/kiosk/ScanFeedback.tsx`

**Spesifikasi:**
- Fullscreen, durasi ~1.5 detik, lalu otomatis hilang
- Menampilkan nama barang dan harga yang baru saja di-scan
- Animasi slide-in dari bawah
- Background warna hijau/success

**Contoh implementasi:**

```tsx
"use client";

import { useEffect } from "react";
import { CheckCircle } from "lucide-react";
import type { CartItem } from "@/types";

interface ScanFeedbackProps {
  item: CartItem;
  onDone: () => void; // Dipanggil setelah 1.5 detik
}

export default function ScanFeedback({ item, onDone }: ScanFeedbackProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-green-600 text-white animate-fadeIn">
      <CheckCircle className="w-20 h-20 mb-6" />
      <p className="text-2xl font-medium mb-2">Barang Ditambahkan!</p>
      <h2 className="text-4xl lg:text-5xl font-bold mb-4 text-center px-8">
        {item.product_name}
      </h2>
      <p className="text-3xl font-semibold">
        Rp {item.price.toLocaleString("id-ID")}
      </p>
    </div>
  );
}
```

> 💡 **Catatan CSS:** Kamu perlu menambahkan animasi `fadeIn` di `globals.css`:
> ```css
> @keyframes fadeIn {
>   from { opacity: 0; transform: translateY(20px); }
>   to { opacity: 1; transform: translateY(0); }
> }
> .animate-fadeIn {
>   animation: fadeIn 0.3s ease-out;
> }
> ```

**Checklist:**
- [ ] File `src/components/kiosk/ScanFeedback.tsx` sudah dibuat
- [ ] Menerima props `item` (CartItem) dan `onDone` (callback)
- [ ] Auto-hilang setelah 1.5 detik via `setTimeout`
- [ ] Menampilkan nama barang + harga
- [ ] Animasi CSS ditambahkan di `globals.css`

---

### LANGKAH 10: Buat Komponen Kiosk — CartView (`src/components/kiosk/CartView.tsx`)

**Apa yang dilakukan:** Membuat tampilan keranjang belanja dua kolom.

**File BARU:** `src/components/kiosk/CartView.tsx`

**Spesifikasi:**
- Layout dua kolom (tablet landscape)
- Kolom kiri: list item dengan nama produk, harga, tombol hapus (X) per item
- Kolom kanan: ringkasan (jumlah item, total harga, tombol "Selesai & Order")
- Teks kecil: "Scan barang lagi untuk menambah"

**Contoh implementasi:**

```tsx
"use client";

import { removeCartItem } from "@/lib/cart";
import type { CartItemsRecord } from "@/types";
import { X, ShoppingBag } from "lucide-react";

interface CartViewProps {
  items: CartItemsRecord;
  onCheckout: () => void; // Dipanggil saat tombol "Selesai & Order" di-klik
}

export default function CartView({ items, onCheckout }: CartViewProps) {
  const itemEntries = Object.entries(items);
  const totalPrice = itemEntries.reduce(([, item]) => item.price, 0);
  // PERBAIKAN: totalPrice harus begini:
  // const totalPrice = itemEntries.reduce((sum, [, item]) => sum + item.price, 0);

  async function handleRemove(uid: string) {
    try {
      await removeCartItem(uid);
    } catch (err) {
      console.error("Gagal menghapus item:", err);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-neutral-50 p-6 gap-6">
      {/* Kolom Kiri — List Item */}
      <div className="flex-1 bg-white rounded-2xl p-6 shadow-sm overflow-y-auto">
        <h2 className="text-xl font-bold text-neutral-800 mb-4">
          Keranjang Belanja
        </h2>
        <div className="space-y-3">
          {itemEntries.map(([uid, item]) => (
            <div
              key={uid}
              className="flex items-center justify-between bg-neutral-50 rounded-xl p-4"
            >
              <div>
                <p className="font-semibold text-neutral-800">{item.product_name}</p>
                <p className="text-sm text-neutral-500">{item.alias}</p>
              </div>
              <div className="flex items-center gap-4">
                <p className="font-bold text-lg">
                  Rp {item.price.toLocaleString("id-ID")}
                </p>
                <button
                  onClick={() => handleRemove(uid)}
                  className="text-red-500 hover:bg-red-50 rounded-full p-1 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Kolom Kanan — Ringkasan */}
      <div className="w-full lg:w-80 bg-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold text-neutral-800 mb-4">Ringkasan</h3>
          <div className="flex justify-between text-neutral-600 mb-2">
            <span>Jumlah Item</span>
            <span className="font-semibold">{itemEntries.length}</span>
          </div>
          <div className="flex justify-between text-neutral-800 text-xl font-bold border-t border-neutral-200 pt-4 mt-4">
            <span>Total</span>
            <span>Rp {totalPrice.toLocaleString("id-ID")}</span>
          </div>
          <p className="text-sm text-neutral-400 mt-4 text-center">
            Scan barang lagi untuk menambah
          </p>
        </div>
        <button
          onClick={onCheckout}
          className="mt-6 w-full bg-blue-600 text-white text-lg font-bold py-4 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <ShoppingBag className="w-5 h-5" />
          Selesai & Order
        </button>
      </div>
    </div>
  );
}
```

> ⚠️ **Bug yang harus diperbaiki:** Pada contoh di atas, `totalPrice` ada typo di baris `reduce`. Gunakan versi yang benar:
> ```ts
> const totalPrice = itemEntries.reduce((sum, [, item]) => sum + item.price, 0);
> ```

**Checklist:**
- [ ] File `src/components/kiosk/CartView.tsx` sudah dibuat
- [ ] Layout dua kolom (responsive)
- [ ] List item tampil dengan nama produk, harga, dan tombol hapus
- [ ] Ringkasan menampilkan jumlah item dan total harga
- [ ] Total harga dihitung otomatis dari items
- [ ] Tombol "Selesai & Order" memanggil `onCheckout()`
- [ ] Tombol hapus memanggil `removeCartItem(uid)` dari `@/lib/cart`

---

### LANGKAH 11: Buat Komponen Kiosk — ConfirmScreen (`src/components/kiosk/ConfirmScreen.tsx`)

**Apa yang dilakukan:** Membuat layar konfirmasi sebelum checkout dan animasi sukses.

**File BARU:** `src/components/kiosk/ConfirmScreen.tsx`

**Spesifikasi:**
- Ringkasan final — list semua item dan total
- Dua tombol: **Konfirmasi** dan **Batal**
- Jika Konfirmasi: push order ke Firebase, reset cart, tampilkan animasi sukses
- Setelah 5 detik, kembali ke State 1 (idle)

**Contoh implementasi:**

```tsx
"use client";

import { useState } from "react";
import { createOrder } from "@/lib/orders";
import { clearCart } from "@/lib/cart";
import type { CartItemsRecord } from "@/types";
import { CheckCircle, ArrowLeft, Loader2 } from "lucide-react";

interface ConfirmScreenProps {
  items: CartItemsRecord;
  onCancel: () => void;       // Kembali ke State 3 (CartView)
  onSuccess: () => void;      // Kembali ke State 1 (Idle) setelah delay 5 detik
}

export default function ConfirmScreen({ items, onCancel, onSuccess }: ConfirmScreenProps) {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const itemEntries = Object.entries(items);
  const totalPrice = itemEntries.reduce((sum, [, item]) => sum + item.price, 0);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      // 1. Push order ke Firebase
      await createOrder(items);
      // 2. Kosongkan cart
      await clearCart();
      // 3. Tampilkan animasi sukses
      setSuccess(true);
      // 4. Setelah 5 detik, kembali ke idle
      setTimeout(onSuccess, 5000);
    } catch (err) {
      alert("Gagal membuat order: " + (err as Error).message);
      setSubmitting(false);
    }
  }

  // ---- Tampilan Sukses ----
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-green-600 text-white">
        <CheckCircle className="w-24 h-24 mb-6 animate-bounce" />
        <h1 className="text-4xl font-bold mb-4 text-center">
          Pesanan Berhasil!
        </h1>
        <p className="text-xl text-green-100 text-center">
          Silakan ke kasir untuk pembayaran
        </p>
      </div>
    );
  }

  // ---- Tampilan Konfirmasi ----
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 p-8">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full">
        <h2 className="text-2xl font-bold text-neutral-800 mb-6 text-center">
          Konfirmasi Pesanan
        </h2>

        {/* List item */}
        <div className="space-y-3 mb-6">
          {itemEntries.map(([uid, item]) => (
            <div key={uid} className="flex justify-between py-2 border-b border-neutral-100">
              <span className="text-neutral-700">{item.product_name}</span>
              <span className="font-semibold">Rp {item.price.toLocaleString("id-ID")}</span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex justify-between text-xl font-bold border-t border-neutral-300 pt-4 mb-8">
          <span>Total</span>
          <span>Rp {totalPrice.toLocaleString("id-ID")}</span>
        </div>

        {/* Tombol */}
        <div className="flex gap-4">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-3 border-2 border-neutral-300 rounded-xl text-neutral-600 font-medium hover:bg-neutral-100 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Konfirmasi"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Checklist:**
- [ ] File `src/components/kiosk/ConfirmScreen.tsx` sudah dibuat
- [ ] List item + total ditampilkan
- [ ] Tombol Batal → memanggil `onCancel()`
- [ ] Tombol Konfirmasi → memanggil `createOrder()` lalu `clearCart()`
- [ ] Loading state ditampilkan saat proses submit (disable tombol + spinner)
- [ ] Setelah sukses: tampilkan animasi sukses selama 5 detik, lalu panggil `onSuccess()`
- [ ] Error di-handle dengan `try/catch` + alert

---

### LANGKAH 12: Buat Halaman Kiosk Utama (`src/app/kiosk/page.tsx`)

**Apa yang dilakukan:** Menyatukan 4 komponen kiosk menjadi satu halaman dengan state machine.

**File BARU:** `src/app/kiosk/page.tsx`

> ⚠️ **PENTING:** Halaman ini di luar folder `(dashboard)`, jadi **TIDAK dilindungi auth**. Customer bisa akses langsung tanpa login.

**Diagram State:**

```
State 1 (Idle)
    │
    ├── item baru di-scan ──→ State 2 (ScanFeedback)
    │                              │
    │                              └── 1.5 detik ──→ State 3 (CartView)
    │                                                     │
    │                                    ├── item baru ──→ State 2 (loop)
    │                                    ├── klik "Selesai & Order" ──→ State 4 (Confirm)
    │                                    └── semua item dihapus ──→ State 1
    │
    └── State 4 (Confirm)
              ├── Batal ──→ State 3
              └── Konfirmasi ──→ Sukses (5s) ──→ State 1
```

**Contoh implementasi:**

```tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { listenCartItems } from "@/lib/cart";
import type { CartItemsRecord, CartItem } from "@/types";

import IdleScreen from "@/components/kiosk/IdleScreen";
import ScanFeedback from "@/components/kiosk/ScanFeedback";
import CartView from "@/components/kiosk/CartView";
import ConfirmScreen from "@/components/kiosk/ConfirmScreen";

type KioskState = "idle" | "feedback" | "cart" | "confirm";

export default function KioskPage() {
  const [state, setState] = useState<KioskState>("idle");
  const [items, setItems] = useState<CartItemsRecord>({});
  const [lastScannedItem, setLastScannedItem] = useState<CartItem | null>(null);

  // Ref untuk track jumlah item sebelumnya (detect item baru)
  const prevItemCountRef = useRef(0);

  useEffect(() => {
    const unsub = listenCartItems((newItems) => {
      const newCount = Object.keys(newItems).length;
      const prevCount = prevItemCountRef.current;

      setItems(newItems);

      if (newCount === 0) {
        // Semua item dihapus → kembali ke idle
        setState("idle");
      } else if (newCount > prevCount && prevCount >= 0) {
        // Item baru ditambahkan → tampilkan feedback
        // Cari item yang baru (yang tidak ada di prev)
        const allUids = Object.keys(newItems);
        const newestUid = allUids[allUids.length - 1]; // Ambil yang terakhir
        // Cara lebih akurat: bandingkan dengan items sebelumnya
        // Untuk simpelnya, ambil item yang paling baru scanned_at
        let latestItem: CartItem | null = null;
        let latestTime = 0;
        for (const [, item] of Object.entries(newItems)) {
          if (item.scanned_at > latestTime) {
            latestTime = item.scanned_at;
            latestItem = item;
          }
        }
        if (latestItem) {
          setLastScannedItem(latestItem);
          setState("feedback");
        }
      }

      prevItemCountRef.current = newCount;
    });

    return () => unsub();
  }, []);

  const handleFeedbackDone = useCallback(() => {
    setState("cart");
  }, []);

  const handleCheckout = useCallback(() => {
    setState("confirm");
  }, []);

  const handleCancelConfirm = useCallback(() => {
    setState("cart");
  }, []);

  const handleOrderSuccess = useCallback(() => {
    setState("idle");
    prevItemCountRef.current = 0;
  }, []);

  // ---- Render berdasarkan state ----
  switch (state) {
    case "idle":
      return <IdleScreen />;

    case "feedback":
      return lastScannedItem ? (
        <ScanFeedback item={lastScannedItem} onDone={handleFeedbackDone} />
      ) : (
        <IdleScreen />
      );

    case "cart":
      return Object.keys(items).length > 0 ? (
        <CartView items={items} onCheckout={handleCheckout} />
      ) : (
        <IdleScreen />
      );

    case "confirm":
      return Object.keys(items).length > 0 ? (
        <ConfirmScreen
          items={items}
          onCancel={handleCancelConfirm}
          onSuccess={handleOrderSuccess}
        />
      ) : (
        <IdleScreen />
      );

    default:
      return <IdleScreen />;
  }
}
```

**Checklist:**
- [ ] File `src/app/kiosk/page.tsx` sudah dibuat (di LUAR folder `(dashboard)`)
- [ ] Menggunakan `"use client"` di baris pertama
- [ ] 4 state: idle, feedback, cart, confirm
- [ ] Subscribe ke `listenCartItems()` dengan cleanup
- [ ] Deteksi item baru (bandingkan jumlah items sebelum dan sesudah)
- [ ] Transisi state otomatis:
  - [ ] items kosong → idle
  - [ ] item baru → feedback (1.5s) → cart
  - [ ] klik "Selesai & Order" → confirm
  - [ ] konfirmasi sukses → idle (setelah 5s)
  - [ ] batal → cart
- [ ] Semua komponen kiosk di-import

---

### LANGKAH 13: Update globals.css — Tambah Animasi Kiosk

**File:** `src/app/globals.css`

**Tambahkan di paling bawah file:**

```css
/* ============================================
   KIOSK ANIMATIONS (v2.0)
   ============================================ */

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}

@keyframes slideInFromBottom {
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slideIn {
  animation: slideInFromBottom 0.4s ease-out;
}
```

**Checklist:**
- [ ] `@keyframes fadeIn` ditambahkan
- [ ] `.animate-fadeIn` class ditambahkan
- [ ] `@keyframes slideInFromBottom` ditambahkan
- [ ] `.animate-slideIn` class ditambahkan

---

### LANGKAH 14: Update Firmware ESP32 (Backend)

**Apa yang dilakukan:** ESP32 sekarang harus menulis ke `/cart/items/{uid}` saat tag di-scan dalam mode standby (selain menulis ke `/scan_logs`).

**File:** `firmware/main.ino` (atau file ESP32 kamu)

**Perubahan di `handleStandbyMode()`:**

Tambahkan logika berikut **setelah** `writeScanLog()` dan `setBool(is_active, false)`:

```cpp
// BARU v2.0: Push item ke cart
void pushToCart(String uid, String alias, String productName, int price) {
  FirebaseJson cartItem;
  time_t now; time(&now);

  cartItem.set("alias", alias);
  cartItem.set("product_name", productName);
  cartItem.set("price", price);
  cartItem.set("scanned_at", (int)now);

  String cartPath = "/cart/items/" + uid;
  Firebase.RTDB.setJSON(&fbdo, cartPath.c_str(), &cartItem);

  // Update cart status dan last_updated
  Firebase.RTDB.setString(&fbdo, "/cart/status", "active");
  Firebase.RTDB.setInt(&fbdo, "/cart/last_updated", (int)now);
}
```

**Tambahkan pengecekan duplikat di cart sebelum proses scan:**

```cpp
void handleStandbyMode() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  String uid = getUIDString(rfid.uid.uidByte, rfid.uid.size);
  String path = "/tags/" + uid;

  if (Firebase.RTDB.get(&fbdo, path.c_str())) {
    // ... parse data ...

    if (isActive) {
      // BARU: Cek apakah sudah ada di cart
      String cartCheckPath = "/cart/items/" + uid;
      if (Firebase.RTDB.get(&fbdo, cartCheckPath.c_str()) && fbdo.dataType() != "null") {
        // Sudah di cart!
        displayOnLCD("Sudah di", "keranjang!");
        buzzerBeep(100); delay(100); buzzerBeep(100);
        rfid.PICC_HaltA();
        return;
      }

      displayOnLCD(productName, "Rp " + formatPrice(price));
      buzzerBeep(200);
      ledGreen();
      writeScanLog(uid, productName, price);
      Firebase.RTDB.setBool(&fbdo, (path + "/is_active").c_str(), false);
      pushToCart(uid, alias, productName, price);  // ← BARU
    } else {
      // ... existing code ...
    }
  }
  // ... existing code ...
}
```

**ESP32 juga harus listen ke `/cart/status` untuk reset LCD:**

```cpp
// Di loop(), setelah heartbeat:
void checkCartReset() {
  static String lastCartStatus = "";
  String cartStatus = getStringValue("/cart/status");

  if (lastCartStatus == "active" && cartStatus == "idle") {
    // Cart baru saja di-checkout → reset LCD
    displayOnLCD("Ready!", "Scan barang...");
    ledGreen();
  }
  lastCartStatus = cartStatus;
}
```

**Checklist Firmware:**
- [ ] Fungsi `pushToCart()` sudah dibuat
- [ ] Saat scan `is_active: true` → push ke `/cart/items/{uid}` + update status
- [ ] Cek duplikat: jika item sudah ada di cart → tampilkan "Sudah di keranjang!" + 2x buzzer
- [ ] Listen `/cart/status` → reset LCD saat berubah dari "active" ke "idle"

---

## 🧪 LANGKAH 15: Testing End-to-End

### A. Test Tanpa ESP32 (Simulasi via Firebase Console)

Buka Firebase Console → Realtime Database, lakukan langkah berikut:

| No | Simulasi | Aksi di Firebase Console | Yang Dicek di Web |
|----|----------|-------------------------|-------------------|
| 1 | Item masuk ke cart | Tambah `/cart/items/E2801108` dengan data `{ alias: "Tag-01", product_name: "Kemeja Flanel", price: 199000, scanned_at: <unix_now> }` + set `/cart/status: "active"` | Kiosk berubah dari idle → feedback → cart |
| 2 | Item kedua masuk | Tambah `/cart/items/E2801109` dengan data serupa | Kiosk tampilkan feedback lagi, lalu cart 2 item |
| 3 | Hapus item | Di kiosk, klik tombol X pada item | Item hilang dari Firebase dan UI |
| 4 | Checkout | Di kiosk, klik "Selesai & Order" → "Konfirmasi" | Order baru muncul di `/orders`, cart kosong, kiosk kembali idle |
| 5 | Orders admin | Buka `/orders` di dashboard admin | Order terlihat dengan status "Pending" |
| 6 | Tandai selesai | Di admin, klik "Tandai Selesai" | Status berubah jadi "Selesai" + `completed_at` terisi |
| 7 | Dashboard stat | Buka `/dashboard` | Kartu "Order Pending" menampilkan angka yang benar |

### B. Test Dengan ESP32

| No | Skenario | Hasil Yang Diharapkan |
|----|----------|----------------------|
| 1 | Scan tag `is_active: true` | LCD tampilkan nama + harga, item masuk ke cart kiosk |
| 2 | Scan tag yang sudah di cart | LCD tampilkan "Sudah di keranjang!", item tidak duplikat |
| 3 | Checkout dari kiosk | Cart kosong, LCD ESP32 kembali "Ready!" |
| 4 | Scan tag `is_active: false` | LCD tampilkan "Tag Inactive / Sold" |

---

## ⚠️ Hal-Hal yang Sering Salah & Tips

| No | Kesalahan | Solusi |
|----|-----------|--------|
| 1 | Halaman kiosk minta login | Pastikan file `page.tsx` kiosk ada di `src/app/kiosk/` (di LUAR folder `(dashboard)`!) |
| 2 | Order pending tidak update di dashboard | Pastikan listener `listenOrders` ada di useEffect + cleanup |
| 3 | Cart items tidak terdeteksi oleh kiosk | Cek Security Rules → `/cart` harus `.read: true` |
| 4 | `totalPrice` NaN | Pastikan `reduce()` punya initial value `0`: `.reduce((sum, [, item]) => sum + item.price, 0)` |
| 5 | ScanFeedback tidak muncul | Pastikan `prevItemCountRef.current` dibandingkan dengan benar di listener |
| 6 | Item duplikat di cart | Cart menggunakan UID sebagai key, seharusnya otomatis no-duplikat. Cek ESP32 |
| 7 | Order tanpa items | Pastikan ada validasi `Object.keys(items).length > 0` sebelum checkout |
| 8 | Kiosk stuck di state feedback | Pastikan `setTimeout(onDone, 1500)` berjalan dan `onDone` callback benar |
| 9 | Animasi CSS tidak muncul | Pastikan CSS ditambahkan di `globals.css`, bukan file terpisah |
| 10 | Tombol "Orders" tidak ada di sidebar | Cek apakah entry baru sudah ditambahkan di array `navigation` di `layout.tsx` |

---

## 📁 Checklist Akhir (Sebelum Submit / Deploy)

- [ ] **Firebase Security Rules** sudah di-update dengan node `/cart` dan `/orders`
- [ ] **Types** — interface `Cart`, `CartItem`, `Order`, `OrderItem` sudah ada di `src/types/index.ts`
- [ ] **Library cart.ts** — file `src/lib/cart.ts` sudah buat dengan semua fungsi
- [ ] **Library orders.ts** — file `src/lib/orders.ts` sudah buat dengan semua fungsi
- [ ] **Sidebar layout** — menu "Orders" sudah muncul di navbar admin
- [ ] **Dashboard** — kartu "Order Pending" sudah tampil dan hitung benar
- [ ] **Halaman /orders** — tabel orders berfungsi, filter berfungsi, tombol "Tandai Selesai" berfungsi
- [ ] **Halaman /kiosk** — 4 state transisi berjalan lancar
- [ ] **Komponen IdleScreen** — animasi pulse muncul
- [ ] **Komponen ScanFeedback** — otomatis hilang setelah 1.5 detik
- [ ] **Komponen CartView** — hapus item berfungsi, total terhitung benar
- [ ] **Komponen ConfirmScreen** — checkout berhasil buat order + reset cart
- [ ] **globals.css** — animasi CSS kiosk ditambahkan
- [ ] **Firmware ESP32** — push ke `/cart/items`, cek duplikat, listen `/cart/status`
- [ ] **Test end-to-end** — scan → cart → checkout → admin lihat order → tandai selesai ✅

---

*Smart Price Tag System — Panduan Implementasi Update v2.0*

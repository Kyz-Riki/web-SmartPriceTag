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
    status: "done",
    created_at: Math.floor(Date.now() / 1000),
    completed_at: Math.floor(Date.now() / 1000),
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

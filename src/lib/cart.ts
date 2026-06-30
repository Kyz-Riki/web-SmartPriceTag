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
 * Kosongkan seluruh cart dan set status ke "cancelled".
 * Dipanggil saat customer membatalkan pesanan.
 */
export async function cancelCart(): Promise<void> {
  await update(ref(db, CART_PATH), {
    status: "cancelled",
    items: null,
    last_updated: Math.floor(Date.now() / 1000),
  });
}

/**
 * Set status cart (idle / active / cancelled).
 */
export async function setCartStatus(
  status: "idle" | "active" | "cancelled"
): Promise<void> {
  await update(ref(db, CART_PATH), { status });
}

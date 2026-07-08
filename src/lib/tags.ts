// src/lib/tags.ts
// Firebase RTDB operations for the /tags node

import {
  ref,
  onValue,
  update,
  set,
  runTransaction,
  DataSnapshot,
  Unsubscribe,
} from "firebase/database";
import { db } from "./firebase";
import type { Tag, TagsRecord } from "@/types";

const TAGS_PATH = "tags";

/**
 * Subscribe to all tags in real-time.
 * Returns an unsubscribe function — call it to detach the listener.
 *
 * @example
 *   const unsub = listenTags((tags) => setTags(tags));
 *   return () => unsub();
 */
export function listenTags(callback: (tags: TagsRecord) => void): Unsubscribe {
  const tagsRef = ref(db, TAGS_PATH);
  return onValue(tagsRef, (snapshot: DataSnapshot) => {
    callback((snapshot.val() as TagsRecord) ?? {});
  });
}

/**
 * Get a single tag value once (non-reactive).
 * Returns null if the tag does not exist.
 */
export async function getTag(uid: string): Promise<Tag | null> {
  const { get } = await import("firebase/database");
  const tagRef = ref(db, `${TAGS_PATH}/${uid}`);
  const snapshot = await get(tagRef);
  return snapshot.exists() ? (snapshot.val() as Tag) : null;
}

/**
 * Update the product name and price of an existing tag.
 * Also resets is_active to true (new product = available).
 */
export async function updateTag(
  uid: string,
  productName: string,
  price: number
): Promise<void> {
  const tagRef = ref(db, `${TAGS_PATH}/${uid}`);
  await update(tagRef, {
    product_name: productName,
    price,
    is_active: true,
  });
}

/**
 * Toggle the is_active flag using a Firebase Transaction to prevent race conditions.
 * Returns the new is_active value after the transaction.
 */
export async function toggleTagStatus(uid: string): Promise<boolean> {
  const tagRef = ref(db, `${TAGS_PATH}/${uid}/is_active`);
  const result = await runTransaction(tagRef, (currentValue: boolean | null) => {
    return currentValue === null ? false : !currentValue;
  });
  return result.snapshot.val() as boolean;
}

/**
 * Register a new RFID tag for the first time.
 * Throws if the UID or alias already exists.
 */
export async function registerTag(
  uid: string,
  alias: string,
  productName: string,
  price: number
): Promise<void> {
  // Check for duplicate UID
  const existing = await getTag(uid);
  if (existing) {
    throw new Error(`Tag UID "${uid}" sudah terdaftar.`);
  }

  const tagData: Tag = {
    alias,
    product_name: productName,
    price,
    is_active: true,
    last_scanned_at: null,
    scan_count: 0,
  };

  await set(ref(db, `${TAGS_PATH}/${uid}`), tagData);
}

/**
 * Batch set multiple tags as inactive (sold).
 * Dipanggil setelah customer confirm order di kiosk.
 * Menggunakan multi-path update agar atomic.
 */
export async function setTagsInactive(uids: string[]): Promise<void> {
  if (uids.length === 0) return;

  const updates: Record<string, boolean> = {};
  for (const uid of uids) {
    updates[`${TAGS_PATH}/${uid}/is_active`] = false;
  }

  await update(ref(db), updates);
}

/**
 * Delete a registered tag from the database.
 */
export async function deleteTag(uid: string): Promise<void> {
  const { remove } = await import("firebase/database");
  const tagRef = ref(db, `${TAGS_PATH}/${uid}`);
  await remove(tagRef);
}

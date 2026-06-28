// src/lib/device.ts
// Firebase RTDB operations for the /device_state node

import { ref, onValue, update, Unsubscribe, DataSnapshot } from "firebase/database";
import { db } from "./firebase";
import type { DeviceState } from "@/types";

const DEVICE_PATH = "device_state";

/** Offline threshold: if last_heartbeat is older than this, device is considered offline */
export const OFFLINE_THRESHOLD_MS = 60_000; // 60 seconds

/**
 * Subscribe to device state in real-time.
 * Returns an unsubscribe function.
 */
export function listenDeviceState(
  callback: (state: DeviceState | null) => void
): Unsubscribe {
  const deviceRef = ref(db, DEVICE_PATH);
  return onValue(deviceRef, (snapshot: DataSnapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as DeviceState) : null);
  });
}

/**
 * Set the ESP32 operating mode.
 * - "STANDBY": ESP32 returns to normal idle operation.
 * - "ADMIN": ESP32 enters RFID scan mode for registering/identifying tags.
 * - "CHECKOUT": ESP32 enters RFID scan mode for kiosk checkout.
 */
export async function setSystemMode(mode: "STANDBY" | "ADMIN" | "CHECKOUT"): Promise<void> {
  const deviceRef = ref(db, DEVICE_PATH);
  await update(deviceRef, { system_mode: mode });
}

/**
 * Clear pending_uid after a tag has been registered.
 * Also resets mode to "STANDBY".
 */
export async function clearPendingUid(): Promise<void> {
  const deviceRef = ref(db, DEVICE_PATH);
  await update(deviceRef, {
    pending_uid: null,
    system_mode: "STANDBY",
  });
}

/**
 * Determine if the device is online based on last_heartbeat timestamp.
 * Returns true if last_heartbeat was within the last 60 seconds.
 */
export function isDeviceOnline(state: DeviceState | null): boolean {
  if (!state || !state.last_heartbeat) return false;
  const nowMs = Date.now();
  const heartbeatMs = state.last_heartbeat * 1000; // convert Unix seconds → ms
  return nowMs - heartbeatMs < OFFLINE_THRESHOLD_MS;
}

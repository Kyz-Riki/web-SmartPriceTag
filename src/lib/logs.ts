// src/lib/logs.ts
// Firebase RTDB operations for the /scan_logs node

import {
  ref,
  query,
  orderByChild,
  limitToLast,
  onChildAdded,
  onValue,
  startAt,
  endAt,
  Unsubscribe,
  DataSnapshot,
} from "firebase/database";
import { db } from "./firebase";
import type { ScanLog, ScanLogsRecord } from "@/types";

const LOGS_PATH = "scan_logs";
const LIVE_FEED_LIMIT = 50;
const HISTORY_LIMIT = 100;

/**
 * Subscribe to new scan logs using onChildAdded (efficient — only fires for each new entry).
 * The callback receives each individual ScanLog with its push key.
 * Fires once per existing entry on attach, then for each new entry.
 *
 * @param limit - Maximum number of recent entries to subscribe to (default: 50)
 */
export function listenRecentLogs(
  callback: (key: string, log: ScanLog) => void,
  limit: number = LIVE_FEED_LIMIT
): Unsubscribe {
  const logsQuery = query(
    ref(db, LOGS_PATH),
    orderByChild("timestamp"),
    limitToLast(limit)
  );
  return onChildAdded(logsQuery, (snapshot: DataSnapshot) => {
    if (snapshot.key && snapshot.val()) {
      callback(snapshot.key, snapshot.val() as ScanLog);
    }
  });
}

/**
 * Fetch an ordered snapshot of all recent logs (non-reactive).
 * Returns an array sorted descending by timestamp.
 */
export async function fetchRecentLogs(
  limit: number = HISTORY_LIMIT
): Promise<Array<{ key: string; log: ScanLog }>> {
  const { get } = await import("firebase/database");
  const logsQuery = query(
    ref(db, LOGS_PATH),
    orderByChild("timestamp"),
    limitToLast(limit)
  );
  const snapshot = await get(logsQuery);
  if (!snapshot.exists()) return [];

  const records = snapshot.val() as ScanLogsRecord;
  return Object.entries(records)
    .map(([key, log]) => ({ key, log }))
    .sort((a, b) => b.log.timestamp - a.log.timestamp);
}

/**
 * Subscribe to all logs, with optional date range filter.
 * Useful for the history page table with date filters.
 *
 * @param startTimestamp - Unix timestamp (inclusive)
 * @param endTimestamp   - Unix timestamp (inclusive)
 */
export function listenLogsByDateRange(
  startTimestamp: number,
  endTimestamp: number,
  callback: (logs: ScanLogsRecord) => void
): Unsubscribe {
  const logsQuery = query(
    ref(db, LOGS_PATH),
    orderByChild("timestamp"),
    startAt(startTimestamp),
    endAt(endTimestamp)
  );
  return onValue(logsQuery, (snapshot: DataSnapshot) => {
    callback((snapshot.val() as ScanLogsRecord) ?? {});
  });
}

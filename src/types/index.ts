// src/types/index.ts
// TypeScript types matching the Firebase RTDB schema from the PRD

export interface Tag {
  alias: string;
  product_name: string;
  price: number;
  is_active: boolean;
  last_scanned_at: number | null;
  scan_count: number;
}

/** Record of tags keyed by RFID UID (e.g. "E2801108") */
export type TagsRecord = Record<string, Tag>;

export interface DeviceState {
  mode: "standby" | "register";
  lcd_line1: string;
  lcd_line2: string;
  online: boolean;
  last_heartbeat: number;
  pending_uid: string | null;
}

export interface ScanLog {
  tag_uid: string;
  alias: string;
  product_name: string;
  price: number;
  timestamp: number;
}

/** Record of scan logs keyed by Firebase push key (e.g. "-NxABCD1234") */
export type ScanLogsRecord = Record<string, ScanLog>;

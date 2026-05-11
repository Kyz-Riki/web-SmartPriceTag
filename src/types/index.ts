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

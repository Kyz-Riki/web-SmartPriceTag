#!/usr/bin/env node
// scripts/seed-firebase.js
// Seeds initial data into Firebase RTDB matching the PRD schema.
// Run ONCE during project setup: node scripts/seed-firebase.js
//
// Prerequisites:
//   1. Copy .env.local.example to .env.local and fill in credentials.
//   2. npm install dotenv  (if not installed)
//   3. node scripts/seed-firebase.js

require("dotenv").config({ path: ".env.local" });

const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set } = require("firebase/database");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.databaseURL) {
  console.error("❌ NEXT_PUBLIC_FIREBASE_DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ─── Seed Data ────────────────────────────────────────────────────────────────
// Initial data structure matching the PRD schema.
// Adjust or add more tags as needed.

const seedData = {
  tags: {
    E2801108: {
      alias: "Tag-01",
      product_name: "Kemeja Flanel",
      price: 199000,
      is_active: true,
      last_scanned_at: null,
      scan_count: 0,
    },
  },
  device_state: {
    mode: "standby",
    lcd_line1: "Smart Price Tag",
    lcd_line2: "Ready",
    online: false,
    last_heartbeat: 0,
    pending_uid: null,
  },
  // scan_logs starts empty; entries are created by ESP32 on each scan
  scan_logs: {},
};

async function seed() {
  try {
    console.log("🔥 Connecting to Firebase RTDB:", firebaseConfig.databaseURL);
    const rootRef = ref(db, "/");
    await set(rootRef, seedData);
    console.log("✅ Seed data written successfully!\n");
    console.log("   /tags/E2801108   → Tag-01 (Kemeja Flanel, Rp 199.000)");
    console.log("   /device_state    → standby, offline");
    console.log("   /scan_logs       → empty (ready for ESP32)");
    console.log("\n📌 Next step: Open Firebase Console to verify the data.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  }
}

seed();

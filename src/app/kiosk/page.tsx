"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { listenCartItems, clearCart } from "@/lib/cart";
import { setSystemMode } from "@/lib/device";
import type { CartItemsRecord, CartItem } from "@/types";

import IdleScreen from "@/components/kiosk/IdleScreen";
import ScanFeedback from "@/components/kiosk/ScanFeedback";
import CartView from "@/components/kiosk/CartView";
import ConfirmScreen from "@/components/kiosk/ConfirmScreen";

type KioskState = "idle" | "feedback" | "cart" | "confirm";

// Auto-cancel jika tidak ada aktivitas selama 5 menit
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export default function KioskPage() {
  const [state, setState] = useState<KioskState>("idle");
  const [items, setItems] = useState<CartItemsRecord>({});
  const [lastScannedItem, setLastScannedItem] = useState<CartItem | null>(null);

  // Ref untuk track jumlah item sebelumnya (detect item baru)
  const prevItemCountRef = useRef(0);
  // Ref untuk auto-timeout timer
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset inactivity timer — dipanggil setiap ada aktivitas
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(async () => {
      console.log("[KIOSK] Inactivity timeout — auto-clearing cart");
      await clearCart();
      await setSystemMode("STANDBY");
      setState("idle");
      prevItemCountRef.current = 0;
    }, INACTIVITY_TIMEOUT_MS);
  }, []);

  // Bersihkan timer saat unmount
  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsub = listenCartItems((newItems) => {
      const newCount = Object.keys(newItems).length;
      const prevCount = prevItemCountRef.current;

      setItems(newItems);

      if (newCount === 0) {
        // Semua item dihapus → kembali ke idle, stop timer
        setSystemMode("STANDBY").catch(() => {});
        setState("idle");
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
          inactivityTimerRef.current = null;
        }
      } else if (newCount > prevCount && prevCount >= 0) {
        // Item baru ditambahkan → tampilkan feedback + reset timer
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
        // Reset timer karena ada aktivitas baru
        resetInactivityTimer();
      }

      prevItemCountRef.current = newCount;
    });

    return () => unsub();
  }, [resetInactivityTimer]);

  const handleFeedbackDone = useCallback(() => {
    setState("cart");
  }, []);

  const handleCheckout = useCallback(() => {
    // Stop inactivity timer saat masuk ke halaman confirm
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    setState("confirm");
  }, []);

  const handleCancelConfirm = useCallback(() => {
    // Kembali ke cart, restart timer
    setState("cart");
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  // Cancel seluruh belanjaan — cart di-clear, tag tetap active
  const handleCancelAll = useCallback(async () => {
    await clearCart();
    await setSystemMode("STANDBY");
    setState("idle");
    prevItemCountRef.current = 0;
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const handleOrderSuccess = useCallback(async () => {
    await setSystemMode("STANDBY");
    setState("idle");
    prevItemCountRef.current = 0;
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const handleStartCheckout = useCallback(async () => {
    try {
      await setSystemMode("CHECKOUT");
      // Optionally we could transition to a different state here if needed,
      // but if the ESP32 responds and scans a tag, it will push to cart
      // and we will automatically go to 'feedback' state due to listenCartItems.
    } catch (err) {
      console.error("Gagal memulai sesi checkout:", err);
    }
  }, []);

  // ---- Render berdasarkan state ----
  switch (state) {
    case "idle":
      return <IdleScreen onStartCheckout={handleStartCheckout} />;

    case "feedback":
      return lastScannedItem ? (
        <ScanFeedback item={lastScannedItem} onDone={handleFeedbackDone} />
      ) : (
        <IdleScreen />
      );

    case "cart":
      return Object.keys(items).length > 0 ? (
        <CartView items={items} onCheckout={handleCheckout} onCancelAll={handleCancelAll} />
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

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { listenCartItems, clearCart, cancelCart } from "@/lib/cart";
import { setSystemMode } from "@/lib/device";
import { Settings } from "lucide-react";
import type { CartItemsRecord, CartItem } from "@/types";

import IdleScreen from "@/components/kiosk/IdleScreen";
import ScanFeedback from "@/components/kiosk/ScanFeedback";
import CartView from "@/components/kiosk/CartView";
import ConfirmScreen from "@/components/kiosk/ConfirmScreen";
import ConfirmModal from "@/components/ui/ConfirmModal";

type KioskState = "idle" | "scanning" | "feedback" | "cart" | "confirm";

// Auto-cancel jika tidak ada aktivitas selama 5 menit
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export default function KioskPage() {
  const [state, setState] = useState<KioskState>("idle");
  const [items, setItems] = useState<CartItemsRecord>({});
  const [lastScannedItem, setLastScannedItem] = useState<CartItem | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Ref untuk track jumlah item sebelumnya (detect item baru)
  const prevItemCountRef = useRef(0);
  // Ref untuk auto-timeout timer
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Ref untuk track state terkini di dalam callback (anti stale closure)
  const stateRef = useRef<KioskState>("idle");

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Reset inactivity timer — dipanggil setiap ada aktivitas
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(async () => {
      console.log("[KIOSK] Inactivity timeout — auto-cancelling cart");
      await cancelCart();
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
        // KECUALI saat di halaman confirm (ConfirmScreen handles sendiri via onSuccess)
        if (stateRef.current !== "confirm") {
          setSystemMode("STANDBY").catch(() => {});
          setState("idle");
        }
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

  // Cancel seluruh belanjaan — cart di-cancel, tag tetap active
  const handleCancelAll = useCallback(async () => {
    await cancelCart();
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
      setState("scanning");
      resetInactivityTimer();
    } catch (err) {
      console.error("Gagal memulai sesi checkout:", err);
    }
  }, [resetInactivityTimer]);

  const handleCancelCheckout = useCallback(async () => {
    try {
      await setSystemMode("STANDBY");
      setState("idle");
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    } catch (err) {
      console.error("Gagal membatalkan checkout:", err);
    }
  }, []);

  const handleForceReset = useCallback(async () => {
    try {
      await cancelCart();
      await setSystemMode("STANDBY");
      setState("idle");
      prevItemCountRef.current = 0;
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    } catch (err) {
      console.error("Gagal reset kiosk", err);
    }
    setResetModalOpen(false);
  }, []);

  // ---- Render berdasarkan state ----
  const renderContent = () => {
    switch (state) {
      case "idle":
        return <IdleScreen onStartCheckout={handleStartCheckout} />;
  
      case "scanning":
        return <IdleScreen isScanning={true} onCancelCheckout={handleCancelCheckout} />;
  
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
  };

  return (
    <div className="relative min-h-screen w-full">
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setResetModalOpen(true)}
          className="p-3 bg-white/50 hover:bg-white text-neutral-400 hover:text-red-500 rounded-full shadow-sm backdrop-blur transition-all"
          title="Reset Kiosk ke Standby"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
      {renderContent()}

      <ConfirmModal
        isOpen={resetModalOpen}
        title="Reset Kiosk"
        message="PERINGATAN: Anda akan mereset Kiosk dan membatalkan semua transaksi/aktivitas. Lanjutkan?"
        confirmText="Reset"
        onConfirm={handleForceReset}
        onCancel={() => setResetModalOpen(false)}
        variant="danger"
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { createOrder } from "@/lib/orders";
import { clearCart } from "@/lib/cart";
import { setTagsInactive } from "@/lib/tags";
import type { CartItemsRecord } from "@/types";
import { CheckCircle, ArrowLeft, Loader2, Receipt } from "lucide-react";

interface ConfirmScreenProps {
  items: CartItemsRecord;
  onCancel: () => void;       // Kembali ke State 3 (CartView)
  onSuccess: () => void;      // Kembali ke State 1 (Idle) setelah delay 5 detik
}

export default function ConfirmScreen({ items, onCancel, onSuccess }: ConfirmScreenProps) {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const itemEntries = Object.entries(items);
  const totalPrice = itemEntries.reduce((sum, [, item]) => sum + item.price, 0);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      // 1. Push order ke Firebase
      await createOrder(items);
      // 2. Set semua tag di order jadi inactive (sold)
      //    Baru di sini tag di-set inactive, bukan saat scan
      const tagUids = Object.keys(items);
      await setTagsInactive(tagUids);
      // 3. Kosongkan cart
      await clearCart();
      // 4. Tampilkan animasi sukses
      setSuccess(true);
      // 5. Setelah 5 detik, kembali ke idle
      setTimeout(onSuccess, 5000);
    } catch (err) {
      alert("Gagal membuat order: " + (err as Error).message);
      setSubmitting(false);
    }
  }

  // ---- Tampilan Sukses ----
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-600 text-white animate-fadeIn">
        <CheckCircle className="w-32 h-32 mb-8 animate-bounce" />
        <h1 className="text-5xl font-black mb-6 text-center tracking-tight">
          Pesanan Berhasil Dibuat!
        </h1>
        <div className="bg-emerald-700/50 backdrop-blur px-8 py-4 rounded-2xl border border-emerald-500/30">
          <p className="text-2xl text-emerald-50 text-center font-medium">
            Silakan menuju kasir untuk melakukan pembayaran
          </p>
        </div>
      </div>
    );
  }

  // ---- Tampilan Konfirmasi ----
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-100 p-8 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-xl border border-neutral-200 p-10 max-w-2xl w-full">
        <div className="flex flex-col items-center mb-8 pb-8 border-b border-neutral-200">
          <div className="bg-blue-100 p-4 rounded-full mb-4">
            <Receipt className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-3xl font-black text-neutral-900 text-center tracking-tight">
            Konfirmasi Pesanan
          </h2>
          <p className="text-neutral-500 mt-2">Pastikan semua barang sudah sesuai</p>
        </div>

        {/* List item */}
        <div className="space-y-4 mb-8 max-h-[300px] overflow-y-auto pr-2">
          {itemEntries.map(([uid, item]) => (
            <div key={uid} className="flex justify-between items-center p-4 bg-neutral-50 rounded-xl border border-neutral-100">
              <span className="text-neutral-900 font-medium text-lg">{item.product_name}</span>
              <span className="font-bold text-neutral-900 text-lg">Rp {item.price.toLocaleString("id-ID")}</span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex justify-between items-end bg-neutral-50 p-6 rounded-2xl border border-neutral-200 mb-10">
          <span className="text-neutral-600 font-medium text-lg">Total Tagihan</span>
          <span className="text-3xl font-black text-blue-600 tracking-tight">Rp {totalPrice.toLocaleString("id-ID")}</span>
        </div>

        {/* Tombol */}
        <div className="flex gap-4 lg:gap-6">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-5 border-2 border-neutral-200 rounded-2xl text-neutral-600 font-bold text-lg hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Kembali
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Memproses...
              </>
            ) : (
              "Ya, Buat Pesanan"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

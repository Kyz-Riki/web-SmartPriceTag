"use client";

import { removeCartItem, clearCart } from "@/lib/cart";
import type { CartItemsRecord } from "@/types";
import { X, ShoppingBag, Trash2 } from "lucide-react";

interface CartViewProps {
  items: CartItemsRecord;
  onCheckout: () => void;
  onCancelAll: () => void; // Batalkan seluruh belanjaan
}

export default function CartView({ items, onCheckout, onCancelAll }: CartViewProps) {
  const itemEntries = Object.entries(items);
  const totalPrice = itemEntries.reduce((sum, [, item]) => sum + item.price, 0);

  async function handleRemove(uid: string) {
    try {
      await removeCartItem(uid);
    } catch (err) {
      console.error("Gagal menghapus item:", err);
    }
  }

  async function handleCancelAll() {
    await clearCart();
    onCancelAll();
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-neutral-100 p-6 lg:p-10 gap-8 animate-fadeIn">
      {/* Kolom Kiri — List Item */}
      <div className="flex-1 bg-white rounded-3xl p-8 shadow-sm overflow-hidden flex flex-col border border-neutral-200">
        <h2 className="text-2xl font-bold text-neutral-900 mb-6 flex items-center gap-3">
          <ShoppingBag className="w-6 h-6 text-blue-600" />
          Keranjang Belanja
        </h2>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {itemEntries.map(([uid, item]) => (
            <div
              key={uid}
              className="flex items-center justify-between bg-neutral-50 hover:bg-blue-50/50 rounded-2xl p-5 border border-neutral-100 transition-colors group animate-slideIn"
            >
              <div>
                <p className="font-bold text-lg text-neutral-900 mb-1">{item.product_name}</p>
                <p className="text-sm text-neutral-500 bg-white inline-block px-2 py-0.5 rounded border border-neutral-200">{item.alias}</p>
              </div>
              <div className="flex items-center gap-6">
                <p className="font-bold text-xl text-neutral-900">
                  Rp {item.price.toLocaleString("id-ID")}
                </p>
                <button
                  onClick={() => handleRemove(uid)}
                  className="text-neutral-400 hover:text-red-600 hover:bg-red-50 bg-white rounded-full p-2 transition-colors border border-neutral-200 shadow-sm"
                  aria-label="Hapus item"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Kolom Kanan — Ringkasan */}
      <div className="w-full lg:w-[400px] bg-white rounded-3xl p-8 shadow-sm flex flex-col justify-between border border-neutral-200">
        <div>
          <h3 className="text-xl font-bold text-neutral-900 mb-8 border-b border-neutral-200 pb-4">Ringkasan Pembayaran</h3>
          
          <div className="space-y-4 mb-8">
            <div className="flex justify-between text-neutral-600 text-lg">
              <span>Jumlah Item</span>
              <span className="font-semibold text-neutral-900">{itemEntries.length} items</span>
            </div>
          </div>
          
          <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100">
            <div className="flex justify-between items-end">
              <span className="text-neutral-600 font-medium">Total Tagihan</span>
              <span className="text-3xl font-black text-blue-600 tracking-tight">
                Rp {totalPrice.toLocaleString("id-ID")}
              </span>
            </div>
          </div>
          
          <div className="mt-8 text-center bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-blue-800 font-medium animate-pulse">
              Belum selesai? Scan barang lagi untuk menambah keranjang!
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <button
            onClick={onCheckout}
            className="w-full bg-blue-600 text-white text-xl font-bold p-6 rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-600/20 active:scale-[0.98]"
          >
            <ShoppingBag className="w-6 h-6" />
            Selesai & Order
          </button>

          <button
            onClick={handleCancelAll}
            className="w-full bg-white text-red-600 text-lg font-semibold p-4 rounded-2xl hover:bg-red-50 transition-all flex items-center justify-center gap-2 border-2 border-red-200 active:scale-[0.98]"
          >
            <Trash2 className="w-5 h-5" />
            Batalkan Belanja
          </button>
        </div>
      </div>
    </div>
  );
}

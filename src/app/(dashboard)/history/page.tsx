"use client";

import { useEffect, useState } from "react";
import { listenOrders, markOrderDone } from "@/lib/orders";
import type { OrdersRecord } from "@/types";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { History, ShoppingCart, Clock, Package } from "lucide-react";

export default function HistoryPage() {
  const [orders, setOrders] = useState<OrdersRecord>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = listenOrders((data) => {
      setOrders(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Sort orders by created_at descending
  const sortedOrders = Object.entries(orders)
    .sort(([, a], [, b]) => b.created_at - a.created_at);

  const totalOrders = Object.keys(orders).length;
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Riwayat Pesanan</h1>
        <p className="text-neutral-500">Semua pesanan yang dibuat dari kiosk self-order.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-blue-50 rounded-lg">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-neutral-500 font-medium">Total Pesanan</p>
            <p className="text-2xl font-bold text-neutral-900">{totalOrders}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-50 rounded-lg">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-neutral-500 font-medium">Selesai Dibayar</p>
            <p className="text-2xl font-bold text-emerald-600">{totalOrders}</p>
          </div>
        </div>
      </div>

      {/* Tabel Pesanan */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-4 font-semibold">No.</th>
                <th className="px-6 py-4 font-semibold">Waktu Pesanan</th>
                <th className="px-6 py-4 font-semibold">Barang</th>
                <th className="px-6 py-4 font-semibold text-center">Qty</th>
                <th className="px-6 py-4 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-neutral-400">
                    <div className="flex flex-col items-center gap-3">
                      <History className="w-8 h-8 text-neutral-300" />
                      <p>Belum ada pesanan yang ditemukan.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedOrders.map(([key, order], index) => {
                  const date = new Date(order.created_at * 1000);
                  return (
                    <tr key={key} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-neutral-900">{index + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-neutral-900">
                          {format(date, "dd MMM yyyy", { locale: localeId })}
                        </span>
                        <span className="text-neutral-500 ml-2 font-mono text-xs">
                          {format(date, "HH:mm:ss")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-neutral-600 max-w-xs">
                        <div className="space-y-1">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Package className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                              <span className="truncate">{item.product_name}</span>
                              <span className="text-neutral-400 text-xs whitespace-nowrap">
                                Rp {item.price.toLocaleString("id-ID")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-neutral-900">
                        {order.item_count}
                      </td>
                      <td className="px-6 py-4 text-neutral-900 font-bold text-right whitespace-nowrap">
                        Rp {order.total.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

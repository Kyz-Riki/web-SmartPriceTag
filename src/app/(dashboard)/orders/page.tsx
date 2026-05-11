"use client";

import { useEffect, useState } from "react";
import { listenOrders, markOrderDone } from "@/lib/orders";
import type { OrdersRecord } from "@/types";
import { Filter } from "lucide-react";

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrdersRecord>({});
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
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
    .filter(([, order]) => filter === "all" || order.status === filter)
    .sort(([, a], [, b]) => b.created_at - a.created_at);

  async function handleMarkDone(key: string) {
    const ok = confirm("Tandai order ini sebagai selesai?");
    if (!ok) return;
    try {
      await markOrderDone(key);
    } catch (err) {
      alert("Gagal mengupdate order: " + (err as Error).message);
    }
  }

  // Format timestamp ke string readable
  function formatTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-neutral-900">Orders</h1>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-5 h-5 text-neutral-400 mr-2" />
        {(["all", "pending", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-neutral-600 hover:bg-neutral-50 border border-neutral-200"
            }`}
          >
            {f === "all" ? "Semua" : f === "pending" ? "Pending" : "Selesai"}
          </button>
        ))}
      </div>

      {/* Tabel Orders */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-4 font-semibold">No.</th>
                <th className="px-6 py-4 font-semibold">Waktu</th>
                <th className="px-6 py-4 font-semibold">Item</th>
                <th className="px-6 py-4 font-semibold text-right">Total</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sortedOrders.map(([key, order], index) => (
                <tr key={key} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-neutral-900">{index + 1}</td>
                  <td className="px-6 py-4 text-neutral-600">{formatTimestamp(order.created_at)}</td>
                  <td className="px-6 py-4 text-neutral-600 max-w-xs truncate" title={order.items.map((item) => item.product_name).join(", ")}>
                    {order.items.map((item) => item.product_name).join(", ")}
                  </td>
                  <td className="px-6 py-4 text-neutral-900 font-medium text-right whitespace-nowrap">
                    Rp {order.total.toLocaleString("id-ID")}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        order.status === "pending"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {order.status === "pending" ? "Pending" : "Selesai"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {order.status === "pending" ? (
                      <button
                        onClick={() => handleMarkDone(key)}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        Tandai Selesai
                      </button>
                    ) : (
                      <span className="text-neutral-400 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedOrders.length === 0 && (
          <div className="flex flex-col flex-1 items-center justify-center p-12 text-center">
            <div className="h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
              <Filter className="h-6 w-6 text-neutral-400" />
            </div>
            <h3 className="text-sm font-medium text-neutral-900 mb-1">Belum ada order</h3>
            <p className="text-sm text-neutral-500">Tidak ada data order yang sesuai dengan filter Anda.</p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { listenRecentLogs, listenLogsByDateRange } from "@/lib/logs";
import type { ScanLog } from "@/types";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Activity, Calendar, History, Search, Filter } from "lucide-react";

export default function HistoryPage() {
  const [logs, setLogs] = useState<Array<{ key: string; log: ScanLog }>>([]);
  const [filterMode, setFilterMode] = useState<"live" | "date">("live");
  
  const [startDate, setStartDate] = useState(() => {
    const defaultStart = new Date();
    defaultStart.setHours(0, 0, 0, 0);
    return format(defaultStart, "yyyy-MM-dd");
  });
  
  const [endDate, setEndDate] = useState(() => {
    const defaultEnd = new Date();
    defaultEnd.setHours(23, 59, 59, 999);
    return format(defaultEnd, "yyyy-MM-dd");
  });

  // Subscribe to live logs
  useEffect(() => {
    if (filterMode !== "live") return;
    
    // Using listenRecentLogs (simulating an added child log)
    // Actually our listenRecentLogs according to frontend.md just provides key and log one by one
    // So we reset first
    setLogs([]);
    const unsub = listenRecentLogs((key, log) => {
      setLogs((prev) => {
        // Prevent duplicate keys due to re-renders or multiple triggers
        if (prev.some((p) => p.key === key)) return prev;
        return [{ key, log }, ...prev].slice(0, 50);
      });
    });
    
    return () => unsub();
  }, [filterMode]);

  // Handle date search
  function handleSearchDate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setFilterMode("date");
    
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59.999`);
    
    // listenLogsByDateRange provides an array
    listenLogsByDateRange(
      Math.floor(start.getTime() / 1000), 
      Math.floor(end.getTime() / 1000),
      (logsRecord) => {
        const structuredLogs = Object.entries(logsRecord)
          .map(([key, log]) => ({ key, log }))
          .sort((a, b) => b.log.timestamp - a.log.timestamp);
        setLogs(structuredLogs);
      }
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Riwayat Scan</h1>
          <p className="text-neutral-500">Melihat log dari setiap barang yang telah di-scan oleh kasir.</p>
        </div>
        
        <div className="flex gap-2">
           <button
            onClick={() => setFilterMode("live")}
            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${
              filterMode === "live" 
              ? "bg-blue-100 text-blue-700 pointer-events-none" 
              : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            }`}
           >
              <Activity className="w-4 h-4" /> Live Feed (50 Terbaru)
           </button>
           <button
            onClick={() => setFilterMode("date")}
            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${
              filterMode === "date" 
              ? "bg-blue-100 text-blue-700 pointer-events-none" 
              : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            }`}
           >
              <Calendar className="w-4 h-4" /> Filter Waktu
           </button>
        </div>
      </div>

      {filterMode === "date" && (
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm">
          <form onSubmit={handleSearchDate} className="flex flex-col md:flex-row gap-4 items-end">
             <div className="w-full md:w-auto flex-1 space-y-1.5">
               <label className="text-sm font-medium text-neutral-700">Tanggal Mulai</label>
               <input 
                 type="date"
                 value={startDate}
                 onChange={e => setStartDate(e.target.value)}
                 className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
               />
             </div>
             
             <div className="w-full md:w-auto flex-1 space-y-1.5">
               <label className="text-sm font-medium text-neutral-700">Tanggal Selesai</label>
               <input 
                 type="date"
                 value={endDate}
                 onChange={e => setEndDate(e.target.value)}
                 className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
               />
             </div>
             
             <button
               type="submit"
               className="w-full md:w-auto h-10 px-6 bg-neutral-900 text-white rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
             >
                <Search className="w-4 h-4" /> Terapkan Filter
             </button>
          </form>
        </div>
      )}

      {filterMode === "live" && (
        <div className="flex items-center gap-2 text-sm mb-4 px-1 text-emerald-600 bg-emerald-50 w-max py-1.5 px-3 rounded-full border border-emerald-100">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Mendengarkan scan secara real-time...
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="bg-neutral-50 text-neutral-500 font-medium border-b border-neutral-200">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Waktu Scan</th>
                <th className="px-6 py-4">Alias Tag</th>
                <th className="px-6 py-4">Nama Produk</th>
                <th className="px-6 py-4 whitespace-nowrap">Harga Tercatat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-neutral-400">
                    <div className="flex flex-col items-center gap-3">
                       <History className="w-8 h-8 text-neutral-300" />
                       <p>Belum ada riwayat scan yang ditemukan.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map(({ key, log }) => {
                  const date = new Date(log.timestamp * 1000);
                  return (
                    <tr key={key} className="hover:bg-neutral-50/50 transition-colors animate-in fade-in slide-in-from-top-1">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-neutral-900">{format(date, "dd MMM yyyy", { locale: id })}</span>
                        <span className="text-neutral-500 ml-2 font-mono text-xs">{format(date, "HH:mm:ss")}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-100 text-neutral-700 font-medium font-mono text-xs border border-neutral-200 block w-max">
                          {log.alias}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-neutral-900">{log.product_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-neutral-700">
                        Rp {log.price.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

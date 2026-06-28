"use client";

import { useEffect, useState, useMemo } from "react";
import { listenTags } from "@/lib/tags";
import { listenDeviceState, isDeviceOnline, setSystemMode, clearPendingUid } from "@/lib/device";
import { listenLogsByDateRange } from "@/lib/logs";
import type { TagsRecord, DeviceState, ScanLog, OrdersRecord } from "@/types";
import { listenOrders } from "@/lib/orders";
import { Tags, Tag, Activity, Wifi, WifiOff, RefreshCw } from "lucide-react";

export default function DashboardPage() {
  const [tags, setTags] = useState<TagsRecord>({});
  const [deviceState, setDeviceState] = useState<DeviceState | null>(null);
  const [todayScans, setTodayScans] = useState<Record<string, ScanLog>>({});
  const [orders, setOrders] = useState<OrdersRecord>({});
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const unsubTags = listenTags(setTags);
    const unsubDevice = listenDeviceState(setDeviceState);
    const unsubOrders = listenOrders(setOrders);

    // Get today's bounds
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const unsubLogs = listenLogsByDateRange(
      Math.floor(startOfDay.getTime() / 1000),
      Math.floor(endOfDay.getTime() / 1000),
      (logsRecord) => {
        setTodayScans(logsRecord);
      }
    );

    return () => {
      unsubTags();
      unsubDevice();
      unsubLogs();
      unsubOrders();
    };
  }, []);

  const isOnline = isDeviceOnline(deviceState);
  
  const tagsList = Object.values(tags);
  const tagTersedia = tagsList.filter((t) => t.is_active).length;
  const tagTerpakai = tagsList.filter((t) => !t.is_active).length;
  const totalScans = Object.keys(todayScans).length;

  const stats = [
    {
      name: "Tag Tersedia",
      value: tagTersedia,
      icon: Tags,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      name: "Tag Terpakai",
      value: tagTerpakai,
      icon: Tag,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
    {
      name: "Total Scan Hari Ini",
      value: totalScans,
      icon: Activity,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      name: "Status Perangkat",
      value: isOnline ? "Online" : "Offline",
      icon: isOnline ? Wifi : WifiOff,
      color: isOnline ? "text-emerald-600" : "text-red-500",
      bgColor: isOnline ? "bg-emerald-100" : "bg-red-100",
    },
  ];

  async function handleResetDevice() {
    setResetting(true);
    try {
      await setSystemMode("STANDBY");
      await clearPendingUid();
    } catch (err) {
      alert("Gagal mereset perangkat");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Dashboard Overview</h1>
        <p className="text-neutral-500">Pantau status perangkat dan penggunaan RFID tag secara real-time.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm flex items-center shadow-sm">
            <div className={`p-3 rounded-lg ${stat.bgColor} mr-4`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">{stat.name}</p>
              <h3 className={`text-2xl font-bold ${typeof stat.value === 'string' && stat.value === 'Offline' ? 'text-red-600' : 'text-neutral-900'}`}>
                {stat.value}
              </h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LCD Monitor Simulation */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="px-6 py-5 border-b border-neutral-200 flex justify-between items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Monitor LCD Real-time</h2>
              <p className="text-sm text-neutral-500">Tampilan aktual pada layar perangkat ESP32</p>
            </div>
            <button
              onClick={handleResetDevice}
              disabled={resetting || !isOnline}
              title="Paksa kembali ke mode Standby/Scan"
              className="flex-shrink-0 px-3 py-1.5 flex items-center gap-2 text-sm font-medium bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 hover:text-blue-600 disabled:opacity-50 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${resetting ? "animate-spin text-blue-600" : ""}`} />
              <span className="hidden sm:inline">{resetting ? "Mereset..." : "Reset Mode"}</span>
            </button>
          </div>
          <div className="p-6 flex-1 flex flex-col justify-center items-center bg-neutral-50">
            <div className="relative w-full max-w-sm">
              <div className="bg-green-900 rounded-lg p-6 font-mono text-green-300 shadow-inner overflow-hidden border-4 border-neutral-800">
                <div className="relative z-10 flex flex-col space-y-4">
                  <p className="text-xl tracking-wider truncate border-b border-green-800/30 pb-2">
                    {deviceState?.lcd_line1 ?? "---"}
                  </p>
                  <p className="text-xl tracking-wider truncate">
                    {deviceState?.lcd_line2 ?? "---"}
                  </p>
                </div>
                
                {/* Overlay offline state */}
                {!isOnline && (
                  <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm z-20 flex items-center justify-center">
                    <p className="px-4 py-2 bg-red-600 text-white font-bold rounded shadow-lg animate-pulse">
                      Perangkat Offline
                    </p>
                  </div>
                )}
              </div>
            </div>
            {deviceState && (
              <p className="mt-4 text-xs text-neutral-400">
                Update terakhir: {new Date(deviceState.last_heartbeat * 1000).toLocaleTimeString("id-ID")}
              </p>
            )}
          </div>
        </div>

        {/* Quick Help Guide */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div className="px-6 py-5 border-b border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900">Panduan Cepat</h2>
          </div>
          <div className="p-6 space-y-4 text-sm text-neutral-600">
            <div className="flex gap-3">
              <div className="bg-blue-100 text-blue-600 p-1.5 rounded h-fit">1</div>
              <div>
                <strong className="text-neutral-900 block">Registrasi Tag Baru</strong>
                <p>Gunakan menu "Registrasi Tag" ketika ingin mendaftarkan sticker RFID kosong yang belum terdata di sistem.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="bg-blue-100 text-blue-600 p-1.5 rounded h-fit">2</div>
              <div>
                <strong className="text-neutral-900 block">Mengubah Harga/Barang</strong>
                <p>Pergi ke menu "Produk" dan klik "Ubah Barang" pada tag yang diinginkan. Tidak perlu mendaftarkan ulang tag tersebut.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="bg-blue-100 text-blue-600 p-1.5 rounded h-fit">3</div>
              <div>
                <strong className="text-neutral-900 block">Perangkat Offline?</strong>
                <p>Pastikan ESP32 terhubung dengan power (USB) dan berada di jangkauan sinyal WiFi yang telah diatur (hotspot).</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

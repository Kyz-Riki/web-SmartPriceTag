"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  setDeviceMode,
  listenDeviceState,
  clearPendingUid,
  isDeviceOnline,
} from "@/lib/device";
import { listenTags, toggleTagStatus } from "@/lib/tags";
import type { DeviceState, Tag, TagsRecord } from "@/types";
import Link from "next/link";
import {
  ScanBarcode,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Tag as TagIcon,
  XCircle,
  ShieldQuestion,
  ArrowRight,
  RotateCcw,
  StopCircle,
  Package,
  DollarSign,
  Hash,
  Clock,
  Pencil,
  Power,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────

interface ScanResult {
  uid: string;
  registered: boolean;
  tag: Tag | null;
  scannedAt: Date;
}

// ── Component ──────────────────────────────────────────

export default function ScanTagPage() {
  // ── State ──────────────────────────────────────────
  const [deviceState, setDeviceState] = useState<DeviceState | null>(null);
  const [tags, setTags] = useState<TagsRecord>({});

  // Scan flow states
  const [scanning, setScanning] = useState(false);
  const [currentResult, setCurrentResult] = useState<ScanResult | null>(null);
  const [sessionHistory, setSessionHistory] = useState<ScanResult[]>([]);

  // Toggling status
  const [togglingUid, setTogglingUid] = useState<string | null>(null);

  // Track if we activated register mode
  const activatedRef = useRef(false);
  const processedUidRef = useRef<string | null>(null);

  // ── Subscriptions ──────────────────────────────────
  useEffect(() => {
    const unsubDevice = listenDeviceState(setDeviceState);
    const unsubTags = listenTags(setTags);

    return () => {
      unsubDevice();
      unsubTags();
      // Cleanup: reset ESP32 ke standby
      if (activatedRef.current) {
        setDeviceMode("standby").catch(() => {});
        clearPendingUid().catch(() => {});
        activatedRef.current = false;
      }
    };
  }, []);

  // ── Detect pending_uid changes ─────────────────────
  useEffect(() => {
    if (!scanning) return;
    if (!deviceState?.pending_uid) return;

    const uid = deviceState.pending_uid;

    // Prevent processing same UID twice
    if (processedUidRef.current === uid) return;
    processedUidRef.current = uid;

    // Lookup tag in current tags data
    const tagData = tags[uid] ?? null;
    const result: ScanResult = {
      uid,
      registered: tagData !== null,
      tag: tagData,
      scannedAt: new Date(),
    };

    setCurrentResult(result);
    setSessionHistory((prev) => [result, ...prev]);
    setScanning(false);

    // Clear pending_uid but keep mode for potential re-scan
    clearPendingUid().catch(() => {});
  }, [deviceState?.pending_uid, scanning, tags]);

  const isOnline = isDeviceOnline(deviceState);

  // ── Handlers ───────────────────────────────────────

  const handleStartScan = useCallback(async () => {
    setCurrentResult(null);
    processedUidRef.current = null;
    setScanning(true);

    try {
      await setDeviceMode("register");
      activatedRef.current = true;
    } catch {
      setScanning(false);
    }
  }, []);

  const handleScanAgain = useCallback(async () => {
    setCurrentResult(null);
    processedUidRef.current = null;
    setScanning(true);

    try {
      await clearPendingUid();
      await setDeviceMode("register");
      activatedRef.current = true;
    } catch {
      setScanning(false);
    }
  }, []);

  const handleFinish = useCallback(async () => {
    setScanning(false);
    setCurrentResult(null);
    processedUidRef.current = null;

    try {
      await setDeviceMode("standby");
      await clearPendingUid();
    } catch {
      // silent
    }
    activatedRef.current = false;
  }, []);

  const handleToggleStatus = useCallback(
    async (uid: string, currentActive: boolean) => {
      const action = currentActive
        ? "menonaktifkan (terjual)"
        : "mengaktifkan (tersedia)";
      if (!confirm(`Yakin ingin ${action} tag ini?`)) return;

      setTogglingUid(uid);
      try {
        await toggleTagStatus(uid);
        // Refresh current result with updated tag data
        setCurrentResult((prev) => {
          if (!prev || prev.uid !== uid) return prev;
          const updatedTag = prev.tag
            ? { ...prev.tag, is_active: !prev.tag.is_active }
            : null;
          return { ...prev, tag: updatedTag };
        });
      } catch (err: any) {
        alert("Gagal mengubah status: " + err.message);
      } finally {
        setTogglingUid(null);
      }
    },
    []
  );

  // ── Render ─────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Scan Tag
        </h1>
        <p className="text-neutral-500">
          Scan tag RFID untuk memeriksa status registrasi dan ketersediaan
          barang.
        </p>
      </div>

      {/* ESP32 Status Bar */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neutral-100 rounded-lg">
            <ScanBarcode className="w-5 h-5 text-neutral-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-900">
              Perangkat ESP32
            </p>
            <div className="flex items-center gap-2">
              <span
                className={`flex w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`}
              />
              <span className="text-xs text-neutral-500">
                {isOnline ? "Terhubung" : "Tidak Terhubung"}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-neutral-900">Status Mode</p>
          <span className="inline-flex items-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium bg-neutral-100 text-neutral-600 capitalize">
            {deviceState?.mode || "Unknown"}
          </span>
        </div>
      </div>

      {/* Offline Warning */}
      {!isOnline && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">
              Perangkat sedang OFFLINE
            </h4>
            <p className="text-sm mt-1">
              Anda tidak dapat melakukan scan saat ini. Pastikan ESP32 menyala
              dan terhubung ke WiFi.
            </p>
          </div>
        </div>
      )}

      {/* Main Scan Area */}
      {isOnline && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
          {/* Idle — Ready to Scan */}
          {!scanning && !currentResult && (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                <ScanBarcode className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">
                Siap Melakukan Scan
              </h3>
              <p className="text-neutral-500 max-w-sm mb-8">
                Klik tombol di bawah untuk memulai proses scan. Perangkat ESP32
                akan masuk ke mode pembacaan tag.
              </p>
              <button
                onClick={handleStartScan}
                className="inline-flex items-center justify-center gap-2 h-11 px-8 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                <ScanBarcode className="w-5 h-5" />
                Mulai Scan Tag
              </button>
            </div>
          )}

          {/* Scanning — Waiting for tag */}
          {scanning && !currentResult && (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 relative">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                {/* Pulse ring */}
                <span className="absolute inset-0 rounded-full border-2 border-blue-300 animate-ping opacity-30" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">
                Menunggu Scan...
              </h3>
              <p className="text-neutral-500 max-w-sm mb-8">
                Tempelkan sticker RFID ke sensor pada perangkat ESP32.
              </p>
              <button
                onClick={handleFinish}
                className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                <StopCircle className="w-4 h-4" />
                Batal
              </button>
            </div>
          )}

          {/* Result — Tag Found */}
          {currentResult && (
            <div className="animate-fadeIn">
              {/* Result Header */}
              <div
                className={`px-6 py-4 border-b flex items-center gap-3 ${
                  currentResult.registered
                    ? currentResult.tag?.is_active
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                    : "bg-amber-50 border-amber-200"
                }`}
              >
                {currentResult.registered ? (
                  currentResult.tag?.is_active ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600" />
                  )
                ) : (
                  <ShieldQuestion className="w-6 h-6 text-amber-600" />
                )}
                <div>
                  <h3
                    className={`font-bold text-sm ${
                      currentResult.registered
                        ? currentResult.tag?.is_active
                          ? "text-green-800"
                          : "text-red-800"
                        : "text-amber-800"
                    }`}
                  >
                    {currentResult.registered
                      ? currentResult.tag?.is_active
                        ? "Tag Terdaftar — Tersedia"
                        : "Tag Terdaftar — Terjual"
                      : "Tag Belum Terdaftar"}
                  </h3>
                  <p
                    className={`text-xs ${
                      currentResult.registered
                        ? currentResult.tag?.is_active
                          ? "text-green-600"
                          : "text-red-600"
                        : "text-amber-600"
                    }`}
                  >
                    Discan pada{" "}
                    {currentResult.scannedAt.toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {/* Result Body */}
              <div className="p-6">
                {/* Tag UID */}
                <div className="mb-6 p-4 bg-neutral-50 rounded-lg border border-neutral-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-neutral-200 rounded-md">
                      <TagIcon className="w-5 h-5 text-neutral-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        Tag UID
                      </p>
                      <p className="font-mono text-lg font-bold text-neutral-900">
                        {currentResult.uid}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Registered Tag Info */}
                {currentResult.registered && currentResult.tag && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-neutral-50 border border-neutral-100">
                      <Hash className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-neutral-500">
                          Alias
                        </p>
                        <p className="font-semibold text-neutral-900">
                          {currentResult.tag.alias}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-neutral-50 border border-neutral-100">
                      <Package className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-neutral-500">
                          Nama Produk
                        </p>
                        <p className="font-semibold text-neutral-900">
                          {currentResult.tag.product_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-neutral-50 border border-neutral-100">
                      <DollarSign className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-neutral-500">
                          Harga
                        </p>
                        <p className="font-semibold text-neutral-900">
                          Rp{" "}
                          {currentResult.tag.price.toLocaleString("id-ID")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Extra Info for Registered Tag */}
                {currentResult.registered && currentResult.tag && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                      <Clock className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                      <div className="text-sm">
                        <span className="text-neutral-500">
                          Terakhir di-scan:{" "}
                        </span>
                        <span className="font-medium text-neutral-700">
                          {currentResult.tag.last_scanned_at
                            ? new Date(
                                currentResult.tag.last_scanned_at * 1000
                              ).toLocaleString("id-ID")
                            : "Belum pernah"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                      <ScanBarcode className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                      <div className="text-sm">
                        <span className="text-neutral-500">
                          Total scan:{" "}
                        </span>
                        <span className="font-medium text-neutral-700">
                          {currentResult.tag.scan_count}x
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Unregistered Tag Message */}
                {!currentResult.registered && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <strong>Tag ini belum terdaftar di sistem.</strong> Anda
                      perlu mendaftarkan tag ini terlebih dahulu melalui
                      halaman Registrasi Tag sebelum bisa digunakan.
                    </p>
                  </div>
                )}

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-neutral-100">
                  {/* Scan Again */}
                  <button
                    onClick={handleScanAgain}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Scan Lagi
                  </button>

                  {/* Finish */}
                  <button
                    onClick={handleFinish}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-neutral-200 text-neutral-600 text-sm font-medium hover:bg-neutral-50 transition-colors"
                  >
                    <StopCircle className="w-4 h-4" />
                    Selesai
                  </button>

                  {/* Context-specific actions */}
                  {!currentResult.registered && (
                    <Link
                      href="/tags/register"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors shadow-sm ml-auto"
                    >
                      Daftarkan Sekarang
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}

                  {currentResult.registered && currentResult.tag && (
                    <div className="flex gap-2 ml-auto">
                      <button
                        onClick={() =>
                          handleToggleStatus(
                            currentResult.uid,
                            currentResult.tag!.is_active
                          )
                        }
                        disabled={togglingUid === currentResult.uid}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors shadow-sm ${
                          currentResult.tag.is_active
                            ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                            : "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                        } disabled:opacity-50`}
                      >
                        {togglingUid === currentResult.uid ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Power className="w-4 h-4" />
                        )}
                        {currentResult.tag.is_active
                          ? "Set Terjual"
                          : "Set Tersedia"}
                      </button>
                      <Link
                        href="/products"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-neutral-100 text-neutral-700 text-sm font-medium hover:bg-neutral-200 transition-colors border border-neutral-200"
                      >
                        <Pencil className="w-4 h-4" />
                        Ubah Barang
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Session Scan History */}
      {sessionHistory.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">
                Riwayat Scan Sesi Ini
              </h2>
              <p className="text-sm text-neutral-500">
                {sessionHistory.length} tag telah di-scan
              </p>
            </div>
            <button
              onClick={() => setSessionHistory([])}
              className="text-xs font-medium text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Bersihkan
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-600">
              <thead className="bg-neutral-50 text-neutral-500 font-medium border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-3 whitespace-nowrap">No</th>
                  <th className="px-6 py-3 whitespace-nowrap">UID</th>
                  <th className="px-6 py-3 whitespace-nowrap">
                    Alias / Status
                  </th>
                  <th className="px-6 py-3 whitespace-nowrap">Status</th>
                  <th className="px-6 py-3 whitespace-nowrap">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {sessionHistory.map((item, idx) => (
                  <tr
                    key={`${item.uid}-${idx}`}
                    className="hover:bg-neutral-50/50 transition-colors"
                  >
                    <td className="px-6 py-3 text-neutral-400 tabular-nums">
                      {sessionHistory.length - idx}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-neutral-700">
                      {item.uid}
                    </td>
                    <td className="px-6 py-3">
                      {item.registered && item.tag ? (
                        <span className="font-medium text-neutral-900">
                          {item.tag.alias}
                        </span>
                      ) : (
                        <span className="text-amber-600 text-xs font-medium">
                          Belum Terdaftar
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      {item.registered ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.tag?.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {item.tag?.is_active ? "Tersedia" : "Terjual"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          Tidak Dikenal
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-neutral-500 tabular-nums">
                      {item.scannedAt.toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

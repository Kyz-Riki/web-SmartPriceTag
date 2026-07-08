"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { setSystemMode, listenDeviceState, clearPendingUid, isDeviceOnline } from "@/lib/device";
import { registerTag, listenTags } from "@/lib/tags";
import type { DeviceState, TagsRecord } from "@/types";
import { useRouter } from "next/navigation";
import { ScanBarcode, AlertCircle, CheckCircle2, Loader2, Tag, ChevronRight } from "lucide-react";

export default function RegisterTagPage() {
  const router = useRouter();
  
  const [deviceState, setDeviceState] = useState<DeviceState | null>(null);
  const [tags, setTags] = useState<TagsRecord>({});
  
  const [detectedUid, setDetectedUid] = useState<string | null>(null);
  
  const [alias, setAlias] = useState("");
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to track if we activated register mode (for cleanup on unmount)
  const activatedRegisterRef = useRef(false);
  // Ref to track detectedUid without stale closure
  const detectedUidRef = useRef<string | null>(null);

  // Keep ref in sync
  useEffect(() => {
    detectedUidRef.current = detectedUid;
  }, [detectedUid]);

  // Subscribe to device state and tags (to check alias duplication)
  useEffect(() => {
    const unsubDevice = listenDeviceState((state) => {
      setDeviceState(state);
      if (state?.pending_uid) {
        setDetectedUid(state.pending_uid);
      } else if (!detectedUidRef.current) {
        // Only clear if we haven't already detected a UID for registration
        setDetectedUid(null);
      }
    });

    const unsubTags = listenTags(setTags);

    // Cleanup: reset ESP32 ke standby saat user meninggalkan halaman
    return () => {
      unsubDevice();
      unsubTags();
      // Auto-reset mode ke standby jika kita yang mengaktifkan register mode
      if (activatedRegisterRef.current) {
        setSystemMode("STANDBY").catch(() => {});
        activatedRegisterRef.current = false;
      }
    };
  }, []);

  const isOnline = isDeviceOnline(deviceState);
  const isRegisterMode = deviceState?.system_mode === "ADMIN";

  async function handleStartScan() {
    setError(null);
    try {
      await setSystemMode("ADMIN");
      activatedRegisterRef.current = true;
      setDetectedUid(null);
    } catch (err: any) {
      setError("Gagal mengaktifkan mode scan. Coba lagi.");
    }
  }

  async function handleCancel() {
    try {
      // Eksplisit set mode ke standby DAN clear pending_uid
      await setSystemMode("STANDBY");
      await clearPendingUid();
    } catch (err) {
      console.error("Gagal reset mode:", err);
    }
    activatedRegisterRef.current = false;
    setDetectedUid(null);
    setAlias("");
    setProductName("");
    setPrice("");
    setError(null);
  }

  async function handleScanUlang() {
    try {
      await clearPendingUid();
      setDetectedUid(null);
    } catch (err) {
      console.error("Gagal scan ulang:", err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!detectedUid) {
      setError("UID belum terdeteksi.");
      return;
    }

    // Validation
    const aliasRegex = /^Tag-\d{2,}$/;
    if (!aliasRegex.test(alias)) {
      setError("Format Alias harus Tag-XX (contoh: Tag-01).");
      return;
    }

    const isAliasUsed = Object.values(tags).some(
      (t) => t.alias.toLowerCase() === alias.toLowerCase()
    );
    if (isAliasUsed) {
      setError(`Alias ${alias} sudah digunakan oleh tag lain.`);
      return;
    }

    if (productName.trim().length < 3) {
      setError("Nama barang minimal 3 karakter.");
      return;
    }

    const priceNum = parseInt(price, 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError("Harga harus angka positif.");
      return;
    }

    setLoading(true);
    try {
      // Register tag
      await registerTag(detectedUid, alias, productName, priceNum);
      
      // Cleanup device state — pastikan mode kembali ke standby
      await clearPendingUid();
      await setSystemMode("STANDBY");
      activatedRegisterRef.current = false;
      
      // Redirect to products/tags
      router.push("/products");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal menyimpan tag baru.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Registrasi Tag Baru</h1>
        <p className="text-neutral-500">Daftarkan sticker RFID ke dalam sistem untuk digunakan pada barang.</p>
      </div>

      {/* Status Bar */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neutral-100 rounded-lg">
            <ScanBarcode className="w-5 h-5 text-neutral-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-900">Perangkat ESP32</p>
            <div className="flex items-center gap-2">
              <span className={`flex w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`}></span>
              <span className="text-xs text-neutral-500">{isOnline ? "Terhubung" : "Tidak Terhubung"}</span>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm font-medium text-neutral-900">Status Mode</p>
          <span className="inline-flex items-center gap-1.5 py-1 px-2 rounded-md text-xs font-medium bg-neutral-100 text-neutral-600 capitalize">
            {deviceState?.system_mode || "Unknown"}
          </span>
        </div>
      </div>

      {!isOnline && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Perangkat sedang OFFLINE</h4>
            <p className="text-sm mt-1">Anda tidak dapat melakukan registrasi tag saat ini. Pastikan alat menyala dan terhubung ke WiFi.</p>
          </div>
        </div>
      )}

      {/* Main Registration Flow */}
      {isOnline && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {/* Step 1: Waiting / Scanning */}
          {!detectedUid ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                {isRegisterMode ? (
                   <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                ) : (
                   <ScanBarcode className="w-10 h-10 text-blue-600" />
                )}
              </div>
              
              {isRegisterMode ? (
                <>
                  <h3 className="text-xl font-bold text-neutral-900 mb-2">Menunggu Scan...</h3>
                  <p className="text-neutral-500 max-w-sm mb-8">
                    Silakan tempelkan sticker RFID ke sensor pada perangkat ESP32 sekarang.
                  </p>
                  <button
                    onClick={handleCancel}
                    className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                  >
                    Batal
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-neutral-900 mb-2">Siap Melakukan Scan</h3>
                  <p className="text-neutral-500 max-w-sm mb-8">
                    Klik tombol di bawah ini untuk memulai proses registrasi. Perangkat ESP32 akan masuk ke mode pendaftaran.
                  </p>
                  <button
                    onClick={handleStartScan}
                    className="inline-flex items-center justify-center h-11 px-8 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                  >
                    Mulai Scan Tag
                  </button>
                </>
              )}
            </div>
          ) : tags[detectedUid] ? (
            /* Step 1.5: Validation Error (Tag Already Exists) */
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Tag Sudah Terdaftar!</h3>
              <p className="text-neutral-500 max-w-sm mb-2">
                Tag dengan UID <strong className="font-mono">{detectedUid}</strong> sudah terdaftar sebagai <strong>{tags[detectedUid].product_name}</strong>.
              </p>
              <p className="text-sm text-neutral-400 mb-8">
                Gunakan menu Produk jika ingin mengubah harga atau nama barang dari tag ini.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={handleCancel}
                  className="inline-flex items-center justify-center h-11 px-6 rounded-md bg-white border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 transition-colors"
                >
                  Batal (Standby)
                </button>
                <button
                  onClick={handleScanUlang}
                  className="inline-flex items-center justify-center h-11 px-6 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                >
                  Scan Ulang
                </button>
              </div>
            </div>
          ) : (
            /* Step 2: Form Input */
            <div className="flex flex-col md:flex-row">
              <div className="bg-neutral-50 p-6 md:p-8 md:w-1/3 border-b md:border-b-0 md:border-r border-neutral-200 flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                <h3 className="text-lg font-bold text-neutral-900 mb-1">Tag Terdeteksi</h3>
                <p className="text-sm text-neutral-500 mb-4">Silakan lengkapi data barang untuk tag ini.</p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-200 border border-neutral-300 rounded font-mono text-neutral-700 text-sm">
                  <Tag className="w-4 h-4" />
                  {detectedUid}
                </div>
              </div>
              
              <div className="p-6 md:p-8 md:w-2/3">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="bg-red-50 text-red-600 px-4 py-3 rounded-md text-sm border border-red-100 flex items-center gap-2">
                       <AlertCircle className="w-4 h-4" /> {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-900">Alias Tag</label>
                    <input
                      type="text"
                      required
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      placeholder="Tag-01"
                      className="flex h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-neutral-500">Nama unik untuk mengenali fisik tag ini. Contoh: Tag-01</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-900">Nama Barang Baru</label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="Kemeja Flanel"
                      className="flex h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-900">Harga (Rp)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="199000"
                      className="flex h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-neutral-500">Masukkan angka saja. Rp {parseInt(price || "0").toLocaleString("id-ID")}</p>
                  </div>

                  <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-100">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleCancel}
                      className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Simpan Tag Baru
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

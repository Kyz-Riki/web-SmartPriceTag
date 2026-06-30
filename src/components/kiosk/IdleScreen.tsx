"use client";

import { Scan, LogOut } from "lucide-react";
import { useState } from "react";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface IdleScreenProps {
  onStartCheckout?: () => void;
  onCancelCheckout?: () => void;
  isScanning?: boolean;
}

export default function IdleScreen({ onStartCheckout, onCancelCheckout, isScanning = false }: IdleScreenProps) {
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const handleStartConfirm = () => {
    setStartModalOpen(false);
    onStartCheckout?.();
  };

  const handleCancelConfirm = () => {
    setCancelModalOpen(false);
    onCancelCheckout?.();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Ikon scan dengan animasi pulse */}
      <div className={`mb-8 ${isScanning ? "animate-bounce" : "animate-pulse"}`}>
        <div className="bg-blue-600 rounded-full p-8 shadow-xl border-4 border-blue-500/30">
          <Scan className="w-16 h-16 text-white" />
        </div>
      </div>

      <h1 className="text-4xl lg:text-5xl font-bold text-neutral-900 mb-4 text-center tracking-tight">
        {isScanning ? "Siap Melakukan Scan" : "Selamat Datang"}
      </h1>
      <p className="text-xl text-neutral-500 text-center max-w-md mb-8">
        {isScanning
          ? "Silakan tempelkan tag RFID barang Anda ke perangkat ESP32"
          : "Tekan tombol di bawah untuk mulai berbelanja"}
      </p>
      
      {!isScanning && onStartCheckout && (
        <button
          onClick={() => setStartModalOpen(true)}
          className="px-8 py-4 bg-blue-600 text-white text-xl font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-colors"
        >
          Mulai Sesi Checkout
        </button>
      )}

      {isScanning && onCancelCheckout && (
        <button
          onClick={() => setCancelModalOpen(true)}
          className="px-6 py-3 mt-4 bg-red-100 text-red-600 text-lg font-semibold rounded-xl shadow hover:bg-red-200 transition-colors flex items-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Batal & Keluar
        </button>
      )}

      <ConfirmModal
        isOpen={startModalOpen}
        title="Mulai Sesi Checkout"
        message="Apakah Anda yakin ingin memulai sesi belanja sekarang?"
        confirmText="Mulai Belanja"
        cancelText="Batal"
        onConfirm={handleStartConfirm}
        onCancel={() => setStartModalOpen(false)}
        variant="info"
      />

      <ConfirmModal
        isOpen={cancelModalOpen}
        title="Batalkan Sesi"
        message="Apakah Anda yakin ingin membatalkan sesi ini dan kembali ke awal?"
        confirmText="Ya, Keluar"
        cancelText="Kembali"
        onConfirm={handleCancelConfirm}
        onCancel={() => setCancelModalOpen(false)}
        variant="danger"
      />
    </div>
  );
}

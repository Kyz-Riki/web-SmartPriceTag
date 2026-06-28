"use client";

import { Scan } from "lucide-react";

interface IdleScreenProps {
  onStartCheckout?: () => void;
}

export default function IdleScreen({ onStartCheckout }: IdleScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Ikon scan dengan animasi pulse */}
      <div className="animate-pulse mb-8">
        <div className="bg-blue-600 rounded-full p-8 shadow-xl border-4 border-blue-500/30">
          <Scan className="w-16 h-16 text-white" />
        </div>
      </div>

      <h1 className="text-4xl lg:text-5xl font-bold text-neutral-900 mb-4 text-center tracking-tight">
        Selamat Datang
      </h1>
      <p className="text-xl text-neutral-500 text-center max-w-md mb-8">
        Tekan tombol di bawah untuk mulai berbelanja
      </p>
      
      {onStartCheckout && (
        <button
          onClick={onStartCheckout}
          className="px-8 py-4 bg-blue-600 text-white text-xl font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-colors"
        >
          Mulai Sesi Checkout
        </button>
      )}
    </div>
  );
}

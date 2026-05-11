"use client";

import { Scan } from "lucide-react";

export default function IdleScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Ikon scan dengan animasi pulse */}
      <div className="animate-pulse mb-8">
        <div className="bg-blue-600 rounded-full p-8 shadow-xl border-4 border-blue-500/30">
          <Scan className="w-16 h-16 text-white" />
        </div>
      </div>

      <h1 className="text-4xl lg:text-5xl font-bold text-neutral-900 mb-4 text-center tracking-tight">
        Silakan Scan Barang
      </h1>
      <p className="text-xl text-neutral-500 text-center max-w-md">
        Tempelkan tag RFID ke reader untuk mulai belanja
      </p>
    </div>
  );
}

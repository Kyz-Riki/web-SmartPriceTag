"use client";

import { useEffect } from "react";
import { CheckCircle } from "lucide-react";
import type { CartItem } from "@/types";

interface ScanFeedbackProps {
  item: CartItem;
  onDone: () => void; // Dipanggil setelah 1.5 detik
}

export default function ScanFeedback({ item, onDone }: ScanFeedbackProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-emerald-600 text-white animate-fadeIn">
      <CheckCircle className="w-24 h-24 mb-6 text-white drop-shadow-md animate-bounce" />
      <p className="text-2xl font-medium mb-3 opacity-90 tracking-wide">Barang Ditambahkan!</p>
      <h2 className="text-5xl lg:text-6xl font-bold mb-6 text-center px-8 tracking-tight drop-shadow-lg">
        {item.product_name}
      </h2>
      <div className="bg-emerald-700/50 backdrop-blur-sm px-8 py-4 rounded-2xl border border-emerald-500/30">
        <p className="text-4xl font-bold drop-shadow-md">
          Rp {item.price.toLocaleString("id-ID")}
        </p>
      </div>
    </div>
  );
}

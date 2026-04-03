import Link from "next/link";
import { Tag, ArrowRight, Zap, Shield, Smartphone } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 font-sans text-neutral-900">
      {/* Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-2 font-bold text-xl text-blue-600">
          <Tag className="w-6 h-6" />
          <span>SmartPT</span>
        </div>
        <Link href="/login" className="text-sm font-medium text-neutral-600 hover:text-blue-600 transition-colors">
          Admin Login
        </Link>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center text-center px-4 pt-20 pb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-full mb-8 border border-blue-100">
          <span className="flex h-2 w-2 rounded-full bg-blue-600"></span>
          <span>Sistem IoT Terintegrasi</span>
        </div>
        
        <h1 className="max-w-3xl text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-neutral-900 mb-6 !leading-tight">
          Manajemen Harga Pintar <br className="hidden md:block"/>
          <span className="text-blue-600">Terpusat & Real-time</span>
        </h1>
        
        <p className="max-w-2xl text-lg text-neutral-500 mb-10 leading-relaxed">
          Ubah harga tanpa menukar label fisik. Gunakan kekuatan RFID dan ESP32 untuk memperbarui informasi produk dan harga secara seketika dari satu dashboard terpusat.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 w-full sm:w-auto text-lg"
          >
            Masuk ke Dashboard
            <ArrowRight className="w-5 h-5" />
          </Link>
          <a
            href="#features"
            className="flex items-center justify-center h-12 px-8 rounded-full bg-white border border-neutral-200 text-neutral-700 font-medium hover:bg-neutral-50 transition-colors w-full sm:w-auto text-lg"
          >
            Pelajari Fitur
          </a>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="bg-white py-20 px-6 border-t border-neutral-200">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-neutral-900">Kenapa Menggunakan Smart Price Tag?</h2>
            <p className="text-neutral-500 max-w-xl mx-auto">Solusi lengkap untuk menghindari inkonsistensi harga di rak penjualan dengan database utama kasir.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-900">Real-time Update</h3>
              <p className="text-neutral-500 leading-relaxed">
                Perubahan pada sistem langsung diaplikasikan pada label tag LCD seketika, mengeliminasi delay manual.
              </p>
            </div>
            <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-900">Data Aman & Tersinkronisasi</h3>
              <p className="text-neutral-500 leading-relaxed">
                Menggunakan struktur Firebase Realtime Database dan perlindungan Auth untuk pengelola toko.
              </p>
            </div>
            <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-900">Manajemen Perangkat</h3>
              <p className="text-neutral-500 leading-relaxed">
                Monitor status semua tag secara berpusat. Pantau alat ketika bermasalah atau mati dari dashboard web.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-neutral-200 px-6 py-8 text-center text-sm text-neutral-400">
        <p>&copy; {new Date().getFullYear()} Smart Price Tag System. Dibuat untuk efisiensi retail cerdas.</p>
      </footer>
    </div>
  );
}

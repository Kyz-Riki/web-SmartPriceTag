"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { onAuthStateChange, signOut } from "@/lib/auth";
import type { User } from "firebase/auth";
import { LayoutDashboard, Tags, History, PlusSquare, LogOut, Menu, X, Tag } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsub = onAuthStateChange((u) => {
      setUser(u);
      setLoading(false);
      if (!u) router.push("/login");
    });
    return () => unsub();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) return null;

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Produk", href: "/products", icon: Tags },
    { name: "Registrasi Tag", href: "/tags/register", icon: PlusSquare },
    { name: "Riwayat Pesanan", href: "/history", icon: History },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-neutral-50">
      {/* Mobile Navbar */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-neutral-200 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 text-blue-600 font-semibold">
          <Tag className="w-6 h-6" />
          <span>Smart Price Tag</span>
        </Link>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-neutral-500">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar (Desktop) / Mobile Drawer */}
      <div
        className={`${
          mobileMenuOpen ? "block" : "hidden"
        } md:block w-full md:w-64 bg-white border-r border-neutral-200 flex-shrink-0 flex flex-col h-[calc(100vh-56px)] md:h-screen sticky top-0`}
      >
        <div className="hidden md:flex items-center gap-2 px-6 py-6 border-b border-neutral-200">
          <div className="bg-blue-600 rounded-md p-1.5 flex items-center justify-center">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-neutral-900 tracking-tight">Smart Price Tag</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-blue-700" : "text-neutral-400"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-200">
          <div className="px-3 py-2 mb-4 text-xs font-medium text-neutral-500 break-all">
            {user.email}
          </div>
          <button
            onClick={async () => {
              await signOut();
            }}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-md justify-start text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5 text-red-500" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

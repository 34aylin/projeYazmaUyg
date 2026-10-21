"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Plus,
  LogOut,
  Cpu,
  Menu,
  X,
  Sliders,
  Check,
  ChevronDown,
  Sparkles,
  Layers,
} from "lucide-react";
import { getUser, removeToken } from "@/lib/auth";
import { STATULER } from "@/lib/fields";
import { useAyarlar, SAGLAYICILAR, EFOR_SEVIYELERI } from "@/lib/ayarlar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileAcik, setMobileAcik] = useState(false);
  const [aiMenuAcik, setAiMenuAcik] = useState(false);
  const [user, setUser] = useState<{ email: string; ad: string; rol: string } | null>(null);
  const { saglayici, setSaglayici, efor, setEfor } = useAyarlar();

  useEffect(() => {
    setUser(getUser());
  }, []);

  function handleLogout() {
    removeToken();
    router.push("/giris");
  }

  const panelActive = pathname === "/panel";
  const yeniActive = pathname === "/yeni";
  const projelerActive = pathname === "/projeler" || pathname.startsWith("/projeler/");

  return (
    <div className="min-h-screen bg-[#F4EFEA] text-[#2C2016] flex flex-col font-sans">
      {/* ── 3D TOP HEADER ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#FFFDF9]/95 backdrop-blur-md border-b-[1.5px] border-[#DFCFC0] px-4 sm:px-8 py-3 shadow-[0_3px_12px_rgba(70,45,20,0.05)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Mark with 3D tactile icon */}
          <Link href="/panel" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-[#2563EB] border-b-2 border-[#1D4ED8] text-white flex items-center justify-center font-bold shadow-xs transition-transform group-hover:scale-105">
              <Sparkles size={18} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-[#2C2016] leading-tight">
                Marta Ar-Ge
              </span>
              <span className="text-[11px] text-[#786655] font-semibold leading-tight">
                Teknopark Başvuru Portalı
              </span>
            </div>
          </Link>

          {/* Central 3D Navigation (Desktop) */}
          <nav className="hidden md:flex items-center gap-1.5 bg-[#EFE7DE] p-1.5 rounded-2xl border-[1.5px] border-[#DFCFC0] shadow-[inset_0_1px_3px_rgba(70,45,20,0.06)]">
            <Link
              href="/panel"
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                panelActive
                  ? "bg-[#2563EB] text-white border-b-2 border-[#1D4ED8] shadow-xs"
                  : "text-[#786655] hover:text-[#2C2016] hover:bg-[#E5DCD0]"
              }`}
            >
              <LayoutDashboard size={14} />
              <span>Panel</span>
            </Link>

            <Link
              href="/projeler"
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                projelerActive && !yeniActive
                  ? "bg-[#2563EB] text-white border-b-2 border-[#1D4ED8] shadow-xs"
                  : "text-[#786655] hover:text-[#2C2016] hover:bg-[#E5DCD0]"
              }`}
            >
              <FolderOpen size={14} />
              <span>Projeler</span>
            </Link>

            <Link
              href="/yeni"
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                yeniActive
                  ? "bg-[#2563EB] text-white border-b-2 border-[#1D4ED8] shadow-xs"
                  : "text-[#2563EB] hover:bg-[#E5DCD0]"
              }`}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Yeni Başvuru</span>
            </Link>
          </nav>

          {/* Right Controls: AI Selector & User Profile */}
          <div className="flex items-center gap-3">
            {/* AI Model Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAiMenuAcik((v) => !v)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EFE7DE] hover:bg-[#E5DCD0] border-[1.5px] border-[#DFCFC0] text-xs font-bold text-[#2C2016] transition-colors cursor-pointer shadow-2xs"
                title="Yapay zekâ modelini değiştir"
              >
                <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                <span className="truncate max-w-[120px]">{saglayici.split(" ")[0]}</span>
                <ChevronDown size={13} className="text-[#786655]" />
              </button>

              {/* AI Dropdown Popover */}
              {aiMenuAcik && (
                <div className="absolute right-0 mt-2 w-64 card-3d p-3 z-50 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#DFCFC0]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#786655] flex items-center gap-1.5">
                      <Cpu size={12} /> Yapay Zekâ Modeli
                    </span>
                    <button
                      onClick={() => setAiMenuAcik(false)}
                      className="text-[#786655] hover:text-[#2C2016]"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {SAGLAYICILAR.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setSaglayici(s);
                          setAiMenuAcik(false);
                        }}
                        className={`w-full flex items-center justify-between text-left text-xs px-2.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                          saglayici === s
                            ? "bg-[#2563EB] text-white"
                            : "text-[#2C2016] hover:bg-[#EFE7DE]"
                        }`}
                      >
                        <span className="truncate">{s}</span>
                        {saglayici === s && <Check size={12} className="text-white" />}
                      </button>
                    ))}
                  </div>

                  {/* Analiz Derinliği */}
                  <div className="pt-2 border-t border-[#DFCFC0]">
                    <div className="flex items-center gap-1 text-[10px] text-[#786655] font-bold uppercase mb-1.5">
                      <Sliders size={10} /> Analiz Derinliği
                    </div>
                    <div className="grid grid-cols-3 gap-1 bg-[#EFE7DE] p-1 rounded-xl border border-[#DFCFC0]">
                      {EFOR_SEVIYELERI.map((e) => (
                        <button
                          key={e.value}
                          onClick={() => setEfor(e.value)}
                          className={`text-[10px] py-1 rounded-lg font-bold text-center transition-colors cursor-pointer ${
                            efor === e.value
                              ? "bg-[#2563EB] text-white"
                              : "text-[#786655] hover:text-[#2C2016]"
                          }`}
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile & Logout */}
            {user && (
              <div className="flex items-center gap-2.5 pl-3 border-l-[1.5px] border-[#DFCFC0]">
                <div className="w-8 h-8 rounded-xl bg-[#2C2016] text-[#FFFDF9] flex items-center justify-center font-bold text-xs shadow-2xs">
                  {user.ad ? user.ad.charAt(0).toUpperCase() : "U"}
                </div>
                <span className="hidden lg:inline text-xs font-bold text-[#2C2016] truncate max-w-[120px]">
                  {user.ad}
                </span>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-xl text-[#786655] hover:text-[#DC2626] hover:bg-rose-100 transition-colors cursor-pointer"
                  title="Çıkış Yap"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileAcik((v) => !v)}
              className="md:hidden p-2 rounded-xl bg-[#EFE7DE] border border-[#DFCFC0] text-[#2C2016]"
              aria-label="Menü"
            >
              {mobileAcik ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── MOBILE MENU OVERLAY ──────────────────────────────────────── */}
      {mobileAcik && (
        <div
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-xs md:hidden"
          onClick={() => setMobileAcik(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#FFFDF9] border-r-[1.5px] border-[#DFCFC0] p-5 flex flex-col shadow-2xl transition-transform duration-300 md:hidden ${
          mobileAcik ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between pb-3.5 border-b border-[#DFCFC0] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#2563EB] text-white flex items-center justify-center font-bold">
              <Sparkles size={16} />
            </div>
            <span className="font-bold text-[#2C2016] text-base">Marta Ar-Ge</span>
          </div>
          <button
            onClick={() => setMobileAcik(false)}
            className="p-1 rounded text-[#786655] hover:text-[#2C2016]"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="space-y-1.5 flex-1">
          <Link
            href="/panel"
            onClick={() => setMobileAcik(false)}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold ${
              panelActive ? "bg-[#2563EB] text-white" : "text-[#786655] hover:bg-[#EFE7DE] hover:text-[#2C2016]"
            }`}
          >
            <LayoutDashboard size={16} />
            <span>Panel</span>
          </Link>

          <Link
            href="/projeler"
            onClick={() => setMobileAcik(false)}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold ${
              projelerActive && !yeniActive ? "bg-[#2563EB] text-white" : "text-[#786655] hover:bg-[#EFE7DE] hover:text-[#2C2016]"
            }`}
          >
            <FolderOpen size={16} />
            <span>Projeler</span>
          </Link>

          <Link
            href="/yeni"
            onClick={() => setMobileAcik(false)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold btn-3d-primary mt-2"
          >
            <Plus size={16} />
            <span>Yeni Başvuru Aç</span>
          </Link>

          {/* Quick status filters */}
          <div className="pt-4 mt-4 border-t border-[#DFCFC0] space-y-1">
            <p className="text-[11px] text-[#786655] font-bold mb-1.5 px-1 uppercase tracking-wider">
              Filtreler
            </p>
            {STATULER.map((s) => (
              <Link
                key={s}
                href={`/projeler?statu=${encodeURIComponent(s)}`}
                onClick={() => setMobileAcik(false)}
                className="flex items-center justify-between text-xs text-[#786655] hover:text-[#2C2016] py-1.5 px-2 rounded-lg hover:bg-[#EFE7DE]"
              >
                <span>{s}</span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="pt-3 border-t border-[#DFCFC0]">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full text-xs font-bold text-[#DC2626] hover:bg-rose-100 py-2.5 rounded-xl transition-colors cursor-pointer border border-rose-200"
          >
            <LogOut size={14} />
            <span>Güvenli Çıkış</span>
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<div className="py-20 text-center text-xs text-[#786655]">Yükleniyor...</div>}>
            {children}
          </Suspense>
        </div>
      </main>
    </div>
  );
}

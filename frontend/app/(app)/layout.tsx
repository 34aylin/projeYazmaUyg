"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FolderOpen, Plus, LogOut, Rocket, User, ChevronDown, ChevronUp } from "lucide-react";
import { getUser, removeToken } from "@/lib/auth";
import { STATULER } from "@/lib/fields";
import { useAyarlar, SAGLAYICILAR, EFOR_SEVIYELERI } from "@/lib/ayarlar";

const STATU_DOT: Record<string, string> = {
  Taslak: "bg-gray-400",
  "Devam Ediyor": "bg-blue-500",
  Başvuruldu: "bg-green-500",
  Arşiv: "bg-orange-400",
};

function SidebarNav() {
  const pathname = usePathname();

  const panelActive = pathname === "/panel";
  const yeniActive = pathname === "/yeni";
  const projelerActive = pathname === "/projeler" || pathname.startsWith("/projeler/");

  return (
    <nav className="flex-1 px-3 py-4 overflow-y-auto">
      {/* Panel */}
      <Link
        href="/panel"
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${
          panelActive ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        <LayoutDashboard size={16} />
        Panel
      </Link>

      {/* Yeni başvuru */}
      <Link
        href="/yeni"
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${
          yeniActive ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        <Plus size={16} />
        Yeni başvuru
      </Link>

      {/* Projelerim + alt statüler */}
      <div className="mt-1">
        <Link
          href="/projeler"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/projeler" ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <FolderOpen size={16} />
          Projelerim
        </Link>

        {/* Statü linkleri — alt alta */}
        <div className="mt-0.5 ml-3 space-y-0.5">
          {STATULER.map((statu) => {
            const dot = STATU_DOT[statu] ?? "bg-gray-400";
            return (
              <Link
                key={statu}
                href={`/projeler?statu=${encodeURIComponent(statu)}`}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                {statu}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Ayarlar bölümü - açık proje varsa göster */}
      {projelerActive && pathname.startsWith("/projeler/") && pathname.split("/").length === 3 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-3 mb-2">Açık proje</p>
          <Link
            href="/projeler"
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ← Projelere dön
          </Link>
        </div>
      )}
    </nav>
  );
}

function AiAyarlari() {
  const { saglayici, setSaglayici, efor, setEfor } = useAyarlar();
  const [acik, setAcik] = useState(false);

  return (
    <div className="border-t border-gray-200 px-3 py-3">
      <button
        onClick={() => setAcik((v) => !v)}
        className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-base leading-none">⚙</span>
          AI Ayarları
        </span>
        {acik ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {acik && (
        <div className="mt-2 space-y-3">
          {/* Sağlayıcı */}
          <div>
            <p className="text-xs text-gray-400 px-2 mb-1.5">Model</p>
            <div className="space-y-0.5">
              {SAGLAYICILAR.map((s) => (
                <button
                  key={s}
                  onClick={() => setSaglayici(s)}
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                    saglayici === s
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Efor */}
          <div>
            <p className="text-xs text-gray-400 px-2 mb-1.5">Analiz derinliği</p>
            <div className="flex gap-1">
              {EFOR_SEVIYELERI.map((e) => (
                <button
                  key={e.value}
                  onClick={() => setEfor(e.value)}
                  className={`flex-1 text-xs py-1.5 rounded-lg transition-colors font-medium ${
                    efor === e.value
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
  );
}

function SidebarFooter() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; ad: string; rol: string } | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  function handleLogout() {
    removeToken();
    router.push("/giris");
  }

  return (
    <div className="border-t border-gray-200 px-4 py-3">
      {user && (
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-indigo-100 text-indigo-600 rounded-full p-1.5 shrink-0">
            <User size={13} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">{user.ad}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
        </div>
      )}
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 w-full text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg px-2 py-1.5 transition-colors"
      >
        <LogOut size={13} />
        Çıkış Yap
      </button>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="fixed inset-y-0 left-0 w-56 bg-white border-r border-gray-200 flex flex-col z-20">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-200">
          <div className="bg-indigo-600 text-white p-1.5 rounded-lg shrink-0">
            <Rocket size={16} />
          </div>
          <span className="font-bold text-gray-900 text-sm leading-tight">
            Teknopark<br />
            <span className="font-normal text-gray-500">Başvuru</span>
          </span>
        </div>

        <Suspense
          fallback={
            <nav className="flex-1 px-3 py-4 space-y-1">
              {["Panel", "Yeni başvuru", "Projelerim"].map((label) => (
                <div key={label} className="h-8 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </nav>
          }
        >
          <SidebarNav />
        </Suspense>

        <AiAyarlari />
        <SidebarFooter />
      </aside>

      <main className="ml-56 flex-1 min-w-0 p-8">{children}</main>
    </div>
  );
}

"use client";

import useSWR from "swr";
import Link from "next/link";
import { Plus, Folder, TrendingUp } from "lucide-react";
import { swrFetcher, Project } from "@/lib/api";
import { STATU_RENKLER, type Statu } from "@/lib/fields";

const STATU_TW: Record<string, string> = {
  gray: "bg-gray-100 text-gray-600",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  orange: "bg-orange-100 text-orange-700",
};

export default function PanelPage() {
  const { data: projeler, isLoading } = useSWR<Project[]>("/projeler", swrFetcher);

  const son5 = projeler
    ? [...projeler].sort((a, b) => b.tarih_iso.localeCompare(a.tarih_iso)).slice(0, 5)
    : [];

  const toplam = projeler?.length ?? 0;
  const devamEdiyor = projeler?.filter((p) => p.statu === "Devam Ediyor").length ?? 0;
  const basvuruldu = projeler?.filter((p) => p.statu === "Başvuruldu").length ?? 0;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel</h1>
          <p className="text-sm text-gray-500 mt-0.5">Teknopark Başvuru Asistanı</p>
        </div>
        <Link
          href="/yeni"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Yeni başvuru
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Toplam Proje", val: toplam, color: "text-gray-900" },
          { label: "Devam Ediyor", val: devamEdiyor, color: "text-blue-600" },
          { label: "Başvuruldu", val: basvuruldu, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{isLoading ? "—" : s.val}</p>
          </div>
        ))}
      </div>

      {/* Recent */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Son Projeler</h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-16 animate-pulse" />
            ))}
          </div>
        ) : son5.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <Folder size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-3">Henüz proje yok.</p>
            <Link href="/yeni" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:underline">
              <Plus size={14} />İlk başvuruyu başlat
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {son5.map((proje) => {
              const renk = STATU_RENKLER[proje.statu as Statu] ?? "gray";
              const tw = STATU_TW[renk];
              const pct = Math.round(proje.doluluk * 100);
              return (
                <Link
                  key={proje.dosya}
                  href={`/projeler/${proje.dosya}`}
                  className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-3.5 hover:border-indigo-300 hover:shadow-sm transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tw}`}>{proje.statu}</span>
                      {proje.proje_kodu && proje.proje_kodu !== "?" && (
                        <span className="text-xs text-gray-400 font-mono">{proje.proje_kodu}</span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900 truncate text-sm">{proje.proje_adi || "İsimsiz proje"}</p>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="text-xs text-gray-400">{proje.tarih}</p>
                    <p className="text-xs text-gray-500 mt-0.5 font-medium">%{pct} dolu</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Plus,
  FolderOpen,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Award,
  Building2,
  FileCheck2,
  Layers,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { swrFetcher, Project } from "@/lib/api";
import { STATU_RENKLER, type Statu } from "@/lib/fields";
import { getUser, UserPayload } from "@/lib/auth";

const STATU_BADGE: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  gray: { bg: "bg-[#EFE7DE]", text: "text-[#786655]", dot: "bg-[#786655]", border: "border-[#DFCFC0]" },
  blue: { bg: "bg-blue-100", text: "text-blue-900", dot: "bg-[#2563EB]", border: "border-blue-300" },
  green: { bg: "bg-emerald-100", text: "text-emerald-900", dot: "bg-[#16A34A]", border: "border-emerald-300" },
  orange: { bg: "bg-amber-100", text: "text-amber-950", dot: "bg-[#D97706]", border: "border-amber-300" },
};

const PUAN_BADGE: Record<string, string> = {
  Yüksek: "bg-emerald-100 text-emerald-900 border-emerald-300",
  Orta: "bg-amber-100 text-amber-900 border-amber-300",
  Düşük: "bg-rose-100 text-rose-900 border-rose-300",
};

export default function PanelPage() {
  const { data: projeler, isLoading } = useSWR<Project[]>("/projeler", swrFetcher);
  const [user, setUser] = useState<UserPayload | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const son5 = projeler
    ? [...projeler].sort((a, b) => b.tarih_iso.localeCompare(a.tarih_iso)).slice(0, 5)
    : [];

  const toplam = projeler?.length ?? 0;
  const devamEdiyor = projeler?.filter((p) => p.statu === "Devam Ediyor").length ?? 0;
  const basvuruldu = projeler?.filter((p) => p.statu === "Başvuruldu").length ?? 0;
  const taslak = projeler?.filter((p) => p.statu === "Taslak").length ?? 0;

  const ortalamaDoluluk =
    toplam > 0
      ? Math.round((projeler!.reduce((acc, p) => acc + (p.doluluk || 0), 0) / toplam) * 100)
      : 0;

  return (
    <div className="space-y-8 max-w-6xl pb-16 text-[#2C2016]">
      {/* ── 3D HERO BANNER WITH PROMINENT ROUNDED CORNERS ────────────── */}
      <div className="card-3d p-7 sm:p-9 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-3 max-w-xl z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border-[1.5px] border-blue-200 text-xs font-bold text-[#2563EB] shadow-2xs">
            <Sparkles size={14} className="text-[#2563EB]" />
            <span>Marta Teknopark Ar-Ge Sistemi</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C2016]">
            Hoş geldiniz{user?.ad ? `, ${user.ad}` : ""} 👋
          </h1>

          <p className="text-xs sm:text-sm text-[#786655] font-medium leading-relaxed">
            Teknopark başvuru dosyalarınızı hazırlayın, yapay zekâ desteğiyle 20 alanı eksiksiz tamamlayın
            ve resmi Word formatında portala aktarın.
          </p>
        </div>

        {/* 3D TACTILE BUTTON */}
        <div className="shrink-0 z-10">
          <Link
            href="/yeni"
            className="btn-3d-primary text-xs sm:text-sm font-bold px-6 py-3.5 rounded-xl shadow-md cursor-pointer"
          >
            <Plus size={18} strokeWidth={2.5} className="mr-1.5" />
            <span>Yeni Başvuru Başlat</span>
          </Link>
        </div>
      </div>

      {/* ── 4 3D STAT CARDS WITH ROUNDED CORNERS ──────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Toplam Proje",
            val: toplam,
            desc: "Kayıtlı başvuru sayısı",
            colorText: "text-[#2C2016]",
            iconBg: "bg-blue-100 text-[#2563EB] border-b-2 border-blue-200",
            icon: FolderOpen,
          },
          {
            label: "Devam Eden",
            val: devamEdiyor,
            desc: `${taslak} taslak dosya aktif`,
            colorText: "text-blue-700",
            iconBg: "bg-indigo-100 text-indigo-700 border-b-2 border-indigo-200",
            icon: Clock,
          },
          {
            label: "Başvuruldu",
            val: basvuruldu,
            desc: "Portala sunulmuş dosyalar",
            colorText: "text-emerald-700",
            iconBg: "bg-emerald-100 text-emerald-700 border-b-2 border-emerald-200",
            icon: CheckCircle2,
          },
          {
            label: "Ortalama Doluluk",
            val: `%${ortalamaDoluluk}`,
            desc: "20 alan üzerinden",
            colorText: "text-blue-800",
            iconBg: "bg-sky-100 text-sky-700 border-b-2 border-sky-200",
            icon: Layers,
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="card-3d p-5 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#786655] uppercase tracking-wider">{s.label}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.iconBg}`}>
                  <Icon size={18} />
                </div>
              </div>
              <div className="mt-3">
                <p className={`text-3xl font-extrabold tracking-tight ${s.colorText}`}>
                  {isLoading ? "—" : s.val}
                </p>
                <p className="text-[11px] text-[#786655] mt-1.5 font-semibold">{s.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 3 3D INFO CARDS ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-3d p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#2563EB] flex items-center justify-center shrink-0 border border-blue-200 border-b-2 border-b-blue-300">
            <Building2 size={18} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[#2C2016]">NACE Rev. 2.1 Eşleştirme</h3>
            <p className="text-[11px] text-[#786655] mt-1 font-medium leading-relaxed">
              Yazılım, biyoteknoloji ve mühendislik faaliyetlerine uygun resmi 6 haneli kod analizi.
            </p>
          </div>
        </div>

        <div className="card-3d p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200 border-b-2 border-b-indigo-300">
            <Award size={18} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[#2C2016]">Frascati Kriterleri</h3>
            <p className="text-[11px] text-[#786655] mt-1 font-medium leading-relaxed">
              Yenilikçilik, Ar-Ge niteliği ve belirsizlik boyutlarının yapay zekâ ile değerlendirilmesi.
            </p>
          </div>
        </div>

        <div className="card-3d p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 border-b-2 border-b-emerald-300">
            <FileCheck2 size={18} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[#2C2016]">Resmi Word Çıktısı</h3>
            <p className="text-[11px] text-[#786655] mt-1 font-medium leading-relaxed">
              Teknopark başvuru formatında resmi Word belgesi indirme ve tek tıkla pano aktarımı.
            </p>
          </div>
        </div>
      </div>

      {/* ── RECENT PROJECTS LIST WITH 3D INTERACTIVE CARDS ───────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-[#2C2016]">
              Son Çalışılan Projeler
            </h2>
            <p className="text-xs text-[#786655] font-medium">En son düzenlenen Ar-Ge başvuru kayıtları</p>
          </div>

          {toplam > 0 && (
            <Link
              href="/projeler"
              className="flex items-center gap-1 text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
            >
              <span>Tümünü Gör ({toplam})</span>
              <ChevronRight size={15} />
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-3d h-20 animate-pulse" />
            ))}
          </div>
        ) : son5.length === 0 ? (
          <div className="card-3d p-12 text-center">
            <FolderOpen size={32} className="text-[#786655] mx-auto mb-3" />
            <p className="text-sm font-bold text-[#2C2016]">Henüz Başvuru Dosyası Yok</p>
            <p className="text-xs text-[#786655] mt-1 max-w-sm mx-auto mb-5 font-medium">
              Yeni bir Teknopark projesi başlatarak firma dokümanlarınızı yükleyin.
            </p>
            <Link
              href="/yeni"
              className="btn-3d-primary text-xs font-bold px-5 py-2.5 rounded-xl transition-all"
            >
              <Plus size={15} className="mr-1" />
              <span>İlk Başvuruyu Başlat</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {son5.map((proje) => {
              const renk = STATU_RENKLER[proje.statu as Statu] ?? "gray";
              const badge = STATU_BADGE[renk] ?? STATU_BADGE.gray;
              const pct = Math.round(proje.doluluk * 100);

              return (
                <Link
                  key={proje.dosya}
                  href={`/projeler/${proje.dosya}`}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between card-3d-interactive p-5 gap-3"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        {proje.statu}
                      </span>

                      {proje.proje_kodu && proje.proje_kodu !== "?" && (
                        <span className="text-[11px] font-mono font-bold text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-lg border border-blue-300">
                          {proje.proje_kodu}
                        </span>
                      )}

                      {proje.puan && (
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border ${PUAN_BADGE[proje.puan] ?? ""}`}>
                          Ar-Ge: {proje.puan}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-[#2C2016] group-hover:text-[#2563EB] truncate transition-colors">
                      {proje.proje_adi || "İsimsiz Başvuru"}
                    </h3>

                    <p className="text-[11px] text-[#786655] font-semibold">
                      Son güncelleme: {proje.tarih}
                    </p>
                  </div>

                  {/* Progress & 3D Action Pill */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-bold text-[#2C2016]">%{pct}</span>
                      <p className="text-[10px] text-[#786655] font-semibold">doluluk</p>
                    </div>

                    <div className="w-20 h-2 bg-[#EFE7DE] rounded-full overflow-hidden hidden sm:block border border-[#DFCFC0]">
                      <div
                        className="h-full bg-[#2563EB] rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="w-9 h-9 rounded-xl bg-[#EFE7DE] group-hover:bg-[#2563EB] group-hover:text-white text-[#2C2016] border border-[#DFCFC0] border-b-2 border-b-[#CDBCA9] group-hover:border-[#1D4ED8] flex items-center justify-center transition-all shadow-2xs">
                      <ArrowRight size={15} />
                    </div>
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

"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Trash2,
  ChevronDown,
  Plus,
  LayoutGrid,
  List,
  FolderOpen,
  Calendar,
  AlertCircle,
  Award,
  ArrowUpDown,
  ExternalLink,
  Check,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { swrFetcher, Project, updateMeta, deleteProje } from "@/lib/api";
import { STATULER, STATU_RENKLER, type Statu } from "@/lib/fields";

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

function StatuPopover({
  dosya,
  mevcutStatu,
  seciliStatu,
  kaydedildi,
  onSecim,
  onKaydet,
}: {
  dosya: string;
  mevcutStatu: string;
  seciliStatu: string;
  kaydedildi: boolean;
  onSecim: (s: string) => void;
  onKaydet: (dosya: string, close: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const aktifSecim = seciliStatu || mevcutStatu;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="btn-3d-neutral text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer"
        >
          <span>Durum</span>
          <ChevronDown size={12} className="ml-1 text-[#786655]" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="card-3d p-3.5 w-56 z-50 text-xs shadow-2xl"
          sideOffset={6}
          align="end"
        >
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[11px] font-bold text-[#786655] uppercase tracking-wider">
              Durumu Güncelle
            </span>
          </div>
          <div className="space-y-1 mb-3">
            {STATULER.map((s) => {
              const b = STATU_BADGE[STATU_RENKLER[s as Statu]];
              const secili = aktifSecim === s;
              return (
                <button
                  key={s}
                  onClick={() => onSecim(s)}
                  className={`w-full flex items-center justify-between text-left text-xs px-2.5 py-2 rounded-xl font-bold transition-colors cursor-pointer ${
                    secili
                      ? `border-[1.5px] ${b.bg} ${b.text} ${b.border} shadow-2xs`
                      : "text-[#2C2016] hover:bg-[#EFE7DE]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${b.dot}`} />
                    <span>{s}</span>
                  </div>
                  {secili && <Check size={13} className="text-current" />}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onKaydet(dosya, () => setOpen(false))}
            disabled={kaydedildi}
            className="w-full text-xs font-bold btn-3d-primary py-2 rounded-xl transition-all cursor-pointer"
          >
            {kaydedildi ? "Kaydedildi" : "Kaydet"}
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ProjelerIcerik() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();
  const { data: projeler, isLoading } = useSWR<Project[]>("/projeler", swrFetcher);

  const [arama, setArama] = useState("");
  const [statuFiltre, setStatuFiltre] = useState<string | null>(null);
  const [siralama, setSiralama] = useState<"tarih_desc" | "tarih_asc" | "ad" | "doluluk">("tarih_desc");
  const [gorunumModu, setGorunumModu] = useState<"grid" | "table">("grid");
  const [silmeProjesi, setSilmeProjesi] = useState<Project | null>(null);
  const [siliniyor, setSiliniyor] = useState(false);
  const [statuDegisim, setStatuDegisim] = useState<Record<string, string>>({});
  const [kaydedilen, setKaydedilen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const qStatu = searchParams.get("statu");
    if (qStatu && STATULER.includes(qStatu as Statu)) {
      setStatuFiltre(qStatu);
    }
  }, [searchParams]);

  const statuSayilari = useMemo(() => {
    const counts: Record<string, number> = { Tumu: projeler?.length ?? 0 };
    for (const s of STATULER) counts[s] = 0;
    if (projeler) {
      for (const p of projeler) {
        if (p.statu && counts[p.statu] !== undefined) counts[p.statu]++;
      }
    }
    return counts;
  }, [projeler]);

  const filtrelenmis = useMemo(() => {
    if (!projeler) return [];
    return projeler
      .filter((p) => {
        const adMatch =
          !arama ||
          p.proje_adi.toLowerCase().includes(arama.toLowerCase()) ||
          (p.proje_kodu && p.proje_kodu.toLowerCase().includes(arama.toLowerCase()));
        const statuMatch = !statuFiltre || p.statu === statuFiltre;
        return adMatch && statuMatch;
      })
      .sort((a, b) => {
        if (siralama === "tarih_desc") return b.tarih_iso.localeCompare(a.tarih_iso);
        if (siralama === "tarih_asc") return a.tarih_iso.localeCompare(b.tarih_iso);
        if (siralama === "ad") return a.proje_adi.localeCompare(b.proje_adi, "tr");
        if (siralama === "doluluk") return b.doluluk - a.doluluk;
        return 0;
      });
  }, [projeler, arama, statuFiltre, siralama]);

  async function handleSilOnayla() {
    if (!silmeProjesi) return;
    setSiliniyor(true);
    try {
      await deleteProje(silmeProjesi.dosya);
      mutate("/projeler");
      setSilmeProjesi(null);
    } catch {
      alert("Proje silinirken hata oluştu.");
    } finally {
      setSiliniyor(false);
    }
  }

  async function handleStatuKaydet(dosya: string, close: () => void) {
    const yeni = statuDegisim[dosya];
    if (!yeni) {
      close();
      return;
    }
    try {
      await updateMeta(dosya, yeni);
      setKaydedilen((prev) => ({ ...prev, [dosya]: true }));
      setTimeout(() => {
        setKaydedilen((prev) => ({ ...prev, [dosya]: false }));
        close();
        mutate("/projeler");
      }, 500);
    } catch {
      alert("Statü kaydedilirken hata oluştu.");
    }
  }

  return (
    <div className="space-y-6 max-w-6xl pb-16 text-[#2C2016]">
      {/* ── HEADER ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-[1.5px] border-[#DFCFC0]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C2016]">
            Ar-Ge Projeleri
          </h1>
          <p className="text-xs text-[#786655] font-medium mt-1">
            Teknopark formatında hazırlanmış başvuruları inceleyin ve düzenleyin.
          </p>
        </div>

        {/* 3D PRIMARY BUTTON */}
        <button
          onClick={() => router.push("/yeni")}
          className="btn-3d-primary text-xs sm:text-sm font-bold px-5 py-3 rounded-xl shrink-0 cursor-pointer"
        >
          <Plus size={18} strokeWidth={2.5} className="mr-1.5" />
          <span>Yeni Proje Başlat</span>
        </button>
      </div>

      {/* ── 3D TOOLBAR & FILTERS WITH CLEAR ROUNDED CORNERS ───────────── */}
      <div className="card-3d p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#786655]" />
            <input
              type="text"
              placeholder="Proje adı veya kod ile ara..."
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 text-xs font-semibold bg-[#EFE7DE] border-[1.5px] border-[#DFCFC0] text-[#2C2016] rounded-xl focus:outline-none focus:border-[#2563EB] transition-colors placeholder-[#8F7D6D]"
            />
          </div>

          {/* Sort & Grid/List View Toggles */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative">
              <select
                value={siralama}
                onChange={(e) => setSiralama(e.target.value as any)}
                aria-label="Dosyaları Sırala"
                className="appearance-none bg-[#EFE7DE] border-[1.5px] border-[#DFCFC0] text-xs font-bold text-[#2C2016] pl-3.5 pr-9 py-2.5 rounded-xl focus:outline-none focus:border-[#2563EB] cursor-pointer shadow-2xs"
              >
                <option value="tarih_desc">Yeniden Eskiye</option>
                <option value="tarih_asc">Eskiden Yeniye</option>
                <option value="ad">İsme Göre (A-Z)</option>
                <option value="doluluk">Doluluk Oranına Göre</option>
              </select>
              <ArrowUpDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#786655] pointer-events-none" />
            </div>

            <div className="flex items-center bg-[#EFE7DE] p-1 rounded-xl border-[1.5px] border-[#DFCFC0]">
              <button
                onClick={() => setGorunumModu("grid")}
                className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  gorunumModu === "grid"
                    ? "bg-[#2563EB] text-white shadow-xs"
                    : "text-[#786655] hover:text-[#2C2016]"
                }`}
                title="Kart Görünümü"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setGorunumModu("table")}
                className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  gorunumModu === "table"
                    ? "bg-[#2563EB] text-white shadow-xs"
                    : "text-[#786655] hover:text-[#2C2016]"
                }`}
                title="Tablo Görünümü"
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2.5 border-t border-[#DFCFC0] scrollbar-none">
          <button
            onClick={() => setStatuFiltre(null)}
            className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              statuFiltre === null
                ? "bg-[#2563EB] text-white border-b-2 border-[#1D4ED8] shadow-xs"
                : "bg-[#EFE7DE] text-[#786655] border-[1.5px] border-[#DFCFC0] hover:text-[#2C2016]"
            }`}
          >
            <span>Tümü</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/10 font-extrabold">
              {statuSayilari.Tumu}
            </span>
          </button>

          {STATULER.map((s) => {
            const badge = STATU_BADGE[STATU_RENKLER[s]];
            const count = statuSayilari[s] ?? 0;
            const secili = statuFiltre === s;
            return (
              <button
                key={s}
                onClick={() => setStatuFiltre(secili ? null : s)}
                className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                  secili
                    ? `bg-[#2563EB] text-white border-b-2 border-[#1D4ED8] shadow-xs`
                    : `bg-[#EFE7DE] text-[#786655] border-[1.5px] border-[#DFCFC0] hover:text-[#2C2016]`
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${secili ? "bg-white" : badge.dot}`} />
                <span>{s}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/10 font-extrabold">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3D CONTENT GRID / TABLE ───────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card-3d h-52 animate-pulse" />
          ))}
        </div>
      ) : filtrelenmis.length === 0 ? (
        <div className="card-3d p-12 text-center">
          <FolderOpen size={30} className="text-[#786655] mx-auto mb-2" />
          <h3 className="text-sm font-bold text-[#2C2016] mb-1">Eşleşen Proje Bulunamadı</h3>
          <p className="text-xs text-[#786655] max-w-sm mx-auto mb-4 font-medium">
            Arama terimlerinizi değiştirin ya da yeni bir başvuru oluşturun.
          </p>
          {(arama || statuFiltre) && (
            <button
              onClick={() => {
                setArama("");
                setStatuFiltre(null);
              }}
              className="text-xs font-bold text-[#2563EB] hover:underline cursor-pointer"
            >
              Filtreleri Temizle
            </button>
          )}
        </div>
      ) : gorunumModu === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtrelenmis.map((proje) => {
            const renk = STATU_RENKLER[proje.statu as Statu] ?? "gray";
            const badge = STATU_BADGE[renk] ?? STATU_BADGE.gray;
            const pct = Math.round(proje.doluluk * 100);
            const seciliStatu = statuDegisim[proje.dosya] ?? proje.statu;

            return (
              <div
                key={proje.dosya}
                className="group card-3d-interactive p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                      <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                      {proje.statu}
                    </span>

                    <button
                      onClick={() => setSilmeProjesi(proje)}
                      className="text-[#786655] hover:text-[#DC2626] hover:bg-rose-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                      title="Sil"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {proje.proje_kodu && proje.proje_kodu !== "?" && (
                    <p className="text-[11px] font-mono font-bold text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-lg inline-block mb-1.5 border border-blue-300">
                      {proje.proje_kodu}
                    </p>
                  )}

                  <h3
                    onClick={() => router.push(`/projeler/${proje.dosya}`)}
                    className="font-extrabold text-[#2C2016] group-hover:text-[#2563EB] text-sm sm:text-base leading-snug line-clamp-2 cursor-pointer transition-colors mb-3"
                    title={proje.proje_adi}
                  >
                    {proje.proje_adi || "İsimsiz Başvuru"}
                  </h3>

                  <div className="flex flex-wrap items-center gap-1.5 mb-4">
                    {proje.puan && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-lg border ${PUAN_BADGE[proje.puan] ?? ""}`}>
                        <Award size={12} />
                        <span>Ar-Ge: {proje.puan}</span>
                      </span>
                    )}

                    {proje.eksik > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-lg">
                        <AlertCircle size={12} />
                        <span>{proje.eksik} eksik alan</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress & 3D Actions */}
                <div className="space-y-3 pt-3.5 border-t border-[#DFCFC0]">
                  <div>
                    <div className="flex justify-between items-center text-[11px] mb-1.5 font-bold text-[#786655]">
                      <span>{proje.tarih}</span>
                      <span className="text-[#2C2016]">%{pct} doluluk</span>
                    </div>
                    <div className="h-2 bg-[#EFE7DE] rounded-full overflow-hidden border border-[#DFCFC0]">
                      <div
                        className="h-full bg-[#2563EB] rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 3D ACTION BUTTON */}
                    <button
                      onClick={() => router.push(`/projeler/${proje.dosya}`)}
                      className="flex-1 btn-3d-neutral text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer"
                    >
                      <span>Aç & Düzenle</span>
                      <ExternalLink size={13} className="ml-1.5" />
                    </button>

                    <StatuPopover
                      dosya={proje.dosya}
                      mevcutStatu={proje.statu}
                      seciliStatu={seciliStatu}
                      kaydedildi={!!kaydedilen[proje.dosya]}
                      onSecim={(s) => setStatuDegisim((prev) => ({ ...prev, [proje.dosya]: s }))}
                      onKaydet={handleStatuKaydet}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View with Rounded Corners & 3D Depth */
        <div className="card-3d overflow-hidden text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#EFE7DE] border-b-[1.5px] border-[#DFCFC0] text-[11px] text-[#786655] font-extrabold uppercase">
                <tr>
                  <th className="px-5 py-3.5">Proje Adı & Kod</th>
                  <th className="px-5 py-3.5">Durum</th>
                  <th className="px-5 py-3.5">Ar-Ge Uygunluk</th>
                  <th className="px-5 py-3.5">Doluluk</th>
                  <th className="px-5 py-3.5">Tarih</th>
                  <th className="px-5 py-3.5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFCFC0]">
                {filtrelenmis.map((proje) => {
                  const renk = STATU_RENKLER[proje.statu as Statu] ?? "gray";
                  const badge = STATU_BADGE[renk] ?? STATU_BADGE.gray;
                  const pct = Math.round(proje.doluluk * 100);

                  return (
                    <tr
                      key={proje.dosya}
                      className="hover:bg-[#EFE7DE]/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/projeler/${proje.dosya}`)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-[#2C2016] truncate max-w-xs">
                          {proje.proje_adi || "İsimsiz Başvuru"}
                        </div>
                        {proje.proje_kodu && (
                          <span className="text-[11px] font-mono text-[#786655]">
                            {proje.proje_kodu}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {proje.statu}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {proje.puan ? (
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border ${PUAN_BADGE[proje.puan] ?? ""}`}>
                            {proje.puan}
                          </span>
                        ) : (
                          <span className="text-[#786655]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-extrabold text-[#2C2016]">%{pct}</span>
                      </td>
                      <td className="px-5 py-3.5 text-[#786655] font-semibold">{proje.tarih}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/projeler/${proje.dosya}`);
                          }}
                          className="text-xs font-bold text-[#2563EB] hover:underline cursor-pointer"
                        >
                          Düzenle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 3D SILME DIALOG ───────────────────────────────────────────── */}
      <Dialog.Root open={!!silmeProjesi} onOpenChange={(open) => !open && setSilmeProjesi(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 card-3d p-7 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-[#DC2626] border border-rose-200 border-b-2 border-b-rose-300 flex items-center justify-center font-bold">
                <Trash2 size={20} />
              </div>
              <div>
                <Dialog.Title className="text-base font-extrabold text-[#2C2016]">
                  Projeyi Sil
                </Dialog.Title>
                <Dialog.Description className="text-xs text-[#786655] font-medium">
                  Bu başvuru dosyası kalıcı olarak silinecektir.
                </Dialog.Description>
              </div>
            </div>

            <div className="p-3.5 bg-[#EFE7DE] rounded-xl border border-[#DFCFC0] text-xs font-bold text-[#2C2016] mb-5">
              {silmeProjesi?.proje_adi}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setSilmeProjesi(null)}
                className="btn-3d-neutral px-4 py-2 text-xs font-bold rounded-xl cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handleSilOnayla}
                disabled={siliniyor}
                className="btn-3d-danger px-4 py-2 text-xs font-bold rounded-xl cursor-pointer"
              >
                {siliniyor ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export default function ProjelerPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#786655]">Yükleniyor...</div>}>
      <ProjelerIcerik />
    </Suspense>
  );
}

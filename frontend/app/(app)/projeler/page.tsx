"use client";

import { useState, useEffect, Suspense } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Trash2, ChevronDown, Plus } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { swrFetcher, Project, updateMeta, deleteProje } from "@/lib/api";
import { STATULER, STATU_RENKLER, type Statu } from "@/lib/fields";

const STATU_TW: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  orange: "bg-orange-100 text-orange-700",
};

const PUAN_TW: Record<string, string> = {
  Yüksek: "bg-emerald-100 text-emerald-700",
  Orta: "bg-yellow-100 text-yellow-700",
  Düşük: "bg-red-100 text-red-700",
};

function StatuPopover({
  dosya, mevcutStatu, seciliStatu, kaydedildi, onSecim, onKaydet,
}: {
  dosya: string; mevcutStatu: string; seciliStatu: string; kaydedildi: boolean;
  onSecim: (s: string) => void; onKaydet: (dosya: string, close: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 px-2.5 py-2 rounded-lg transition-colors">
          Durum <ChevronDown size={11} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-44 z-50" sideOffset={6}>
          <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Durum seç</p>
          <div className="space-y-0.5 mb-3">
            {STATULER.map((s) => {
              const stw = STATU_TW[STATU_RENKLER[s as Statu]];
              return (
                <button
                  key={s}
                  onClick={() => onSecim(s)}
                  className={`w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors ${
                    seciliStatu === s ? stw + " font-semibold" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => onKaydet(dosya, () => setOpen(false))}
            disabled={!seciliStatu || seciliStatu === mevcutStatu}
            className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white py-2 rounded-lg font-semibold transition-colors"
          >
            {kaydedildi ? "✓ Kaydedildi" : "Kaydet"}
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default function ProjelerPageWrapper() {
  return (
    <Suspense fallback={<div className="py-12 text-sm text-gray-400 text-center">Yükleniyor...</div>}>
      <ProjelerPage />
    </Suspense>
  );
}

function ProjelerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();
  const { data: projeler, isLoading } = useSWR<Project[]>("/projeler", swrFetcher);

  const [arama, setArama] = useState("");
  const [statuFiltre, setStatuFiltre] = useState<string | null>(null);

  // URL'deki ?statu= parametresini oku
  useEffect(() => {
    const s = searchParams.get("statu");
    setStatuFiltre(s && STATULER.includes(s as Statu) ? s : null);
  }, [searchParams]);
  const [silmeProjesi, setSilmeProjesi] = useState<Project | null>(null);
  const [siliniyor, setSiliniyor] = useState(false);
  const [statuDegisim, setStatuDegisim] = useState<Record<string, string>>({});
  const [kaydedilen, setKaydedilen] = useState<Record<string, boolean>>({});

  const filtrelenmis = (projeler ?? []).filter((p) => {
    const aramaOk = !arama || [p.proje_adi, p.proje_kodu].some((f) =>
      f?.toLowerCase().includes(arama.toLowerCase())
    );
    return aramaOk && (!statuFiltre || p.statu === statuFiltre);
  });

  async function handleStatuKaydet(dosya: string, closePopover: () => void) {
    const yeniStatu = statuDegisim[dosya];
    if (!yeniStatu) return;
    try {
      await updateMeta(dosya, yeniStatu);
      setKaydedilen((prev) => ({ ...prev, [dosya]: true }));
      setTimeout(() => setKaydedilen((prev) => ({ ...prev, [dosya]: false })), 2000);
      mutate("/projeler");
      closePopover();
    } catch (e) {
      alert("Durum güncellenemedi: " + (e instanceof Error ? e.message : "Hata"));
    }
  }

  async function handleSil() {
    if (!silmeProjesi) return;
    setSiliniyor(true);
    try {
      await deleteProje(silmeProjesi.dosya);
      mutate("/projeler");
      setSilmeProjesi(null);
    } catch (e) {
      alert("Proje silinemedi: " + (e instanceof Error ? e.message : "Hata"));
    } finally {
      setSiliniyor(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projelerim</h1>
          {!isLoading && <p className="text-sm text-gray-500 mt-0.5">{projeler?.length ?? 0} proje</p>}
        </div>
        <button
          onClick={() => router.push("/yeni")}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={15} />
          Yeni başvuru
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Proje ara..."
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setStatuFiltre(null)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
              statuFiltre === null ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-300"
            }`}
          >
            Tümü
          </button>
          {STATULER.map((s) => {
            const tw = STATU_TW[STATU_RENKLER[s]];
            return (
              <button
                key={s}
                onClick={() => setStatuFiltre(statuFiltre === s ? null : s)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                  statuFiltre === s ? `${tw} border-current` : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-48 animate-pulse" />
          ))}
        </div>
      ) : filtrelenmis.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-base mb-1">Proje bulunamadı</p>
          <p className="text-sm">Filtreleri değiştirin veya yeni başvuru başlatın</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrelenmis.map((proje) => {
            const renk = STATU_RENKLER[proje.statu as Statu] ?? "gray";
            const tw = STATU_TW[renk];
            const pct = Math.round(proje.doluluk * 100);
            const seciliStatu = statuDegisim[proje.dosya] ?? proje.statu;

            return (
              <div key={proje.dosya} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col hover:shadow-md transition-shadow">
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-1">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${tw}`}>
                      {proje.statu}
                    </span>
                    <p className="text-xs text-gray-400">{proje.tarih}</p>
                  </div>
                  <button
                    onClick={() => setSilmeProjesi(proje)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
                    title="Sil"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Name */}
                <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-0.5 line-clamp-2 flex-1">
                  {proje.proje_adi || "İsimsiz proje"}
                </h3>
                {proje.proje_kodu && proje.proje_kodu !== "?" && (
                  <p className="text-xs text-gray-400 font-mono mb-2">{proje.proje_kodu}</p>
                )}

                {/* Badges */}
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {proje.puan && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PUAN_TW[proje.puan] ?? "bg-gray-100 text-gray-600"}`}>
                      Ar-Ge: {proje.puan}
                    </span>
                  )}
                  {proje.eksik > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                      {proje.eksik} eksik
                    </span>
                  )}
                </div>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Doluluk</span>
                    <span className="font-medium text-gray-600">%{pct}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-auto">
                  <button
                    onClick={() => router.push(`/projeler/${proje.dosya}`)}
                    className="flex-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors"
                  >
                    Aç
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
            );
          })}
        </div>
      )}

      {/* Delete dialog */}
      <Dialog.Root open={!!silmeProjesi} onOpenChange={(o) => !o && setSilmeProjesi(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm z-50">
            <Dialog.Title className="text-base font-bold text-gray-900 mb-2">Projeyi sil</Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500 mb-5">
              <strong className="text-gray-700">{silmeProjesi?.proje_adi || "Bu proje"}</strong> kalıcı olarak silinecek.
            </Dialog.Description>
            <div className="flex gap-3 justify-end">
              <Dialog.Close asChild>
                <button className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                  İptal
                </button>
              </Dialog.Close>
              <button
                onClick={handleSil}
                disabled={siliniyor}
                className="text-sm px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium transition-colors"
              >
                {siliniyor ? "Siliniyor..." : "Evet, sil"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

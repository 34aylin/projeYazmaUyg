"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Download,
  Send,
  AlertTriangle,
  CheckCircle2,
  History,
  Wand2,
  Loader2,
  Copy,
  Check,
  FileText,
  MessageSquare,
  ShieldCheck,
  Award,
  Clock,
  Sparkles,
  Search,
  Info,
} from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { swrFetcher, ProjectData, Message, updateProje, ApiError, apiFetch } from "@/lib/api";
import { METIN_ALANLARI } from "@/lib/fields";
import { getToken } from "@/lib/auth";
import { getAyarlar } from "@/lib/ayarlar";

const KATEGORILER: Record<string, { label: string; fields: string[] }> = {
  tumu: { label: "Tüm Alanlar", fields: Object.keys(METIN_ALANLARI) },
  temel: {
    label: "Temel Bilgiler",
    fields: ["proje_adi", "proje_kodu", "anahtar_kelimeler"],
  },
  arge: {
    label: "Ar-Ge & Yenilikçilik",
    fields: ["proje_konusu", "arge_niteligi", "yenilikci_yonu", "hedeflenen_kazanimlar"],
  },
  yontem: {
    label: "Yöntem & Çıktılar",
    fields: ["proje_detayi", "ciktilar_kullanim_alanlari", "toplum_cevre_degeri"],
  },
  pazar: {
    label: "Pazar & Ticarileşme",
    fields: [
      "ticarilesme_potansiyeli",
      "musteri_segmentleri",
      "rakipler",
      "urun_konumlandirma",
      "satis_yontemleri",
      "ihracat_ithal_ikame",
      "maliyetler",
      "fiyat_maliyet_analizi",
      "ilk_yatirim_maliyeti",
      "istihdam_ciro",
    ],
  },
};

function aiParcala(metin: string, tahminler: string[]): { metin: string; ai: boolean }[] {
  if (!tahminler?.length) return [{ metin, ai: false }];
  const sonuc: { metin: string; ai: boolean }[] = [];
  const konumlar = tahminler
    .map((t) => ({ t, i: metin.indexOf(t) }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i);
  let pos = 0;
  for (const { t, i } of konumlar) {
    if (i > pos) sonuc.push({ metin: metin.slice(pos, i), ai: false });
    sonuc.push({ metin: t.replace(/^~/, ""), ai: true });
    pos = i + t.length;
  }
  if (pos < metin.length) sonuc.push({ metin: metin.slice(pos), ai: false });
  return sonuc;
}

function FormTab({
  dosya,
  data,
  onSaved,
}: {
  dosya: string;
  data: ProjectData;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [tamamlaniyor, setTamamlaniyor] = useState(false);
  const [mesaj, setMesaj] = useState<{ tip: "ok" | "hata"; metin: string } | null>(null);
  const [editMod, setEditMod] = useState<Record<string, boolean>>({});
  const [sadeceAi, setSadeceAi] = useState(false);
  const [seciliKategori, setSeciliKategori] = useState("tumu");
  const [alanArama, setAlanArama] = useState("");
  const [kopyalandiAlan, setKopyalandiAlan] = useState<string | null>(null);

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const key of Object.keys(METIN_ALANLARI)) {
      const val = data.alanlar?.[key];
      initial[key] = typeof val === "string" ? val : "";
    }
    setForm(initial);
    setEditMod({});
  }, [data]);

  async function handleTamamla() {
    setTamamlaniyor(true);
    setMesaj(null);
    try {
      const { saglayici } = getAyarlar();
      const res = await apiFetch(`/ai/tamamla/${dosya}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saglayici }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail ?? "Tamamlama hatası.");
      }
      const result = await res.json();
      const d = result.doldurulan ?? 0;
      const k = result.kalan ?? 0;
      setMesaj({ tip: "ok", metin: `${d} alan tamamlandı${k > 0 ? `, ${k} eksik kaldı` : ""}.` });
      setTimeout(() => setMesaj(null), 4000);
      onSaved();
    } catch (e) {
      setMesaj({ tip: "hata", metin: e instanceof Error ? e.message : "Hata oluştu." });
    } finally {
      setTamamlaniyor(false);
    }
  }

  async function handleKaydet() {
    setKaydediliyor(true);
    setMesaj(null);
    try {
      await updateProje(dosya, form, data);
      setMesaj({ tip: "ok", metin: "Değişiklikler başarıyla kaydedildi." });
      setTimeout(() => setMesaj(null), 3000);
      onSaved();
    } catch (e) {
      setMesaj({ tip: "hata", metin: e instanceof ApiError ? e.message : "Kaydetme hatası." });
    } finally {
      setKaydediliyor(false);
    }
  }

  function handlePanoyaKopyala(key: string, metin: string) {
    navigator.clipboard.writeText(metin);
    setKopyalandiAlan(key);
    setTimeout(() => setKopyalandiAlan(null), 2000);
  }

  const aiTahminListesi = Object.entries(METIN_ALANLARI).flatMap(([key, meta]) => {
    const tahminler = (data.tahminler?.[key] ?? []) as string[];
    return tahminler.map((t) => ({ alan: meta.label, cumle: t.replace(/^~/, "") }));
  });

  const gosterilenAlanlar = Object.entries(METIN_ALANLARI).filter(([key, meta]) => {
    const katMatch =
      seciliKategori === "tumu" || KATEGORILER[seciliKategori]?.fields.includes(key);
    const araMatch =
      !alanArama ||
      meta.label.toLowerCase().includes(alanArama.toLowerCase()) ||
      (form[key] ?? "").toLowerCase().includes(alanArama.toLowerCase());
    return katMatch && araMatch;
  });

  return (
    <div className="space-y-6 text-[#2C2016]">
      {/* Category Tabs & Filter Toolbar with 3D Depth */}
      <div className="card-3d p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {Object.entries(KATEGORILER).map(([kKey, kat]) => {
              const aktif = seciliKategori === kKey;
              return (
                <button
                  key={kKey}
                  type="button"
                  onClick={() => setSeciliKategori(kKey)}
                  className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                    aktif
                      ? "bg-[#2563EB] text-white border-b-2 border-[#1D4ED8] shadow-xs"
                      : "bg-[#EFE7DE] text-[#786655] border-[1.5px] border-[#DFCFC0] hover:text-[#2C2016]"
                  }`}
                >
                  {kat.label}
                </button>
              );
            })}
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#786655]" />
            <input
              type="text"
              placeholder="Formda ara..."
              value={alanArama}
              onChange={(e) => setAlanArama(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-xs font-semibold bg-[#EFE7DE] border-[1.5px] border-[#DFCFC0] text-[#2C2016] rounded-xl focus:outline-none focus:border-[#2563EB] transition-colors placeholder-[#8F7D6D]"
            />
          </div>
        </div>

        {/* AI Predictions Toggle Banner */}
        {aiTahminListesi.length > 0 && (
          <div className="flex items-center justify-between pt-3 border-t border-[#DFCFC0]">
            <div className="flex items-center gap-2 text-xs text-[#786655] font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-pulse" />
              <span>
                Yapay zekâ tarafından yapılan <strong className="text-[#2C2016]">{aiTahminListesi.length}</strong> tahmin mevcut.
              </span>
            </div>
            {/* 3D GREEN BUTTON */}
            <button
              type="button"
              onClick={() => setSadeceAi((v) => !v)}
              className="btn-3d-green text-xs font-bold px-3.5 py-1.5 rounded-xl cursor-pointer"
            >
              <Wand2 size={14} className="mr-1.5" />
              <span>{sadeceAi ? "Forma Dön" : "AI Tahminlerini Gör"}</span>
            </button>
          </div>
        )}
      </div>

      {/* AI Predictions View */}
      {sadeceAi && (
        <div className="space-y-3 pb-32">
          {aiTahminListesi.map((item, i) => (
            <div
              key={i}
              className="card-3d p-4 sm:p-5"
            >
              <p className="text-xs font-bold text-[#2563EB] uppercase tracking-wider mb-1">
                {item.alan}
              </p>
              <p className="text-sm font-semibold text-[#2C2016] leading-relaxed">{item.cumle}</p>
            </div>
          ))}
        </div>
      )}

      {/* Main Form Fields with Clear 3D Rounded Cards */}
      {!sadeceAi && (
        <div className="space-y-5 pb-32">
          {gosterilenAlanlar.map(([key, meta]) => {
            const val = form[key] ?? "";
            const len = val.length;
            const asiri = meta.limit ? len > meta.limit : false;
            const dusuk = meta.onerilen ? len > 0 && len < meta.onerilen[0] : false;
            const eksikIcerik = val.includes("[EKSİK");
            const eksikAlan = val.trim() === "";

            const tahminler = (data.tahminler?.[key] ?? []) as string[];
            const hasAi = tahminler.length > 0 && !editMod[key];
            const rows =
              key === "proje_detayi"
                ? 12
                : key === "arge_niteligi" || key === "proje_konusu"
                ? 8
                : key === "proje_adi" || key === "proje_kodu" || key === "anahtar_kelimeler"
                ? 2
                : 5;

            return (
              <div
                key={key}
                className={`card-3d p-5 sm:p-6 transition-all ${
                  asiri
                    ? "border-rose-400 bg-rose-50/60"
                    : "bg-[#FFFDF9]"
                }`}
              >
                {/* Field Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5 pb-3 border-b border-[#DFCFC0]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-sm sm:text-base font-extrabold text-[#2C2016]">
                      {meta.label}
                    </label>

                    {eksikAlan && (
                      <span className="text-[10px] font-bold text-rose-900 bg-rose-100 border border-rose-300 px-2.5 py-0.5 rounded-full">
                        Boş
                      </span>
                    )}
                    {eksikIcerik && !eksikAlan && (
                      <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                        [Eksik] içerik var
                      </span>
                    )}
                    {tahminler.length > 0 && (
                      <span className="text-[10px] font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                        AI Tahmini ({tahminler.length})
                      </span>
                    )}
                  </div>

                  {/* Character Counter & 3D Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePanoyaKopyala(key, val)}
                      className="p-2 rounded-xl bg-[#EFE7DE] border border-[#DFCFC0] text-[#786655] hover:text-[#2C2016] transition-colors cursor-pointer shadow-2xs"
                      title="Metni panoya kopyala"
                    >
                      {kopyalandiAlan === key ? (
                        <Check size={14} className="text-[#16A34A]" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>

                    {tahminler.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEditMod((p) => ({ ...p, [key]: !p[key] }))}
                        className="text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-xl border border-emerald-300 cursor-pointer shadow-2xs"
                      >
                        {editMod[key] ? "Önizle" : "Düzenle"}
                      </button>
                    )}

                    <div
                      className={`text-xs tabular-nums font-mono font-bold px-3 py-1.5 rounded-xl border ${
                        asiri
                          ? "text-rose-900 bg-rose-100 border-rose-300"
                          : dusuk
                          ? "text-amber-900 bg-amber-100 border-amber-300"
                          : "text-[#786655] bg-[#EFE7DE] border-[#DFCFC0]"
                      }`}
                    >
                      {len.toLocaleString("tr-TR")}
                      {meta.limit ? ` / ${meta.limit.toLocaleString("tr-TR")}` : ""}
                    </div>
                  </div>
                </div>

                {/* Field Body */}
                {hasAi ? (
                  <div
                    onClick={() => setEditMod((p) => ({ ...p, [key]: true }))}
                    style={{ minHeight: `${rows * 1.6}rem` }}
                    className="w-full rounded-xl border-[1.5px] border-[#DFCFC0] p-4 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap cursor-text bg-[#EFE7DE] text-[#2C2016] font-medium"
                  >
                    {aiParcala(val, tahminler).map((p, i) =>
                      p.ai ? (
                        <span
                          key={i}
                          className="text-emerald-950 bg-emerald-200/80 font-bold px-1.5 py-0.5 rounded-md border border-emerald-400"
                        >
                          {p.metin}
                        </span>
                      ) : (
                        <span key={i} className="text-[#2C2016]">{p.metin}</span>
                      )
                    )}
                  </div>
                ) : (
                  <textarea
                    value={val}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    rows={rows}
                    placeholder={`${meta.label} alanını buraya girin...`}
                    className={`w-full rounded-xl border-[1.5px] p-4 text-xs sm:text-sm font-medium leading-relaxed resize-y focus:outline-none focus:border-[#2563EB] transition-colors text-[#2C2016] placeholder-[#8F7D6D] ${
                      asiri
                        ? "bg-rose-50 border-rose-400"
                        : "bg-[#EFE7DE] border-[#DFCFC0]"
                    }`}
                  />
                )}

                {meta.onerilen && (
                  <p className="text-[11px] text-[#786655] mt-2.5 flex items-center gap-1.5 font-medium">
                    <Info size={13} className="text-[#2563EB]" />
                    <span>
                      Önerilen karakter aralığı:{" "}
                      <strong className="text-[#2C2016]">
                        {meta.onerilen[0].toLocaleString("tr-TR")} –{" "}
                        {meta.onerilen[1].toLocaleString("tr-TR")}
                      </strong>
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── STICKY 3D SAVE / ACTION BAR ──────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#FFFDF9]/95 backdrop-blur-md border-t-[1.5px] border-[#DFCFC0] px-4 sm:px-8 py-3.5 z-30 shadow-[0_-4px_16px_rgba(70,45,20,0.06)]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* 3D PRIMARY ACTION */}
            <button
              onClick={handleKaydet}
              disabled={kaydediliyor || tamamlaniyor}
              className="btn-3d-primary disabled:opacity-50 text-white text-xs sm:text-sm font-bold px-7 py-3 rounded-xl cursor-pointer"
            >
              {kaydediliyor ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <Save size={16} className="mr-1.5" />}
              <span>{kaydediliyor ? "Kaydediliyor..." : "Kaydet"}</span>
            </button>

            {/* 3D GREEN ACTION */}
            <button
              onClick={handleTamamla}
              disabled={kaydediliyor || tamamlaniyor}
              className="btn-3d-green disabled:opacity-50 text-white text-xs sm:text-sm font-bold px-6 py-3 rounded-xl cursor-pointer"
              title="Formdaki [EKSİK] alanları bağlama göre AI ile doldur"
            >
              {tamamlaniyor ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <Wand2 size={16} className="mr-1.5" />}
              <span>{tamamlaniyor ? "Dolduruluyor..." : "Eksikleri Tamamla"}</span>
            </button>
          </div>

          {mesaj && (
            <div
              className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl border ${
                mesaj.tip === "ok"
                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                  : "bg-rose-100 text-rose-900 border-rose-300"
              }`}
            >
              {mesaj.tip === "ok" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{mesaj.metin}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AsistanTab({ dosya }: { dosya: string }) {
  const { data: sohbetData, mutate: mutateSohbet } = useSWR<{ sohbet: Message[] }>(
    `/projeler/${dosya}/sohbet`,
    swrFetcher
  );
  const [girdi, setGirdi] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [yerelMesajlar, setYerelMesajlar] = useState<Message[]>([]);
  const [sonucMesaj, setSonucMesaj] = useState("");
  const sonRef = useRef<HTMLDivElement>(null);

  const mesajlar = sohbetData?.sohbet ?? [];

  useEffect(() => {
    sonRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mesajlar, yerelMesajlar, sonucMesaj]);

  async function handleGonder(metinGonder?: string) {
    const mesajIcerik = (metinGonder || girdi).trim();
    if (!mesajIcerik || gonderiliyor) return;
    setGirdi("");
    setGonderiliyor(true);
    setSonucMesaj("");
    setYerelMesajlar([{ role: "user", content: mesajIcerik }]);

    try {
      const token = getToken();
      const res = await fetch(`/api/ai/sohbet/${dosya}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mesaj: mesajIcerik }),
      });

      if (!res.ok) throw new Error(`Sunucu Hatası (${res.status})`);
      const data = await res.json();

      if (data.type === "done") {
        setSonucMesaj(data.yanit ?? "");
        setYerelMesajlar([]);
        mutateSohbet();
      } else if (data.type === "error") {
        setSonucMesaj("Hata: " + (data.msg || "Bilinmeyen hata"));
      }
    } catch (e) {
      setSonucMesaj("Hata: " + (e instanceof Error ? e.message : "Bilinmeyen hata"));
    } finally {
      setGonderiliyor(false);
    }
  }

  const tumMesajlar = [
    ...mesajlar,
    ...yerelMesajlar,
    ...(sonucMesaj ? [{ role: "assistant" as const, content: sonucMesaj }] : []),
  ];

  const ONERILEN_SORULAR = [
    "Ar-Ge niteliği alanını daha ikna edici hale getir",
    "Karakter limitini aşan alanları özetle",
    "Hedeflenen kazanımlar için ölçülebilir KPI'lar ekle",
    "Yerli ve yabancı rakipler analizini detaylandır",
  ];

  return (
    <div className="card-3d p-6 flex flex-col h-[calc(100vh-230px)]">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 mb-4 scrollbar-thin">
        {tumMesajlar.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 bg-blue-100 text-[#2563EB] rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-200 border-b-2 border-b-blue-300">
              <Sparkles size={24} />
            </div>
            <h3 className="text-base font-extrabold text-[#2C2016] mb-1">
              Teknopark AI Asistanı Hazır
            </h3>
            <p className="text-xs text-[#786655] max-w-md mx-auto mb-6 font-medium">
              Başvuru metinlerinizi geliştirmek, Ar-Ge puanınızı artırmak veya eksik alanları tamamlamak için
              sorularınızı sorabilirsiniz.
            </p>

            {/* Quick Prompt Chips */}
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {ONERILEN_SORULAR.map((soru) => (
                <button
                  key={soru}
                  type="button"
                  onClick={() => handleGonder(soru)}
                  className="btn-3d-neutral text-xs font-bold px-3.5 py-2 rounded-xl cursor-pointer"
                >
                  {soru}
                </button>
              ))}
            </div>
          </div>
        ) : (
          tumMesajlar.map((m, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#2563EB] flex items-center justify-center shrink-0 mt-0.5 border border-blue-200 border-b-2 border-b-blue-300">
                  <Sparkles size={15} />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4.5 py-3 text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-[#2563EB] text-white border-b-2 border-[#1D4ED8] shadow-xs"
                    : "bg-[#EFE7DE] border-[1.5px] border-[#DFCFC0] text-[#2C2016]"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}

        {gonderiliyor && (
          <div className="flex items-center gap-2 text-[#2563EB] text-xs font-bold py-2">
            <Loader2 size={14} className="animate-spin" />
            <span>Asistan yanıt hazırlıyor...</span>
          </div>
        )}
        <div ref={sonRef} />
      </div>

      {/* Input Bar */}
      <div className="pt-3.5 border-t border-[#DFCFC0] flex gap-2.5">
        <textarea
          value={girdi}
          onChange={(e) => setGirdi(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleGonder();
            }
          }}
          rows={2}
          placeholder="Asistana soru sorun... (Enter gönderir, Shift+Enter yeni satır)"
          className="flex-1 bg-[#EFE7DE] border-[1.5px] border-[#DFCFC0] text-[#2C2016] font-medium rounded-xl px-3.5 py-2.5 text-xs sm:text-sm resize-none focus:outline-none focus:border-[#2563EB] transition-colors placeholder-[#8F7D6D]"
          disabled={gonderiliyor}
        />
        {/* 3D SEND BUTTON */}
        <button
          onClick={() => handleGonder()}
          disabled={!girdi.trim() || gonderiliyor}
          className="self-end btn-3d-primary disabled:opacity-40 text-white text-xs font-bold px-5 py-3 rounded-xl cursor-pointer"
        >
          <Send size={15} />
          <span className="ml-1.5">Gönder</span>
        </button>
      </div>
    </div>
  );
}

function KontrolTab({ data }: { data: ProjectData }) {
  const alanlar = data.alanlar ?? {};
  const eksikler: string[] = [];
  const asirilar: { label: string; len: number; limit: number }[] = [];

  for (const [key, meta] of Object.entries(METIN_ALANLARI)) {
    const val = typeof alanlar[key] === "string" ? (alanlar[key] as string) : "";
    if (!val.trim()) eksikler.push(meta.label);
    if (meta.limit && val.length > meta.limit) {
      asirilar.push({ label: meta.label, len: val.length, limit: meta.limit });
    }
  }

  const tamam = eksikler.length === 0 && asirilar.length === 0;

  return (
    <div className="space-y-5 max-w-3xl pb-24 text-[#2C2016]">
      {tamam ? (
        <div className="card-3d p-5 flex items-center gap-3.5 bg-emerald-50/80 border-emerald-300">
          <CheckCircle2 size={24} className="shrink-0 text-emerald-700" />
          <div>
            <h3 className="text-sm font-extrabold text-emerald-950">Form Tamamen Hazır</h3>
            <p className="text-xs text-emerald-800 font-medium mt-0.5">
              Tüm 20 alan eksiksiz dolduruldu ve karakter sınırları dahilinde.
            </p>
          </div>
        </div>
      ) : (
        <div className="card-3d p-5 flex items-center gap-3.5 bg-amber-50/80 border-amber-300">
          <AlertTriangle size={24} className="shrink-0 text-amber-700" />
          <div>
            <h3 className="text-sm font-extrabold text-amber-950">Düzenlenmesi Gereken Alanlar Var</h3>
            <p className="text-xs text-amber-800 font-medium mt-0.5">
              Başvurunun resmi onay alabilmesi için eksik veya limit aşımı olan alanları düzenleyin.
            </p>
          </div>
        </div>
      )}

      {/* Ar-Ge Değerlendirmesi */}
      {data.arge_uygunluk_degerlendirmesi && (
        <div className="card-3d p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-[#2C2016] text-xs sm:text-sm flex items-center gap-2">
              <Award size={18} className="text-[#2563EB]" />
              <span>Ar-Ge ve Yenilikçilik Uygunluk Değerlendirmesi</span>
            </h3>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-xl border ${
                data.arge_uygunluk_degerlendirmesi.puan === "Yüksek"
                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                  : data.arge_uygunluk_degerlendirmesi.puan === "Orta"
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : "bg-rose-100 text-rose-900 border-rose-300"
              }`}
            >
              Skor: {data.arge_uygunluk_degerlendirmesi.puan}
            </span>
          </div>
          {data.arge_uygunluk_degerlendirmesi.gerekce && (
            <p className="text-xs text-[#786655] font-medium leading-relaxed pt-3 border-t border-[#DFCFC0]">
              {data.arge_uygunluk_degerlendirmesi.gerekce}
            </p>
          )}
        </div>
      )}

      {/* Eksik Alanlar */}
      <div className="card-3d p-5 sm:p-6">
        <h3 className="font-extrabold text-[#2C2016] text-xs sm:text-sm mb-3.5 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>Boş Bırakılmış Alanlar ({eksikler.length})</span>
        </h3>
        {eksikler.length === 0 ? (
          <p className="text-xs text-[#16A34A] font-bold">Tüm form alanları dolu.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {eksikler.map((l) => (
              <div
                key={l}
                className="flex items-center gap-2 text-xs font-semibold text-[#2C2016] bg-[#EFE7DE] border border-[#DFCFC0] px-3.5 py-2.5 rounded-xl"
              >
                <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                <span className="truncate">{l}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Karakter Aşımı */}
      <div className="card-3d p-5 sm:p-6">
        <h3 className="font-extrabold text-[#2C2016] text-xs sm:text-sm mb-3.5 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span>Karakter Sınırını Aşan Alanlar ({asirilar.length})</span>
        </h3>
        {asirilar.length === 0 ? (
          <p className="text-xs text-[#16A34A] font-bold">Tüm alanlar limitler dahilinde.</p>
        ) : (
          <div className="space-y-2.5">
            {asirilar.map((a) => (
              <div
                key={a.label}
                className="flex items-center justify-between bg-rose-50 border border-rose-300 p-3 rounded-xl text-xs font-bold"
              >
                <span className="text-[#2C2016]">{a.label}</span>
                <span className="text-rose-800 font-mono">
                  {a.len} / {a.limit} ({a.len - a.limit} fazla)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AktarTab({
  dosya,
  projeAdi,
  data,
}: {
  dosya: string;
  projeAdi: string;
  data: ProjectData;
}) {
  const [indiriliyor, setIndiriliyor] = useState<string | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);

  async function download(path: string, fileName: string) {
    setIndiriliyor(path);
    try {
      const token = getToken();
      const res = await fetch(`/api${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("İndirme hatası");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "İndirme sırasında hata oluştu");
    } finally {
      setIndiriliyor(null);
    }
  }

  function handlePanoyaKopyalaTum() {
    const alanlar = data.alanlar ?? {};
    let cikti = `=== TEKNOPARK BAŞVURU FORMU: ${projeAdi} ===\n\n`;
    for (const [key, meta] of Object.entries(METIN_ALANLARI)) {
      cikti += `--- ${meta.label} ---\n${alanlar[key] || ""}\n\n`;
    }
    navigator.clipboard.writeText(cikti);
    setKopyalandi(true);
    setTimeout(() => setKopyalandi(false), 2500);
  }

  const kod = projeAdi.slice(0, 30).replace(/\s+/g, "_") || "proje";

  return (
    <div className="max-w-2xl space-y-6 pb-24 text-[#2C2016]">
      <div>
        <h2 className="text-base sm:text-lg font-extrabold text-[#2C2016]">Dışa Aktarma & Portal Aktarımı</h2>
        <p className="text-xs text-[#786655] font-medium mt-1">
          Resmi Word şablonunda indirin veya tek tuşla panoya kopyalayın.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Word Card */}
        <div className="card-3d p-6 flex flex-col justify-between">
          <div className="flex items-start gap-3.5 mb-5">
            <div className="w-10 h-10 bg-blue-100 text-[#2563EB] rounded-xl flex items-center justify-center shrink-0 border border-blue-200 border-b-2 border-b-blue-300">
              <Download size={20} />
            </div>
            <div>
              <p className="font-extrabold text-[#2C2016] text-sm">Resmi Word Şablonu (.docx)</p>
              <p className="text-[11px] text-[#786655] font-medium mt-1 leading-relaxed">
                Teknopark formatında tablolu resmi belge.
              </p>
            </div>
          </div>
          <button
            onClick={() => download(`/projeler/${dosya}/word`, `${kod}.docx`)}
            disabled={!!indiriliyor}
            className="w-full btn-3d-blue text-xs font-bold py-2.5 rounded-xl cursor-pointer"
          >
            {indiriliyor?.includes("word") ? "İndiriliyor..." : "Word Olarak İndir"}
          </button>
        </div>

        {/* TXT Card */}
        <div className="card-3d p-6 flex flex-col justify-between">
          <div className="flex items-start gap-3.5 mb-5">
            <div className="w-10 h-10 bg-[#EFE7DE] text-[#2C2016] rounded-xl flex items-center justify-center shrink-0 border border-[#DFCFC0] border-b-2 border-b-[#CDBCA9]">
              <FileText size={20} />
            </div>
            <div>
              <p className="font-extrabold text-[#2C2016] text-sm">Düz Metin Formatı (.txt)</p>
              <p className="text-[11px] text-[#786655] font-medium mt-1 leading-relaxed">
                Yalın başlık ve metin dökümü.
              </p>
            </div>
          </div>
          <button
            onClick={() => download(`/projeler/${dosya}/txt`, `${kod}.txt`)}
            disabled={!!indiriliyor}
            className="w-full btn-3d-neutral text-xs font-bold py-2.5 rounded-xl cursor-pointer"
          >
            {indiriliyor?.includes("txt") ? "İndiriliyor..." : "Düz Metin İndir"}
          </button>
        </div>
      </div>

      {/* Copy All */}
      <div className="card-3d p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-[#2C2016] text-sm sm:text-base">Tüm Formu Panoya Kopyala</h3>
          <p className="text-xs text-[#786655] font-medium mt-1">
            Portal kutularına hızlı yapıştırmak için tüm başlıkları tek tıkla kopyalar.
          </p>
        </div>
        <button
          onClick={handlePanoyaKopyalaTum}
          className="btn-3d-primary text-xs font-bold px-5 py-3 rounded-xl shrink-0 cursor-pointer"
        >
          {kopyalandi ? <Check size={15} className="mr-1.5" /> : <Copy size={15} className="mr-1.5" />}
          <span>{kopyalandi ? "Kopyalandı!" : "Tümünü Kopyala"}</span>
        </button>
      </div>
    </div>
  );
}

function VersiyonTab({ dosya, onGeriYukle }: { dosya: string; onGeriYukle: () => void }) {
  const { data } = useSWR<{ versiyonlar: Array<{ tarih: string; sonuc: ProjectData }> }>(
    `/projeler/${dosya}/versiyonlar`,
    swrFetcher
  );
  const [geriYukleniyor, setGeriYukleniyor] = useState<number | null>(null);
  const token = getToken();

  async function handleGeriYukle(idx: number) {
    if (!confirm("Bu sürümü geri yüklemek istediğinize emin misiniz?")) return;
    setGeriYukleniyor(idx);
    try {
      await fetch(`/api/projeler/${dosya}/versiyon-geri-al/${idx}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      onGeriYukle();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Hata oluştu");
    } finally {
      setGeriYukleniyor(null);
    }
  }

  const versiyonlar = data?.versiyonlar ?? [];

  return (
    <div className="max-w-2xl space-y-4 pb-24 text-[#2C2016]">
      <div>
        <h2 className="text-base sm:text-lg font-extrabold text-[#2C2016]">Sürüm Geçmişi</h2>
        <p className="text-xs text-[#786655] font-medium mt-1">
          Her kayıtta otomatik arşivlenir. Eski bir sürüme tek tuşla dönebilirsiniz.
        </p>
      </div>

      {versiyonlar.length === 0 ? (
        <div className="card-3d p-8 text-center">
          <Clock size={22} className="text-[#786655] mx-auto mb-2" />
          <p className="text-xs font-bold text-[#2C2016]">Henüz Sürüm Kaydı Yok</p>
          <p className="text-[11px] text-[#786655] mt-1 font-medium">
            Formda değişiklik yapıp "Kaydet" butonuna bastığınızda sürümler burada listelenir.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {versiyonlar.map((v, i) => (
            <div
              key={i}
              className="flex items-center justify-between card-3d p-3.5 text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-[#EFE7DE] text-[#2C2016] border border-[#DFCFC0] flex items-center justify-center font-extrabold text-[11px]">
                  v{versiyonlar.length - i}
                </span>
                <div>
                  <p className="font-bold text-[#2C2016]">
                    {(() => {
                      try {
                        return new Date(v.tarih).toLocaleString("tr-TR");
                      } catch {
                        return v.tarih;
                      }
                    })()}
                  </p>
                  <p className="text-[10px] text-[#786655] font-semibold">
                    {(v.sonuc?.alanlar?.proje_adi as string) || "İsimsiz"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleGeriYukle(i)}
                disabled={geriYukleniyor === i}
                className="btn-3d-neutral text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
              >
                {geriYukleniyor === i ? "Yükleniyor..." : "Bu Sürüme Dön"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjeEditor({ dosya }: { dosya: string }) {
  const { data, mutate, isLoading } = useSWR<ProjectData>(`/projeler/${dosya}`, swrFetcher);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-3">
        <div className="w-8 h-8 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-[#786655]">Proje verileri yükleniyor...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card-3d p-10 text-center max-w-md mx-auto my-12">
        <div className="w-11 h-11 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center mx-auto mb-3.5 border border-amber-300">
          <AlertTriangle size={22} />
        </div>
        <h2 className="text-sm font-bold text-[#2C2016] mb-1">Dosya Bulunamadı</h2>
        <p className="text-xs text-[#786655] mb-5 font-medium">
          İstediğiniz başvuru dosyası mevcut değil veya silinmiş olabilir.
        </p>
        <Link
          href="/projeler"
          className="btn-3d-primary font-bold text-xs px-4 py-2 rounded-xl"
        >
          <ArrowLeft size={15} className="mr-1" />
          <span>Projelere Dön</span>
        </Link>
      </div>
    );
  }

  const projeAdi = (data.alanlar?.proje_adi as string) || "İsimsiz Proje";
  const projeKodu = data.alanlar?.proje_kodu as string | undefined;

  const eksikler = Object.keys(METIN_ALANLARI).filter(
    (k) => !String(data.alanlar?.[k] ?? "").trim()
  );

  return (
    <div className="space-y-6 max-w-6xl pb-16 text-[#2C2016]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-[1.5px] border-[#DFCFC0]">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/projeler"
            className="flex items-center justify-center w-9 h-9 rounded-xl border-[1.5px] border-[#DFCFC0] bg-[#EFE7DE] hover:bg-[#E5DCD0] text-[#2C2016] transition-colors shrink-0 cursor-pointer shadow-2xs"
            title="Geri dön"
          >
            <ArrowLeft size={17} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-extrabold text-[#2C2016] tracking-tight truncate">
                {projeAdi}
              </h1>
              {projeKodu && projeKodu !== "?" && (
                <span className="text-[11px] font-mono font-bold text-blue-900 bg-blue-100 border border-blue-300 px-2.5 py-0.5 rounded-lg shrink-0">
                  {projeKodu}
                </span>
              )}
            </div>
            <p className="text-xs text-[#786655] font-semibold mt-0.5">Teknopark Başvuru Formu Düzenleyicisi</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs.Root defaultValue="form">
        <Tabs.List className="flex items-center gap-2 pb-2 mb-6 overflow-x-auto scrollbar-none">
          {[
            { value: "form", label: "Form Alanları", icon: FileText },
            { value: "asistan", label: "AI Asistanı", icon: MessageSquare },
            {
              value: "kontrol",
              label: "Uygunluk & Kontrol",
              icon: ShieldCheck,
              badge: eksikler.length > 0 ? eksikler.length : undefined,
            },
            { value: "aktar", label: "Dışa Aktar", icon: Download },
            { value: "versiyonlar", label: "Sürümler", icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <Tabs.Trigger
                key={tab.value}
                value={tab.value}
                className="group flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border-[1.5px] border-[#DFCFC0] data-[state=active]:bg-[#2563EB] data-[state=active]:text-white data-[state=active]:border-[#1D4ED8] data-[state=active]:border-b-3 data-[state=active]:shadow-xs data-[state=inactive]:bg-[#EFE7DE] data-[state=inactive]:text-[#786655] hover:text-[#2C2016] transition-all shrink-0 cursor-pointer shadow-2xs"
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="text-[10px] font-extrabold bg-[#DC2626] text-white px-2 py-0.2 rounded-full">
                    {tab.badge}
                  </span>
                )}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>

        <Tabs.Content value="form">
          <FormTab dosya={dosya} data={data} onSaved={() => mutate()} />
        </Tabs.Content>
        <Tabs.Content value="asistan">
          <AsistanTab dosya={dosya} />
        </Tabs.Content>
        <Tabs.Content value="kontrol">
          <KontrolTab data={data} />
        </Tabs.Content>
        <Tabs.Content value="aktar">
          <AktarTab dosya={dosya} projeAdi={projeAdi} data={data} />
        </Tabs.Content>
        <Tabs.Content value="versiyonlar">
          <VersiyonTab dosya={dosya} onGeriYukle={() => mutate()} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

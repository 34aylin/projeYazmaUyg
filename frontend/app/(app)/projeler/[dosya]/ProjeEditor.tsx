"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Download, Send, AlertTriangle, CheckCircle, History, Wand2, Loader2 } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { swrFetcher, ProjectData, Message, updateProje, ApiError, apiFetch } from "@/lib/api";
import { METIN_ALANLARI } from "@/lib/fields";
import { getToken } from "@/lib/auth";
import { getAyarlar } from "@/lib/ayarlar";
import Link from "next/link";

// ── Form Tab ──────────────────────────────────────────────────────────────

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

function FormTab({ dosya, data, onSaved }: { dosya: string; data: ProjectData; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [tamamlaniyor, setTamamlaniyor] = useState(false);
  const [mesaj, setMesaj] = useState<{ tip: "ok" | "hata"; metin: string } | null>(null);
  const [editMod, setEditMod] = useState<Record<string, boolean>>({});
  const [sadeceAi, setSadeceAi] = useState(false);

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
      setMesaj({ tip: "hata", metin: e instanceof Error ? e.message : "Hata." });
    } finally {
      setTamamlaniyor(false);
    }
  }

  async function handleKaydet() {
    setKaydediliyor(true);
    setMesaj(null);
    try {
      await updateProje(dosya, form, data);
      setMesaj({ tip: "ok", metin: "Kaydedildi." });
      setTimeout(() => setMesaj(null), 3000);
      onSaved();
    } catch (e) {
      setMesaj({ tip: "hata", metin: e instanceof ApiError ? e.message : "Kaydetme hatası." });
    } finally {
      setKaydediliyor(false);
    }
  }

  const aiTahminListesi = Object.entries(METIN_ALANLARI)
    .flatMap(([key, meta]) => {
      const tahminler = (data.tahminler?.[key] ?? []) as string[];
      return tahminler.map((t) => ({ alan: meta.label, cumle: t.replace(/^~/, "") }));
    });

  return (
    <div>
      {aiTahminListesi.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setSadeceAi((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              sadeceAi
                ? "bg-red-50 border-red-300 text-red-700"
                : "bg-white border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-600"
            }`}
          >
            <Wand2 size={12} />
            {sadeceAi ? "← Forma dön" : `AI tahminlerini göster (${aiTahminListesi.length})`}
          </button>
        </div>
      )}

      {sadeceAi && (
        <div className="space-y-3 pb-24">
          {aiTahminListesi.map((item, i) => (
            <div key={i} className="bg-white border border-red-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-gray-400 mb-1">{item.alan}</p>
              <p className="text-sm text-red-600 leading-relaxed">{item.cumle}</p>
            </div>
          ))}
        </div>
      )}
      {!sadeceAi && <div className="space-y-5 pb-24">
        {Object.entries(METIN_ALANLARI).map(([key, meta]) => {
          const val = form[key] ?? "";
          const len = val.length;
          const asiri = meta.limit ? len > meta.limit : false;
          const dusuk = meta.onerilen ? len > 0 && len < meta.onerilen[0] : false;
          const eksikIcerik = val.includes("[EKSİK");
          const eksikAlan = val.trim() === "";

          const tahminler = (data.tahminler?.[key] ?? []) as string[];
          const hasAi = tahminler.length > 0 && !editMod[key];
          const rows = key === "proje_detayi" ? 14
            : key === "arge_niteligi" || key === "proje_konusu" ? 8
            : key === "proje_adi" || key === "proje_kodu" || key === "anahtar_kelimeler" ? 2
            : 5;

          return (
            <div key={key}>
              <div className="flex items-start justify-between mb-1.5 gap-2">
                <label className="text-sm font-semibold text-gray-800 leading-tight flex items-center gap-1.5">
                  {meta.label}
                  {eksikAlan && <span className="text-xs font-normal text-red-400">boş</span>}
                  {eksikIcerik && !eksikAlan && (
                    <span className="text-xs font-normal text-amber-500">[EKSİK içerik var]</span>
                  )}
                  {tahminler.length > 0 && (
                    <span className="text-xs font-normal text-red-500 bg-red-50 px-1.5 py-0.5 rounded">AI tahmini</span>
                  )}
                </label>
                <div className="flex items-center gap-2 shrink-0">
                  {tahminler.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setEditMod((p) => ({ ...p, [key]: !p[key] }))}
                      className="text-xs text-indigo-500 hover:text-indigo-700"
                    >
                      {editMod[key] ? "Önizle" : "Düzenle"}
                    </button>
                  )}
                  <span className={`text-xs tabular-nums ${asiri ? "text-red-600 font-bold" : dusuk ? "text-amber-500" : "text-gray-400"}`}>
                    {len.toLocaleString("tr-TR")}
                    {meta.limit ? ` / ${meta.limit.toLocaleString("tr-TR")}` : ""}
                    {meta.onerilen && !meta.limit ? ` (önerilen: ${meta.onerilen[0].toLocaleString("tr-TR")}–${meta.onerilen[1].toLocaleString("tr-TR")})` : ""}
                  </span>
                </div>
              </div>
              {hasAi ? (
                <div
                  onClick={() => setEditMod((p) => ({ ...p, [key]: true }))}
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap cursor-text min-h-[${rows * 1.6}rem] ${
                    asiri ? "border-red-400 bg-red-50/50" : "border-gray-300 bg-white"
                  }`}
                >
                  {aiParcala(val, tahminler).map((p, i) =>
                    p.ai
                      ? <span key={i} className="text-red-600 font-medium">{p.metin}</span>
                      : <span key={i}>{p.metin}</span>
                  )}
                </div>
              ) : (
                <textarea
                  value={val}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  rows={rows}
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                    asiri ? "border-red-400 bg-red-50/50" : eksikAlan ? "border-gray-200 bg-gray-50/50" : "border-gray-300 bg-white"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>}

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-60 right-0 bg-white border-t border-gray-200 px-8 py-4 flex items-center gap-3 z-10">
        <button
          onClick={handleKaydet}
          disabled={kaydediliyor || tamamlaniyor}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          <Save size={15} />
          {kaydediliyor ? "Kaydediliyor..." : "Kaydet"}
        </button>
        <button
          onClick={handleTamamla}
          disabled={kaydediliyor || tamamlaniyor}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          title="Formdaki [EKSİK] alanları bağlama göre AI ile doldur"
        >
          {tamamlaniyor ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
          {tamamlaniyor ? "Tamamlanıyor..." : "Bağlama göre doldur"}
        </button>
        {mesaj && (
          <span className={`flex items-center gap-1.5 text-sm ${mesaj.tip === "ok" ? "text-green-600" : "text-red-600"}`}>
            {mesaj.tip === "ok" ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            {mesaj.metin}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Asistan Tab ────────────────────────────────────────────────────────────

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

  async function handleGonder() {
    if (!girdi.trim() || gonderiliyor) return;
    const kullaniciMesaj = girdi.trim();
    setGirdi("");
    setGonderiliyor(true);
    setSonucMesaj("");
    setYerelMesajlar([{ role: "user", content: kullaniciMesaj }]);

    try {
      const token = getToken();
      const res = await fetch(`/api/ai/sohbet/${dosya}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mesaj: kullaniciMesaj }),
      });

      if (!res.ok) throw new Error(`Hata ${res.status}`);
      const data = await res.json();

      if (data.type === "done") {
        setSonucMesaj(data.yanit ?? "");
        setYerelMesajlar([]);
        mutateSohbet();
      } else if (data.type === "error") {
        setSonucMesaj("Hata: " + data.msg);
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

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 220px)" }}>
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
        {tumMesajlar.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            <p className="text-base mb-1">Asistana soru sorun</p>
            <p>Alanları düzeltmek, geliştirmek veya fikir almak için mesaj yazın.</p>
          </div>
        ) : tumMesajlar.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === "user" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {gonderiliyor && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-500">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
        <div ref={sonRef} />
      </div>

      <div className="flex gap-3 border-t border-gray-200 pt-4">
        <textarea
          value={girdi}
          onChange={(e) => setGirdi(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGonder(); } }}
          rows={2}
          placeholder="Mesajınızı yazın... (Enter gönder, Shift+Enter yeni satır)"
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={gonderiliyor}
        />
        <button
          onClick={handleGonder}
          disabled={!girdi.trim() || gonderiliyor}
          className="self-end flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          <Send size={14} />
          Gönder
        </button>
      </div>
    </div>
  );
}

// ── Kontrol Tab ────────────────────────────────────────────────────────────

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
    <div className="space-y-5 max-w-2xl">
      {tamam && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
          <CheckCircle size={20} className="text-green-500 shrink-0" />
          <p className="text-sm font-medium text-green-700">Tüm alanlar dolu ve limit dahilinde.</p>
        </div>
      )}

      {data.arge_uygunluk_degerlendirmesi && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-2">Ar-Ge Uygunluk Değerlendirmesi</h3>
          <p className={`text-sm font-bold mb-1 ${
            data.arge_uygunluk_degerlendirmesi.puan === "Yüksek" ? "text-emerald-600"
              : data.arge_uygunluk_degerlendirmesi.puan === "Orta" ? "text-yellow-600" : "text-red-600"
          }`}>
            {data.arge_uygunluk_degerlendirmesi.puan}
          </p>
          {data.arge_uygunluk_degerlendirmesi.gerekce && (
            <p className="text-sm text-gray-600 leading-relaxed">{data.arge_uygunluk_degerlendirmesi.gerekce}</p>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          {eksikler.length > 0 ? <AlertTriangle size={16} className="text-amber-500" /> : <CheckCircle size={16} className="text-green-500" />}
          <h3 className="font-semibold text-gray-900 text-sm">Eksik Alanlar ({eksikler.length})</h3>
        </div>
        {eksikler.length === 0 ? (
          <p className="text-sm text-green-600">Tüm alanlar dolu.</p>
        ) : (
          <ul className="space-y-1.5">
            {eksikler.map((l) => (
              <li key={l} className="flex items-center gap-2 text-sm text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                {l}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          {asirilar.length > 0 ? <AlertTriangle size={16} className="text-red-500" /> : <CheckCircle size={16} className="text-green-500" />}
          <h3 className="font-semibold text-gray-900 text-sm">Karakter Limiti Aşımı ({asirilar.length})</h3>
        </div>
        {asirilar.length === 0 ? (
          <p className="text-sm text-green-600">Tüm alanlar limit dahilinde.</p>
        ) : (
          <ul className="space-y-2">
            {asirilar.map((a) => (
              <li key={a.label} className="text-sm">
                <span className="font-medium text-gray-800">{a.label}</span>
                <span className="text-red-500 ml-2 text-xs">
                  {a.len.toLocaleString("tr-TR")} / {a.limit.toLocaleString("tr-TR")} karakter
                  <span className="ml-1">({(a.len - a.limit).toLocaleString("tr-TR")} fazla)</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(data.eksik_bilgiler?.length ?? 0) > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Temin Edilecek Bilgiler</h3>
          <ul className="space-y-1.5">
            {data.eksik_bilgiler!.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Aktar Tab ──────────────────────────────────────────────────────────────

function AktarTab({ dosya, projeAdi }: { dosya: string; projeAdi: string }) {
  const [indiriliyor, setIndiriliyor] = useState<string | null>(null);

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
      alert(e instanceof Error ? e.message : "Hata");
    } finally {
      setIndiriliyor(null);
    }
  }

  const kod = projeAdi.slice(0, 30).replace(/\s+/g, "_") || "proje";

  return (
    <div className="max-w-lg space-y-4">
      <p className="text-sm text-gray-500">Proje verilerini farklı formatlarda indirin.</p>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <button
          onClick={() => download(`/projeler/${dosya}/word`, `${kod}.docx`)}
          disabled={!!indiriliyor}
          className="flex items-center gap-3 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 rounded-xl p-5 transition-colors text-left disabled:opacity-50"
        >
          <div className="bg-blue-100 text-blue-600 p-2.5 rounded-lg shrink-0">
            <Download size={20} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Word İndir</p>
            <p className="text-xs text-gray-400 mt-0.5">.docx formatında</p>
          </div>
        </button>

        <button
          onClick={() => download(`/projeler/${dosya}/txt`, `${kod}.txt`)}
          disabled={!!indiriliyor}
          className="flex items-center gap-3 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl p-5 transition-colors text-left disabled:opacity-50"
        >
          <div className="bg-gray-100 text-gray-600 p-2.5 rounded-lg shrink-0">
            <Download size={20} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">TXT İndir</p>
            <p className="text-xs text-gray-400 mt-0.5">Düz metin formatında</p>
          </div>
        </button>
      </div>

      {indiriliyor && (
        <p className="text-sm text-indigo-600 animate-pulse">İndiriliyor...</p>
      )}
    </div>
  );
}

// ── Versiyon Tab ───────────────────────────────────────────────────────────

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
      alert(e instanceof Error ? e.message : "Hata");
    } finally {
      setGeriYukleniyor(null);
    }
  }

  const versiyonlar = data?.versiyonlar ?? [];

  return (
    <div className="max-w-xl">
      {versiyonlar.length === 0 ? (
        <p className="text-sm text-gray-500">Henüz sürüm kaydı yok. Kaydet butonuna her bastığınızda önceki sürüm saklanır.</p>
      ) : (
        <div className="space-y-3">
          {versiyonlar.map((v, i) => (
            <div key={i} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {(() => {
                    try {
                      return new Date(v.tarih).toLocaleString("tr-TR", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      });
                    } catch { return v.tarih; }
                  })()}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {v.sonuc?.alanlar?.proje_adi as string || "İsimsiz"}
                </p>
              </div>
              <button
                onClick={() => handleGeriYukle(i)}
                disabled={geriYukleniyor === i}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 hover:border-indigo-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {geriYukleniyor === i ? "Yükleniyor..." : "Geri yükle"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export function ProjeEditor({ dosya }: { dosya: string }) {
  const { data, mutate, isLoading } = useSWR<ProjectData>(`/projeler/${dosya}`, swrFetcher);

  if (isLoading) {
    return <div className="flex items-center justify-center py-24 text-gray-400 text-sm">Yükleniyor...</div>;
  }

  if (!data) {
    return (
      <div className="text-center py-24">
        <p className="text-gray-500 mb-2">Proje bulunamadı.</p>
        <Link href="/projeler" className="text-indigo-600 text-sm hover:underline">Geri dön</Link>
      </div>
    );
  }

  const projeAdi = (data.alanlar?.proje_adi as string) || "İsimsiz Proje";
  const projeKodu = data.alanlar?.proje_kodu as string | undefined;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/projeler" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 shrink-0">
          <ArrowLeft size={15} />
          Geri
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{projeAdi}</h1>
          {projeKodu && <p className="text-xs text-gray-400 font-mono mt-0.5">{projeKodu}</p>}
        </div>
      </div>

      <Tabs.Root defaultValue="form">
        <Tabs.List className="flex gap-0.5 border-b border-gray-200 mb-6 -mx-0">
          {[
            { value: "form", label: "Form" },
            { value: "asistan", label: "Asistan" },
            { value: "kontrol", label: "Kontrol" },
            { value: "aktar", label: "Aktar" },
            { value: "versiyonlar", label: "Sürümler", icon: History },
          ].map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-900 border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 transition-colors -mb-px"
            >
              {tab.icon && <tab.icon size={13} />}
              {tab.label}
            </Tabs.Trigger>
          ))}
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
          <AktarTab dosya={dosya} projeAdi={projeAdi} />
        </Tabs.Content>
        <Tabs.Content value="versiyonlar">
          <VersiyonTab dosya={dosya} onGeriYukle={() => mutate()} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

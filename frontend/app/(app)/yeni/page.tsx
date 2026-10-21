"use client";

import { useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload, Globe, FileText, CheckCircle, AlertTriangle, X, Loader2 } from "lucide-react";
import { getToken } from "@/lib/auth";
import { getAyarlar, SAGLAYICILAR, EFOR_SEVIYELERI } from "@/lib/ayarlar";

export default function YeniPage() {
  const router = useRouter();
  const dosyaRef = useRef<HTMLInputElement>(null);

  const [pdf, setPdf] = useState<File | null>(null);
  const [webUrl, setWebUrl] = useState("");
  const [notlar, setNotlar] = useState("");

  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [ilerleme, setIlerleme] = useState("");
  const [hata, setHata] = useState("");
  const [tamamlandi, setTamamlandi] = useState(false);

  function handleDosyaSec(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setPdf(f);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (gonderiliyor) return;

    const ayarlar = getAyarlar();

    setHata("");
    setIlerleme("");
    setTamamlandi(false);
    setGonderiliyor(true);

    const formData = new FormData();
    if (pdf) formData.append("pdf", pdf);
    if (webUrl.trim()) formData.append("web_url", webUrl.trim());
    if (notlar.trim()) formData.append("kullanici_cevaplari", notlar.trim());
    formData.append("saglayici", ayarlar.saglayici);
    formData.append("efor", ayarlar.efor);

    const token = getToken();

    try {
      const res = await fetch("/api/ai/doldur", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        let msg = res.statusText;
        try { const j = await res.clone().json(); msg = j.detail ?? j.message ?? msg; } catch { /* ignore */ }
        throw new Error(msg);
      }

      if (!res.body) throw new Error("Sunucu yanıt vermiyor.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sonDosya = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          try {
            // Backend: { type: "progress"|"done"|"error", msg?: string, sonuc?: {...}, dosya?: string }
            const olay = JSON.parse(payload) as { type: string; msg?: string; dosya?: string };
            if (olay.type === "progress" && olay.msg) {
              setIlerleme(olay.msg);
            } else if (olay.type === "done") {
              setTamamlandi(true);
              sonDosya = olay.dosya ?? "";
            } else if (olay.type === "error") {
              setHata(olay.msg ?? "Bilinmeyen hata.");
            }
          } catch { /* JSON parse hatası — atla */ }
        }
      }

      if (sonDosya) {
        setTimeout(() => router.push(`/projeler/${sonDosya}`), 1200);
      }
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Bilinmeyen hata.");
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Yeni Başvuru</h1>
        <p className="text-sm text-gray-500 mt-1">
          Firma belgelerinizi ve web sitenizi yükleyin, yapay zekâ formu otomatik dolduracak.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* PDF */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Upload size={15} className="text-gray-400" />
            Firma / ürün tanıtım PDF'i
            <span className="text-xs font-normal text-gray-400">(isteğe bağlı)</span>
          </h2>
          <div
            onClick={() => dosyaRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
              pdf ? "border-indigo-300 bg-indigo-50/40" : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/20"
            }`}
          >
            {pdf ? (
              <div className="flex items-center justify-center gap-2">
                <FileText size={15} className="text-indigo-600" />
                <span className="text-sm font-medium text-indigo-700 truncate max-w-xs">{pdf.name}</span>
                <button
                  type="button"
                  onClick={(ev) => { ev.stopPropagation(); setPdf(null); if (dosyaRef.current) dosyaRef.current.value = ""; }}
                  className="text-gray-400 hover:text-red-500 ml-1"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500">PDF seçin veya sürükleyin</p>
                <p className="text-xs text-gray-400 mt-0.5">Maks. 32 MB</p>
              </div>
            )}
          </div>
          <input ref={dosyaRef} type="file" accept=".pdf" className="hidden" onChange={handleDosyaSec} />
        </div>

        {/* Web URL */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Globe size={15} className="text-gray-400" />
            Firma / ürün web adresi
            <span className="text-xs font-normal text-gray-400">(isteğe bağlı)</span>
          </h2>
          <input
            type="url"
            value={webUrl}
            onChange={(e) => setWebUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Notlar */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">
            Proje hakkında notlar
            <span className="text-xs font-normal text-gray-400 ml-2">(isteğe bağlı)</span>
          </h2>
          <textarea
            value={notlar}
            onChange={(e) => setNotlar(e.target.value)}
            rows={5}
            placeholder="Proje ne yapıyor, hedef pazar, kullanılan teknolojiler, rakiplerden farkı..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* İlerleme */}
        {gonderiliyor && (
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <Loader2 size={13} className="animate-spin shrink-0 text-indigo-400" />
            <p className="text-xs text-gray-600 truncate">{ilerleme || "Hazırlanıyor..."}</p>
          </div>
        )}

        {/* Hata */}
        {hata && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            {hata}
          </div>
        )}

        {/* Başarı */}
        {tamamlandi && !hata && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
            <CheckCircle size={15} />
            Form başarıyla dolduruldu. Proje sayfasına yönlendiriliyor...
          </div>
        )}

        <button
          type="submit"
          disabled={gonderiliyor || tamamlandi}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {gonderiliyor ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Hazırlanıyor...
            </>
          ) : "Başvuruyu Hazırla"}
        </button>
      </form>
    </div>
  );
}

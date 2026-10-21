"use client";

import { useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Globe,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Sparkles,
  ArrowRight,
  Cpu,
  Layers,
} from "lucide-react";
import { getToken } from "@/lib/auth";
import { useAyarlar, SAGLAYICILAR, EFOR_SEVIYELERI } from "@/lib/ayarlar";

export default function YeniPage() {
  const router = useRouter();
  const dosyaRef = useRef<HTMLInputElement>(null);
  const { saglayici, setSaglayici, efor, setEfor } = useAyarlar();

  const [pdf, setPdf] = useState<File | null>(null);
  const [webUrl, setWebUrl] = useState("");
  const [notlar, setNotlar] = useState("");

  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [ilerleme, setIlerleme] = useState("");
  const [hata, setHata] = useState("");
  const [tamamlandi, setTamamlandi] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  function handleDosyaSec(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setPdf(f);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type === "application/pdf") {
      setPdf(f);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (gonderiliyor) return;

    setHata("");
    setIlerleme("Belgeler taranıyor ve analiz başlatılıyor...");
    setTamamlandi(false);
    setGonderiliyor(true);

    const formData = new FormData();
    if (pdf) formData.append("pdf", pdf);
    if (webUrl.trim()) formData.append("web_url", webUrl.trim());
    if (notlar.trim()) formData.append("kullanici_cevaplari", notlar.trim());
    formData.append("saglayici", saglayici);
    formData.append("efor", efor);

    const token = getToken();

    try {
      const res = await fetch("/api/ai/doldur", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        let msg = res.statusText;
        try {
          const j = await res.clone().json();
          msg = j.detail ?? j.message ?? msg;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }

      if (!res.body) throw new Error("Sunucu yanıt akışı başlatılamadı.");

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
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "progress") {
              setIlerleme(data.msg ?? "İşleniyor...");
            } else if (data.type === "done") {
              sonDosya = data.dosya ?? "";
              setTamamlandi(true);
              setIlerleme("Form tamamlandı, proje sayfasına yönlendiriliyorsunuz...");
              setTimeout(() => {
                if (sonDosya) router.push(`/projeler/${sonDosya}`);
                else router.push("/projeler");
              }, 1200);
            } else if (data.type === "error") {
              throw new Error(data.msg ?? "İşlem sırasında hata oluştu.");
            }
          } catch (pe) {
            if (pe instanceof Error && !pe.message.includes("JSON")) {
              throw pe;
            }
          }
        }
      }
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu.");
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 text-[#2C2016]">
      {/* ── HEADER ───────────────────────────────────────────────────── */}
      <div className="pb-4 border-b-[1.5px] border-[#DFCFC0]">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2C2016] tracking-tight">
          Yeni Başvuru Başlat
        </h1>
        <p className="text-xs text-[#786655] font-medium mt-1">
          Firma tanıtım broşürü, şartname veya teknik PDF dokümanınızı yükleyin; yapay zekâ başvuru alanlarını mevzuata uygun doldursun.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Belge Yükleme with 3D Rounded Card */}
        <div className="card-3d p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#DFCFC0]">
            <span className="w-6 h-6 rounded-lg bg-[#2563EB] border-b-2 border-[#1D4ED8] text-white flex items-center justify-center font-extrabold text-xs">
              1
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-[#2C2016]">
              Firma ve Proje Dokümanları
            </h2>
          </div>

          {/* PDF Dropzone */}
          <div>
            <label className="block text-xs font-bold text-[#2C2016] mb-1.5">
              Tanıtım / Proje PDF Dosyası
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => dosyaRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-[#2563EB] bg-blue-50"
                  : pdf
                  ? "border-blue-300 bg-blue-50/60"
                  : "border-[#DFCFC0] bg-[#EFE7DE]/50 hover:border-[#2563EB] hover:bg-[#EFE7DE]"
              }`}
            >
              {pdf ? (
                <div className="flex items-center justify-between bg-[#FFFDF9] p-3.5 rounded-xl border border-[#DFCFC0] shadow-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#2563EB] flex items-center justify-center shrink-0 border border-blue-200">
                      <FileText size={20} />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-xs font-bold text-[#2C2016] truncate">{pdf.name}</p>
                      <p className="text-[10px] text-[#786655] font-semibold">{formatBytes(pdf.size)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setPdf(null);
                      if (dosyaRef.current) dosyaRef.current.value = "";
                    }}
                    className="p-1.5 text-[#786655] hover:text-[#DC2626] hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                    title="Dosyayı kaldır"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  <div className="w-12 h-12 bg-[#EFE7DE] text-[#2563EB] rounded-2xl flex items-center justify-center mx-auto border border-[#DFCFC0] border-b-2 border-b-[#CDBCA9]">
                    <Upload size={22} />
                  </div>
                  <p className="text-xs font-bold text-[#2C2016]">
                    PDF dosyasını sürükleyin veya <span className="underline text-[#2563EB]">seçin</span>
                  </p>
                  <p className="text-[11px] text-[#786655] font-medium">
                    Firma sunumu, teknik şartname veya ürün tanıtımı (Maks. 32 MB)
                  </p>
                </div>
              )}
            </div>
            <input ref={dosyaRef} type="file" accept=".pdf" className="hidden" onChange={handleDosyaSec} />
          </div>

          {/* Web URL */}
          <div>
            <label className="block text-xs font-bold text-[#2C2016] mb-1.5">
              Firma Web Sitesi <span className="text-[#786655] font-medium">(İsteğe bağlı)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#786655]">
                <Globe size={15} />
              </div>
              <input
                type="url"
                value={webUrl}
                onChange={(e) => setWebUrl(e.target.value)}
                placeholder="https://firma-adi.com.tr"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#EFE7DE] border-[1.5px] border-[#DFCFC0] text-[#2C2016] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#2563EB] transition-colors placeholder-[#8F7D6D]"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-[#2C2016] mb-1.5">
              Ek Bilgiler & Proje Notları <span className="text-[#786655] font-medium">(İsteğe bağlı)</span>
            </label>
            <textarea
              value={notlar}
              onChange={(e) => setNotlar(e.target.value)}
              rows={3}
              placeholder="Örnek: 'Görüntü işleme tabanlı kalite kontrol sistemi geliştiriyoruz. CUDA ve PyTorch kullanıyoruz...'"
              className="w-full p-3.5 bg-[#EFE7DE] border-[1.5px] border-[#DFCFC0] text-[#2C2016] font-medium rounded-xl text-xs focus:outline-none focus:border-[#2563EB] transition-colors placeholder-[#8F7D6D] resize-y"
            />
          </div>
        </div>

        {/* Section 2: AI Config with 3D Rounded Card */}
        <div className="card-3d p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#DFCFC0]">
            <span className="w-6 h-6 rounded-lg bg-[#16A34A] border-b-2 border-[#14532D] text-white flex items-center justify-center font-extrabold text-xs">
              2
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-[#2C2016]">
              Yapay Zekâ Analiz Seçenekleri
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Model Selection */}
            <div>
              <label className="block text-xs font-bold text-[#2C2016] mb-1.5 flex items-center gap-1.5">
                <Cpu size={14} className="text-[#2563EB]" />
                <span>Analiz Modeli</span>
              </label>
              <div className="space-y-1.5">
                {SAGLAYICILAR.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSaglayici(s)}
                    className={`w-full flex items-center justify-between text-left text-xs px-3.5 py-2.5 rounded-xl border-[1.5px] transition-all cursor-pointer ${
                      saglayici === s
                        ? "bg-[#2563EB] text-white font-extrabold border-[#1D4ED8] shadow-xs"
                        : "bg-[#EFE7DE] text-[#2C2016] font-bold border-[#DFCFC0] hover:bg-[#E5DCD0]"
                    }`}
                  >
                    <span>{s}</span>
                    {saglayici === s && <span className="w-2 h-2 rounded-full bg-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Depth Selection */}
            <div>
              <label className="block text-xs font-bold text-[#2C2016] mb-1.5 flex items-center gap-1.5">
                <Layers size={14} className="text-[#16A34A]" />
                <span>Analiz Derinliği</span>
              </label>
              <div className="space-y-1.5">
                {EFOR_SEVIYELERI.map((e) => (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => setEfor(e.value)}
                    className={`w-full flex items-center justify-between text-left text-xs px-3.5 py-2.5 rounded-xl border-[1.5px] transition-all cursor-pointer ${
                      efor === e.value
                        ? "bg-[#16A34A] text-white font-extrabold border-[#14532D] shadow-xs"
                        : "bg-[#EFE7DE] text-[#2C2016] font-bold border-[#DFCFC0] hover:bg-[#E5DCD0]"
                    }`}
                  >
                    <span>{e.label}</span>
                    {efor === e.value && <span className="w-2 h-2 rounded-full bg-white shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Status Banners */}
        {gonderiliyor && (
          <div className="card-3d p-5 space-y-3 border-blue-200">
            <div className="flex items-center gap-3.5">
              <Loader2 size={18} className="animate-spin text-[#2563EB]" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-[#2C2016]">Yapay zekâ başvuruyu hazırlıyor...</p>
                <p className="text-xs text-[#786655] font-medium truncate">{ilerleme}</p>
              </div>
            </div>
            <div className="w-full h-2 bg-[#EFE7DE] rounded-full overflow-hidden border border-[#DFCFC0]">
              <div className="h-full bg-[#2563EB] rounded-full w-2/3 animate-pulse" />
            </div>
          </div>
        )}

        {hata && (
          <div className="card-3d p-4 flex items-start gap-3 bg-rose-50 border-rose-300 text-xs">
            <AlertTriangle size={18} className="shrink-0 text-rose-700 mt-0.5" />
            <div>
              <p className="font-extrabold text-rose-950">İşlem Tamamlanamadı</p>
              <p className="text-xs text-rose-800 font-medium mt-0.5">{hata}</p>
            </div>
          </div>
        )}

        {tamamlandi && !hata && (
          <div className="card-3d p-4 flex items-center gap-3 bg-emerald-50 border-emerald-300 text-xs">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-700" />
            <div>
              <p className="font-extrabold text-emerald-950">Başvuru Başarıyla Oluşturuldu!</p>
              <p className="text-xs text-emerald-800 font-medium mt-0.5">Form sayfasına yönlendiriliyorsunuz...</p>
            </div>
          </div>
        )}

        {/* 3D PRIMARY SUBMIT BUTTON */}
        <button
          type="submit"
          disabled={gonderiliyor || tamamlandi}
          className="w-full btn-3d-primary disabled:opacity-50 text-white font-extrabold py-3.5 px-6 rounded-xl text-sm shadow-md cursor-pointer"
        >
          {gonderiliyor ? (
            <>
              <Loader2 size={18} className="animate-spin mr-2" />
              <span>Analiz Yapılıyor...</span>
            </>
          ) : (
            <>
              <Sparkles size={18} className="mr-2" />
              <span>Başvuruyu Otomatik Hazırla</span>
              <ArrowRight size={18} className="ml-2" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

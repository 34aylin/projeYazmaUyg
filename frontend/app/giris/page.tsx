"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { giris } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function GirisPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [sifreGoster, setSifreGoster] = useState(false);
  const [hata, setHata] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setHata("");
    setYukleniyor(true);
    try {
      const data = await giris(email, sifre);
      setToken(data.token);
      router.push("/panel");
    } catch {
      setHata("E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.");
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4EFEA] text-[#2C2016] p-4 sm:p-6 lg:p-8 font-sans">
      {/* Main 3D Card with Clearly Rounded Corners */}
      <div className="w-full max-w-4xl rounded-3xl border-[1.5px] border-[#DFCFC0] bg-[#FFFDF9] shadow-[0_8px_30px_rgba(70,45,20,0.08),0_2px_0_#DFCFC0] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Info Column */}
        <div className="lg:col-span-7 p-7 sm:p-10 flex flex-col justify-between bg-[#EFE7DE]/60 border-b lg:border-b-0 lg:border-r-[1.5px] border-[#DFCFC0]">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 text-[#2563EB] text-xs font-extrabold mb-6 border border-blue-200 shadow-2xs">
              <Sparkles size={14} />
              <span>Teknopark Başvuru Asistanı</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2C2016] tracking-tight mb-2.5">
              Ar-Ge & İnovasyon Portalı
            </h1>

            <p className="text-[#786655] text-xs sm:text-sm font-medium leading-relaxed mb-6">
              Firma dokümanlarınızı yükleyin; NACE Rev. 2.1 ve Frascati standartlarında tüm Ar-Ge başvuru
              dosyalarınızı otomatik formüle edip tek tuşla portala aktarın.
            </p>

            {/* Feature Points with 3D Depth */}
            <div className="space-y-3 mb-6">
              {[
                {
                  code: "01",
                  title: "NACE Rev. 2.1 & Frascati Doğrulama",
                  desc: "Faaliyet alanına uygun resmi 6 haneli kod ve Ar-Ge puanı analizi.",
                },
                {
                  code: "02",
                  title: "20 Alan Karakter Sınırı Kontrolü",
                  desc: "Portaldaki giriş limitlerini gerçek zamanlı denetler ve taşmaları önler.",
                },
                {
                  code: "03",
                  title: "Word (.docx) ve Tek Tıkla Aktarım",
                  desc: "Resmi şablonda tablolu döküm ve portal kutularına yapıştırma panosu.",
                },
              ].map((feat) => (
                <div
                  key={feat.code}
                  className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#FFFDF9] border border-[#DFCFC0] shadow-xs"
                >
                  <span className="text-xs font-black text-[#2563EB]">{feat.code}</span>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xs font-bold text-[#2C2016]">{feat.title}</h2>
                    <p className="text-[11px] text-[#786655] font-medium mt-0.5">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#786655] font-semibold pt-4 border-t border-[#DFCFC0]">
            <ShieldCheck size={16} className="text-[#16A34A]" />
            <span>Güvenli Yerel Depolama • JWT Kimlik Doğrulama</span>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="lg:col-span-5 p-7 sm:p-10 flex flex-col justify-center bg-[#FFFDF9]">
          <div className="mb-6">
            <h2 className="text-xl font-extrabold text-[#2C2016] tracking-tight">
              Giriş Yap
            </h2>
            <p className="text-xs text-[#786655] font-medium mt-1">
              Başvurularınızı yönetmek için bilgilerinizi girin.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-[#2C2016] mb-1.5">
                E-posta Adresi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#786655]">
                  <Mail size={15} />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ad@martateknoloji.com.tr"
                  className="w-full bg-[#EFE7DE] border-[1.5px] border-[#DFCFC0] text-[#2C2016] placeholder-[#8F7D6D] text-xs font-semibold rounded-xl pl-10 pr-3.5 py-2.5 focus:outline-none focus:border-[#2563EB] transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="sifre" className="block text-xs font-bold text-[#2C2016] mb-1.5">
                Şifre
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#786655]">
                  <Lock size={15} />
                </div>
                <input
                  id="sifre"
                  type={sifreGoster ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={sifre}
                  onChange={(e) => setSifre(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#EFE7DE] border-[1.5px] border-[#DFCFC0] text-[#2C2016] placeholder-[#8F7D6D] text-xs font-semibold rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:border-[#2563EB] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setSifreGoster((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#786655] hover:text-[#2C2016] cursor-pointer"
                >
                  {sifreGoster ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {hata && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-100 text-rose-900 border border-rose-300 text-xs font-medium">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-700" />
                <span>{hata}</span>
              </div>
            )}

            {/* 3D TACTILE BUTTON */}
            <button
              type="submit"
              disabled={yukleniyor}
              className="w-full btn-3d-primary font-bold py-3 px-5 rounded-xl text-xs shadow-md disabled:opacity-60 cursor-pointer"
            >
              {yukleniyor ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-1.5" />
                  <span>Doğrulanıyor...</span>
                </>
              ) : (
                <>
                  <span>Giriş Yap</span>
                  <ArrowRight size={15} className="ml-1.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Fill Helpers */}
          <div className="mt-6 pt-4 border-t border-[#DFCFC0]">
            <p className="text-[11px] text-[#786655] font-bold mb-2">Hızlı Test Doldurma:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Aylin", mail: "aylin@martateknoloji.com.tr" },
                { label: "Yönetici", mail: "admin@firma.com" },
              ].map((h) => (
                <button
                  key={h.mail}
                  type="button"
                  onClick={() => {
                    setEmail(h.mail);
                    setSifre(h.mail.startsWith("aylin") ? "aylin123" : "admin123");
                  }}
                  className="btn-3d-neutral text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { giris } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function GirisPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
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
      setHata("E-posta veya şifre hatalı.");
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-indigo-600 text-white p-2 rounded-xl">
              <Rocket size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Teknopark Başvuru Asistanı</h1>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {["NACE Rev.2.1 eşleştirme", "Karakter limiti kontrolü", "Portala tek tık aktarım"].map((badge) => (
              <span
                key={badge}
                className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-3 py-1 font-medium"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              E-posta
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="ad@firma.com"
            />
          </div>
          <div>
            <label htmlFor="sifre" className="block text-sm font-medium text-gray-700 mb-1">
              Şifre
            </label>
            <input
              id="sifre"
              type="password"
              autoComplete="current-password"
              required
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {hata && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {hata}
            </div>
          )}

          <button
            type="submit"
            disabled={yukleniyor}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {yukleniyor ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </div>
    </div>
  );
}

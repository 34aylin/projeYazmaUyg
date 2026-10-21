import { getToken } from "./auth";

const BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> ?? {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.clone().json(); msg = j.detail ?? j.message ?? msg; } catch { /* ignore */ }
    throw new ApiError(res.status, msg);
  }
  return res;
}

export { apiFetch };

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuthResponse { token: string; email: string; ad: string; rol: string; }

// Matches backend gecmis.listele() output exactly
export interface Project {
  dosya: string;
  tarih: string;       // "DD.MM.YYYY HH:MM"
  tarih_iso: string;
  proje_kodu: string;
  proje_adi: string;
  statu: string;
  puan: string;        // "Yüksek" | "Orta" | "Düşük"
  eksik: number;
  doluluk: number;     // 0.0 – 1.0
}

export interface SharedProject extends Project { sahip: string; }

// sonuc structure from gecmis.yukle()
export interface ProjectData {
  alanlar: Record<string, unknown>;
  kaynak_notlari?: string[];
  eksik_bilgiler?: string[];
  uyarilar?: string[];
  sorular?: string[];
  arge_uygunluk_degerlendirmesi?: { puan: string; gerekce: string };
  tahminler?: Record<string, string[]>;
}

// Backend stores messages as {role, content}
export interface Message { role: "user" | "assistant"; content: string; }

export interface Version { tarih: string; sonuc: ProjectData; }

export interface User { email: string; ad: string; rol: string; }

// ── Auth ──────────────────────────────────────────────────────────────────

export async function giris(email: string, sifre: string): Promise<AuthResponse> {
  const res = await apiFetch("/auth/giris", { method: "POST", body: JSON.stringify({ email, sifre }) });
  return res.json();
}

export async function sifreDegistir(eski: string, yeni: string): Promise<void> {
  await apiFetch("/auth/sifre-degistir", { method: "POST", body: JSON.stringify({ eski_sifre: eski, yeni_sifre: yeni }) });
}

// ── Projeler ───────────────────────────────────────────────────────────────

export async function updateProje(
  dosya: string,
  alanlar: Record<string, string>,
  mevcut: ProjectData,
  snapshot = true
): Promise<void> {
  await apiFetch(`/projeler/${dosya}`, {
    method: "PUT",
    body: JSON.stringify({
      sonuc: { ...mevcut, alanlar: { ...(mevcut.alanlar ?? {}), ...alanlar } },
      snapshot,
    }),
  });
}

export async function updateMeta(dosya: string, statu: string): Promise<void> {
  await apiFetch(`/projeler/${dosya}/meta`, {
    method: "PATCH",
    body: JSON.stringify({ statu }),
  });
}

export async function deleteProje(dosya: string): Promise<void> {
  await apiFetch(`/projeler/${dosya}`, { method: "DELETE" });
}

export async function paylas(dosya: string, kullanicilar: string[]): Promise<void> {
  await apiFetch(`/projeler/${dosya}/paylas`, {
    method: "POST",
    body: JSON.stringify({ kullanicilar }),
  });
}

// ── Kullanıcılar ───────────────────────────────────────────────────────────

export async function getKullanicilar(): Promise<User[]> {
  const res = await apiFetch("/kullanicilar");
  return res.json();
}

export async function addKullanici(data: { email: string; ad: string; sifre: string; admin: boolean }): Promise<void> {
  await apiFetch("/kullanicilar", { method: "POST", body: JSON.stringify(data) });
}

export async function deleteKullanici(email: string): Promise<void> {
  await apiFetch(`/kullanicilar/${encodeURIComponent(email)}`, { method: "DELETE" });
}

// ── SWR fetcher (key = API path like "/projeler") ──────────────────────────

export const swrFetcher = async (key: string) => {
  const res = await apiFetch(key);
  return res.json();
};

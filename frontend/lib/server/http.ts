// Route Handler'lar için ortak hata yanıtı ve kimlik doğrulama yardımcıları.

import { jwtVerify, SignJWT } from "jose";
import { unstable_rethrow } from "next/navigation";
import "./veri";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "proje-marta-jwt-secret-2024-degistir"
);
const JWT_GUN = 30;

export class HttpHata extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
  }
}

export interface Oturum {
  email: string;
  ad: string;
  rol: string;
}

type Isleyici<C> = (req: Request, ctx: C) => Promise<Response>;

/** HttpHata'yı {detail} gövdeli yanıta, beklenmeyen hataları 500'e çevirir. */
export function rota<C>(isleyici: Isleyici<C>): Isleyici<C> {
  return async (req, ctx) => {
    try {
      return await isleyici(req, ctx);
    } catch (e) {
      unstable_rethrow(e); // Next.js'in kendi kontrol akışı hataları (ör. prerender kesintisi) yakalanmaz
      if (e instanceof HttpHata) return Response.json({ detail: e.detail }, { status: e.status });
      console.error(e);
      return Response.json({ detail: e instanceof Error ? e.message : "Sunucu hatası" }, { status: 500 });
    }
  };
}

export async function tokenOlustur(o: Oturum): Promise<string> {
  return new SignJWT({ name: o.ad, role: o.rol })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(o.email)
    .setExpirationTime(`${JWT_GUN}d`)
    .sign(JWT_SECRET);
}

export async function zorunluOturum(req: Request): Promise<Oturum> {
  const baslik = req.headers.get("authorization") ?? "";
  let token = baslik.startsWith("Bearer ") ? baslik.slice(7) : "";
  if (!token) {
    const cookie = req.headers.get("cookie") ?? "";
    const m = cookie.match(/proje_asistan_v2=([^;]+)/);
    if (m) token = decodeURIComponent(m[1].trim());
  }
  if (!token) throw new HttpHata(401, "Oturum gerekli");
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (!payload.sub) throw new Error();
    return { email: payload.sub, ad: String(payload.name ?? payload.sub), rol: String(payload.role ?? "user") };
  } catch {
    throw new HttpHata(401, "Geçersiz veya süresi dolmuş oturum");
  }
}

export async function adminOturum(req: Request): Promise<Oturum> {
  const o = await zorunluOturum(req);
  if (o.rol !== "admin") throw new HttpHata(403, "Yönetici yetkisi gerekli");
  return o;
}

/** Türkçe karakterli dosya adları için Content-Disposition değeri. */
export function indirmeBasligi(isim: string): string {
  const ascii = isim.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(isim)}`;
}

/** JSON gövdeyi okur; boş veya bozuksa {} döndürür. */
export async function govde(req: Request): Promise<Record<string, unknown>> {
  try {
    const j = await req.json();
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

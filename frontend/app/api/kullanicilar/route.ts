import { adminOturum, govde, HttpHata, rota, zorunluOturum } from "@/lib/server/http";
import { kullaniciBul, kullaniciEkle, kullanicilariYukle } from "@/lib/server/oturum";

export const GET = rota(async (req) => {
  await zorunluOturum(req);
  const kullanicilar = await kullanicilariYukle();
  return Response.json(
    Object.entries(kullanicilar).map(([email, v]) => ({ email, ad: v.name || email, rol: v.role || "user" }))
  );
});

export const POST = rota(async (req) => {
  await adminOturum(req);
  const g = (await govde(req)) as { email?: string; ad?: string; sifre?: string; admin?: boolean };
  const email = (g.email ?? "").trim().toLowerCase();
  if (!email || !g.sifre) throw new HttpHata(400, "E-posta ve şifre gerekli");
  if (await kullaniciBul(email)) throw new HttpHata(400, "Bu e-posta zaten kayıtlı");
  await kullaniciEkle(email, (g.ad ?? "").trim() || email, g.sifre, Boolean(g.admin));
  return Response.json({ ok: true });
});

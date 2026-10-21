import { govde, HttpHata, rota, zorunluOturum } from "@/lib/server/http";
import { sifreDegistir, sifreDogrula } from "@/lib/server/oturum";

export const POST = rota(async (req) => {
  const { email } = await zorunluOturum(req);
  const { eski_sifre = "", yeni_sifre = "" } = (await govde(req)) as { eski_sifre?: string; yeni_sifre?: string };
  if (!yeni_sifre.trim()) throw new HttpHata(400, "Yeni şifre boş olamaz");
  if (!(await sifreDogrula(email, eski_sifre))) throw new HttpHata(400, "Mevcut şifre hatalı");
  await sifreDegistir(email, yeni_sifre);
  return Response.json({ ok: true });
});

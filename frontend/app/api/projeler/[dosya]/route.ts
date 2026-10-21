import type { Sonuc } from "@/lib/server/form";
import { guncelle, sil, yukle, type Mesaj } from "@/lib/server/gecmis";
import { govde, HttpHata, rota, zorunluOturum } from "@/lib/server/http";

type Baglam = { params: Promise<{ dosya: string }> };

export const GET = rota(async (req, { params }: Baglam) => {
  const { email } = await zorunluOturum(req);
  return Response.json(await yukle((await params).dosya, email));
});

export const PUT = rota(async (req, { params }: Baglam) => {
  const { email } = await zorunluOturum(req);
  const g = await govde(req);
  const sonuc = (g.sonuc ?? g) as Sonuc;
  if (!sonuc || typeof sonuc.alanlar !== "object") throw new HttpHata(400, "Geçersiz proje içeriği");
  await guncelle((await params).dosya, email, sonuc, {
    sohbet: Array.isArray(g.sohbet) ? (g.sohbet as Mesaj[]) : undefined,
    snapshot: Boolean(g.snapshot),
  });
  return Response.json({ ok: true });
});

export const DELETE = rota(async (req, { params }: Baglam) => {
  const { email } = await zorunluOturum(req);
  await sil((await params).dosya, email);
  return Response.json({ ok: true });
});

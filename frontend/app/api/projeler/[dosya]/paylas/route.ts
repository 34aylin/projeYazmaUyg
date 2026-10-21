import { paylas } from "@/lib/server/gecmis";
import { govde, HttpHata, rota, zorunluOturum } from "@/lib/server/http";

export const POST = rota(async (req, { params }: { params: Promise<{ dosya: string }> }) => {
  const { email } = await zorunluOturum(req);
  const { kullanicilar } = await govde(req);
  if (!Array.isArray(kullanicilar)) throw new HttpHata(400, "kullanicilar listesi gerekli");
  await paylas((await params).dosya, email, kullanicilar.map(String));
  return Response.json({ ok: true });
});

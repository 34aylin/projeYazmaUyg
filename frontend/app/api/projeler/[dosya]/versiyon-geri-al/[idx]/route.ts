import { versiyonGeriAl } from "@/lib/server/gecmis";
import { HttpHata, rota, zorunluOturum } from "@/lib/server/http";

export const POST = rota(async (req, { params }: { params: Promise<{ dosya: string; idx: string }> }) => {
  const { email } = await zorunluOturum(req);
  const { dosya, idx } = await params;
  if (!/^\d+$/.test(idx)) throw new HttpHata(400, "Geçersiz versiyon");
  await versiyonGeriAl(dosya, email, Number(idx));
  return Response.json({ ok: true });
});

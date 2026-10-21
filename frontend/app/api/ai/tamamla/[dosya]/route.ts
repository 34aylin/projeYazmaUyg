// Formdaki [EKSİK] yer tutucularını proje bağlamına göre tahminle doldurur.

import { saglayiciSec } from "@/lib/server/ai";
import { guncelle, yukle } from "@/lib/server/gecmis";
import { govde, rota, zorunluOturum } from "@/lib/server/http";
import { eksikleriTahminEt } from "@/lib/server/sohbet";

export const POST = rota(async (req, { params }: { params: Promise<{ dosya: string }> }) => {
  const { email } = await zorunluOturum(req);
  const { dosya } = await params;
  const g = await govde(req);
  const sonuc = await yukle(dosya, email);
  const { doldurulan, kalan } = await eksikleriTahminEt(saglayiciSec(g.saglayici), sonuc);
  await guncelle(dosya, email, sonuc, { snapshot: true });
  return Response.json({ type: "done", sonuc, doldurulan, kalan });
});

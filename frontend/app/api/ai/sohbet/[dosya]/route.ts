import { saglayiciSec } from "@/lib/server/ai";
import { TUM_ALANLAR } from "@/lib/server/form";
import { guncelle, sohbetYukle, yukle } from "@/lib/server/gecmis";
import { govde, rota, zorunluOturum } from "@/lib/server/http";
import { isle } from "@/lib/server/sohbet";

export const POST = rota(async (req, { params }: { params: Promise<{ dosya: string }> }) => {
  const { email } = await zorunluOturum(req);
  const { dosya } = await params;
  const g = await govde(req);
  const mesaj = String(g.mesaj ?? "");
  const sonuc = await yukle(dosya, email);
  const gecmis = await sohbetYukle(dosya, email);

  const yanit = await isle(saglayiciSec(g.saglayici), sonuc, mesaj, gecmis);
  // Model yalnızca formda var olan alanları değiştirebilir
  const guncellenen = Object.fromEntries(
    Object.entries(yanit.guncellenen_alanlar).filter(([alan]) => TUM_ALANLAR.includes(alan))
  );
  const yeniSonuc = { ...sonuc, alanlar: { ...sonuc.alanlar, ...guncellenen } };
  await guncelle(dosya, email, yeniSonuc, {
    sohbet: [...gecmis, { role: "user", content: mesaj }, { role: "assistant", content: yanit.mesaj }],
    snapshot: true,
  });
  return Response.json({
    type: "done",
    sonuc: yeniSonuc,
    yanit: yanit.mesaj,
    guncellenen_alanlar: Object.keys(guncellenen),
  });
});

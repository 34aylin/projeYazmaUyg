import { duzMetinDisaAktar } from "@/lib/server/form";
import { yukle } from "@/lib/server/gecmis";
import { indirmeBasligi, rota, zorunluOturum } from "@/lib/server/http";

export const GET = rota(async (req, { params }: { params: Promise<{ dosya: string }> }) => {
  const { email } = await zorunluOturum(req);
  const sonuc = await yukle((await params).dosya, email);
  const isim = `${sonuc.alanlar?.proje_kodu || "proje"}.txt`;
  return new Response(duzMetinDisaAktar(sonuc), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": indirmeBasligi(isim) },
  });
});

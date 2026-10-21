import { yukle } from "@/lib/server/gecmis";
import { indirmeBasligi, rota, zorunluOturum } from "@/lib/server/http";
import { wordOlustur } from "@/lib/server/word";

export const GET = rota(async (req, { params }: { params: Promise<{ dosya: string }> }) => {
  const { email } = await zorunluOturum(req);
  const sonuc = await yukle((await params).dosya, email);
  const isim = `${sonuc.alanlar?.proje_kodu || "proje"}.docx`;
  return new Response(new Uint8Array(await wordOlustur(sonuc)), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": indirmeBasligi(isim),
    },
  });
});

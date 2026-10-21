// Yeni başvuru formu doldurma — ilerleme Server-Sent Events ile akıtılır.

import { eforSec, saglayiciSec } from "@/lib/server/ai";
import { dogrulaVeDuzelt, formuDoldur } from "@/lib/server/doldurucu";
import { kaydet } from "@/lib/server/gecmis";
import { rota, zorunluOturum } from "@/lib/server/http";
import { webSitesiMetni } from "@/lib/server/kaynaklar";
import { naceListesi } from "@/lib/server/veri";

type Olay =
  | { type: "progress"; msg: string }
  | { type: "done"; sonuc: unknown; dosya: string }
  | { type: "error"; msg: string };

export const POST = rota(async (req) => {
  const { email } = await zorunluOturum(req);
  const form = await req.formData();
  const pdfDosyasi = form.get("pdf");
  const pdf = pdfDosyasi instanceof File && pdfDosyasi.size ? Buffer.from(await pdfDosyasi.arrayBuffer()) : null;
  const webUrl = String(form.get("web_url") ?? "").trim();
  const kullaniciCevaplari = String(form.get("kullanici_cevaplari") ?? "");
  const efor = eforSec(form.get("efor"));
  const saglayici = saglayiciSec(form.get("saglayici"));

  const kodlayici = new TextEncoder();
  const govde = new ReadableStream<Uint8Array>({
    async start(denetleyici) {
      let acik = true;
      const gonder = (olay: Olay) => {
        if (!acik) return;
        try {
          denetleyici.enqueue(kodlayici.encode(`data: ${JSON.stringify(olay)}\n\n`));
        } catch {
          acik = false; // istemci bağlantıyı kapattı; iş yine de tamamlanıp kaydedilir
        }
      };
      const bildir = (msg: string) => gonder({ type: "progress", msg });

      try {
        let webMetni = "";
        if (webUrl) {
          bildir(`Web sitesi okunuyor: ${webUrl}`);
          const [metin, hatalar] = await webSitesiMetni([webUrl]);
          webMetni = metin;
          bildir(
            metin
              ? `Web sitesinden ${metin.length.toLocaleString("tr-TR")} karakter alındı.`
              : `Web sitesi okunamadı: ${hatalar.join("; ") || "İçerik bulunamadı."}`
          );
        }
        if (pdf) bildir(`PDF hazır (${pdf.length.toLocaleString("tr-TR")} bayt).`);

        const nace = await naceListesi();
        const bugun = new Date();
        const baslangic = Date.now();
        let sonBildirim = 0;
        const sonuc = await formuDoldur({
          saglayici, pdf, webMetni, kullaniciCevaplari, naceListesi: nace, bugun, efor,
          ilerleme: (uretilen) => {
            const simdi = Date.now();
            if (simdi - sonBildirim < 1000) return;
            sonBildirim = simdi;
            bildir(`Oluşturuluyor… ${uretilen} karakter (${Math.round((simdi - baslangic) / 1000)}s)`);
          },
        });
        bildir("Karakter limitleri ve standart kontroller yapılıyor…");
        sonuc.uygulama_notlari = await dogrulaVeDuzelt(saglayici, sonuc, nace, bugun);
        const dosya = await kaydet(sonuc, email);
        gonder({ type: "done", sonuc, dosya });
      } catch (e) {
        gonder({ type: "error", msg: e instanceof Error ? e.message : String(e) });
      } finally {
        if (acik) denetleyici.close();
      }
    },
  });

  return new Response(govde, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" },
  });
});

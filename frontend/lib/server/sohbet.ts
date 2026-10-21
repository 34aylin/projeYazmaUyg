// Form üzerinde sohbetle düzeltme ve [EKSİK] yer tutucularının tahminle doldurulması.

import { metinIste, type Saglayici } from "./ai";
import { ALAN_ETIKETLERI, degerMetni, TUM_ALANLAR, type Sonuc } from "./form";
import type { Mesaj } from "./gecmis";
import { SOHBET_SISTEM, TAHMIN_SISTEM } from "./istem";

function formIcerigi(sonuc: Sonuc): string {
  const alanlar = sonuc.alanlar ?? {};
  const parcalar = ["--- MEVCUT FORM İÇERİĞİ ---"];
  for (const alan of TUM_ALANLAR) {
    const deger = alanlar[alan];
    if (!deger || (Array.isArray(deger) && !deger.length) || deger === "-") continue;
    parcalar.push(`\n[${ALAN_ETIKETLERI[alan] ?? alan} | alan: ${alan}]\n${degerMetni(deger)}`);
  }
  return parcalar.join("\n");
}

/** Model yanıtındaki JSON nesnesini çıkarır; bulunamazsa metni mesaj olarak döndürür. */
function coz(metin: string): Record<string, unknown> {
  metin = metin.trim();
  const blok = metin.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ?? metin.match(/(\{[\s\S]*\})/);
  try {
    const j = JSON.parse(blok ? blok[1] : metin);
    if (j && typeof j === "object" && ("mesaj" in j || "tahminler" in j)) return j;
  } catch {
    // JSON değil
  }
  return { mesaj: metin, guncellenen_alanlar: {} };
}

/** Kullanıcı isteğine göre alanları günceller. {mesaj, guncellenen_alanlar} döndürür. */
export async function isle(
  saglayici: Saglayici,
  sonuc: Sonuc,
  kullaniciMesaji: string,
  gecmis: Mesaj[]
): Promise<{ mesaj: string; guncellenen_alanlar: Record<string, unknown> }> {
  let gecmisMetni = "";
  if (gecmis.length) {
    const satirlar = ["--- ÖNCEKİ SOHBET ---"];
    for (const m of gecmis.slice(-4)) {
      satirlar.push(`${m.role === "user" ? "Kullanıcı" : "Asistan"}: ${m.content.slice(0, 400)}`);
    }
    gecmisMetni = satirlar.join("\n") + "\n\n";
  }
  const istem = `${formIcerigi(sonuc)}\n\n${gecmisMetni}Kullanıcı isteği: ${kullaniciMesaji}`;
  try {
    const yanit = coz(await metinIste(saglayici, { sistem: SOHBET_SISTEM, istem, efor: "medium", json: true }));
    const guncellenen = yanit.guncellenen_alanlar;
    return {
      mesaj: String(yanit.mesaj ?? ""),
      guncellenen_alanlar: guncellenen && typeof guncellenen === "object" ? (guncellenen as Record<string, unknown>) : {},
    };
  } catch (e) {
    return { mesaj: `Hata: ${(e as Error).message}`, guncellenen_alanlar: {} };
  }
}

// ─── Eksikleri tahmin etme ───────────────────────────────────────────────────

const YER_TUTUCU_RE = /\[EKSİK[^\]]*\]/g;
const TAHMIN_PARTI = 30;

interface YerTutucu {
  alan: string;
  bas: number;
  son: number;
  yer_tutucu: string;
  baglam: string;
}

/** Metin alanlarındaki tüm [EKSİK] yer tutucularını konum ve bağlamıyla listeler. */
function yerTutuculari(sonuc: Sonuc): YerTutucu[] {
  const liste: YerTutucu[] = [];
  for (const [alan, metin] of Object.entries(sonuc.alanlar ?? {})) {
    if (typeof metin !== "string") continue;
    for (const m of metin.matchAll(YER_TUTUCU_RE)) {
      const bas = m.index!;
      const son = bas + m[0].length;
      liste.push({
        alan, bas, son, yer_tutucu: m[0],
        baglam: `${metin.slice(Math.max(0, bas - 300), bas)}>>>${m[0]}<<<${metin.slice(son, son + 150)}`.replaceAll("\n", " "),
      });
    }
  }
  return liste;
}

function tahminIstemi(sonuc: Sonuc, parti: [number, YerTutucu][]): string {
  const alanlar = sonuc.alanlar ?? {};
  const ozet = ["proje_adi", "proje_konusu", "arge_niteligi"]
    .filter((a) => alanlar[a])
    .map((a) => `${ALAN_ETIKETLERI[a] ?? a}: ${String(alanlar[a]).slice(0, 1200)}`)
    .join("\n");
  const satirlar = [
    "--- PROJE ÖZETİ ---", ozet, "",
    "--- TAHMİN EDİLECEK YER TUTUCULAR ---",
    "Her satırda yer tutucu >>> <<< işaretleri arasında, çevresindeki metinle birlikte verilmiştir.",
  ];
  for (const [no, yt] of parti) satirlar.push(`\n${no}. [${ALAN_ETIKETLERI[yt.alan] ?? yt.alan}] ...${yt.baglam}...`);
  return satirlar.join("\n");
}

/**
 * Tüm [EKSİK] yer tutucularını tahminlerle değiştirir (sonuc yerinde güncellenir).
 * Tahmin edilen parçalar sonuc.tahminler[alan] listesine eklenir; arayüz ve dışa aktarma bunları
 * kırmızı gösterir.
 */
export async function eksikleriTahminEt(
  saglayici: Saglayici,
  sonuc: Sonuc
): Promise<{ doldurulan: number; kalan: number }> {
  const hepsi = yerTutuculari(sonuc).map((yt, i) => [i + 1, yt] as [number, YerTutucu]);
  const cevaplar = new Map<number, string>();
  // Atlanan numaralar için bir tur daha denenir
  for (let tur = 0; tur < 2; tur++) {
    const bekleyen = hepsi.filter(([no]) => !cevaplar.has(no));
    if (!bekleyen.length) break;
    for (let i = 0; i < bekleyen.length; i += TAHMIN_PARTI) {
      const parti = bekleyen.slice(i, i + TAHMIN_PARTI);
      const yanit = coz(
        await metinIste(saglayici, { sistem: TAHMIN_SISTEM, istem: tahminIstemi(sonuc, parti), efor: "medium", json: true })
      );
      const tahminler = yanit.tahminler && typeof yanit.tahminler === "object" ? yanit.tahminler : {};
      for (const [anahtar, deger] of Object.entries(tahminler)) {
        const metin = String(deger ?? "").split(/\s+/).join(" ").replace(/^[[\] ]+|[[\] ]+$/g, "");
        const no = Number(anahtar.replace(/\D/g, "") || 0);
        if (metin && parti.some(([n]) => n === no)) cevaplar.set(no, metin.startsWith("~") ? metin : `~${metin}`);
      }
    }
  }

  const alanlar = sonuc.alanlar;
  const kayit = (sonuc.tahminler ??= {});
  // Her tahminin hangi bilgi için yapıldığı ([EKSİK: ...] açıklaması) önizlemede özet olarak gösterilir
  const ozetler = (sonuc.tahmin_ozetleri ??= {});
  // Konumlar kaymasın diye her alanda sondan başa doğru değiştirilir
  const sirali = [...hepsi].sort(([, a], [, b]) => (a.alan === b.alan ? b.bas - a.bas : a.alan < b.alan ? -1 : 1));
  for (const [no, yt] of sirali) {
    const cevap = cevaplar.get(no);
    if (!cevap) continue;
    const metin = String(alanlar[yt.alan]);
    alanlar[yt.alan] = metin.slice(0, yt.bas) + cevap + metin.slice(yt.son);
    (kayit[yt.alan] ??= []).push(cevap);
    const aciklama = yt.yer_tutucu.replace(/^\[EKSİK\s*:?\s*|\]$/g, "").trim();
    if (aciklama) (ozetler[yt.alan] ??= {})[cevap] = aciklama;
  }
  return { doldurulan: cevaplar.size, kalan: hepsi.length - cevaplar.size };
}

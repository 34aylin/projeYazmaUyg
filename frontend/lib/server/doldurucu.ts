// Formun yapay zekâ ile doldurulması ve çıktının kod tarafında doğrulanması.

import { AiHatasi, formUret, metinIste, type Efor, type Saglayici } from "./ai";
import { ALAN_ETIKETLERI, ciktiSemasi, METIN_ALANLARI, type Sonuc } from "./form";
import { kisaltmaIstemi, kullaniciMesaji, SISTEM_ISTEMI } from "./istem";
import { naceKodlari } from "./kaynaklar";

const PDF_MAKS_BAYT = 32 * 1024 * 1024;

function tarihMetni(t: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getDate())}.${p(t.getMonth() + 1)}.${t.getFullYear()}`;
}

/** Tüm kaynakları tek istekte gönderir ve şemaya uygun sonucu döndürür. */
export async function formuDoldur(k: {
  saglayici: Saglayici;
  pdf: Buffer | null;
  webMetni: string;
  kullaniciCevaplari: string;
  naceListesi: string;
  bugun: Date;
  efor: Efor;
  ilerleme?: (uretilen: number) => void;
}): Promise<Sonuc> {
  if (k.pdf && k.pdf.length > PDF_MAKS_BAYT) {
    throw new AiHatasi("PDF 32 MB sınırını aşıyor. Lütfen daha küçük bir dosya yükleyin.");
  }
  const sonuc = (await formUret(k.saglayici, {
    sistem: SISTEM_ISTEMI,
    metin: kullaniciMesaji({
      pdfVar: Boolean(k.pdf),
      webMetni: k.webMetni,
      kullaniciCevaplari: k.kullaniciCevaplari,
      naceListesi: k.naceListesi,
      bugun: tarihMetni(k.bugun),
    }),
    pdf: k.pdf,
    sema: ciktiSemasi(),
    efor: k.efor,
    ilerleme: k.ilerleme,
  })) as Sonuc;
  if (!sonuc || typeof sonuc !== "object" || typeof sonuc.alanlar !== "object") {
    throw new AiHatasi("Model beklenen biçimde yanıt vermedi.");
  }
  return sonuc;
}

/** Metni alanın sınırına sığacak şekilde kısaltır; başarısız olursa metni aynen döndürür. */
export async function kisalt(saglayici: Saglayici, alan: string, metin: string, sinir: number): Promise<string> {
  const istem = kisaltmaIstemi({
    etiket: ALAN_ETIKETLERI[alan] ?? alan,
    sinir,
    uzunluk: metin.length,
    hedef: Math.floor(sinir * 0.9),
    metin,
  });
  try {
    return (await metinIste(saglayici, { sistem: "Yalnızca istenen metni yaz.", istem, efor: "low", hafif: true })) || metin;
  } catch {
    return metin;
  }
}

const TR_ASCII: Record<string, string> = {
  Ç: "C", Ğ: "G", İ: "I", I: "I", Ö: "O", Ş: "S", Ü: "U",
  ç: "C", ğ: "G", ı: "I", i: "I", ö: "O", ş: "S", ü: "U",
};

function markdownTemizle(metin: string): string {
  return metin.replaceAll("**", "").replaceAll("__", "").replace(/^\s*#{1,6}\s*/gm, "");
}

function htmlCoz(metin: string): string {
  return metin.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (tam, kod: string) => {
    const k = kod.toLowerCase();
    if (k.startsWith("#x")) return String.fromCodePoint(parseInt(k.slice(2), 16));
    if (k.startsWith("#")) return String.fromCodePoint(parseInt(k.slice(1), 10));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[k] ?? tam;
  });
}

/** "GG.AA.YYYY" biçimindeki tarihi çözer; geçersizse null. */
function tarih(deger: unknown): Date | null {
  const m = String(deger ?? "").trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 ? d : null;
}

function liste(deger: unknown): string[] {
  return Array.isArray(deger) ? deger.map(String) : [];
}

/** Modelin garanti edemediği kuralları kodda uygular. Uygulama notlarını döndürür. */
export async function dogrulaVeDuzelt(
  saglayici: Saglayici,
  sonuc: Sonuc,
  naceListesi: string,
  bugun: Date
): Promise<string[]> {
  const notlar: string[] = [];
  const alanlar = sonuc.alanlar;

  // HTML entity'leri çöz (model bazen ' → &#x27; gibi kodlar)
  for (const [alan, deger] of Object.entries(alanlar)) {
    if (typeof deger === "string") alanlar[alan] = htmlCoz(deger);
  }

  // Markdown işaretlerini temizle, karakter sınırlarını uygula
  for (const [alan, [etiket, sinir]] of Object.entries(METIN_ALANLARI)) {
    let metin = markdownTemizle(String(alanlar[alan] ?? ""));
    if (sinir && metin.length > sinir) {
      for (let i = 0; i < 2 && metin.length > sinir; i++) metin = await kisalt(saglayici, alan, metin, sinir);
      notlar.push(
        metin.length > sinir
          ? `${etiket}: ${metin.length} karakter, sınır ${sinir}. Elle kısaltılmalı.`
          : `${etiket}: sınırı aştığı için otomatik kısaltıldı.`
      );
    }
    alanlar[alan] = metin;
  }

  // Proje kodu: büyük harf, Türkçe karaktersiz, en fazla 30 karakter
  let kod = [...String(alanlar.proje_kodu ?? "")].map((c) => TR_ASCII[c] ?? c).join("").toUpperCase();
  kod = kod.replace(/[^A-Z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 30).replace(/^-+|-+$/g, "");
  alanlar.proje_kodu = kod.replace(/-{2,}/g, "-");

  // NACE kodları yalnızca verilen listeden olabilir
  const gecerli = naceKodlari(naceListesi);
  const kodlar = liste(alanlar.faaliyet_kodlari);
  if (!gecerli.size) {
    if (kodlar.length) notlar.push("NACE listesi verilmediği için faaliyet kodları doğrulanamadı.");
  } else {
    const bulunan = [];
    for (const k of kodlar) {
      const eslesme = k.match(/\d{2}(?:\.\d{1,2}){1,2}/);
      if (eslesme && gecerli.has(eslesme[0])) bulunan.push(k);
      else notlar.push(`Faaliyet kodu listede bulunmadığı için çıkarıldı: ${k}`);
    }
    alanlar.faaliyet_kodlari = bulunan.slice(0, 3);
  }

  // Tarihler
  const bas = tarih(alanlar.baslangic_tarihi);
  const bit = tarih(alanlar.tahmini_bitis_tarihi);
  for (const [alan, deger] of [["baslangic_tarihi", bas], ["tahmini_bitis_tarihi", bit]] as const) {
    if (alanlar[alan] && !deger) notlar.push(`${ALAN_ETIKETLERI[alan]} GG.AA.YYYY biçiminde değil: ${alanlar[alan]}`);
  }
  const bugunGun = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate());
  if (bas && bas < bugunGun) notlar.push("Başlangıç tarihi bugünden önce. Güncellenmeli.");
  if (bas && bit) {
    const ay = (bit.getFullYear() - bas.getFullYear()) * 12 + (bit.getMonth() - bas.getMonth());
    if (bit <= bas) notlar.push("Bitiş tarihi başlangıç tarihinden sonra olmalı.");
    else if (ay < 12 || ay > 36) notlar.push(`Proje süresi ${ay} ay; Ar-Ge projeleri tipik olarak 12-36 ay sürer.`);
  }

  // Çelişkili çoklu seçimler
  const isBirligi = liste(alanlar.is_birligi);
  if (isBirligi.includes("İş Birliği Yok") && isBirligi.length > 1) {
    alanlar.is_birligi = isBirligi.filter((x) => x !== "İş Birliği Yok");
    notlar.push("İş birliği seçiminde 'İş Birliği Yok' diğer seçeneklerle birlikte geldiği için kaldırıldı.");
  }
  const uniSan = liste(alanlar.universite_sanayi_isbirligi);
  if (uniSan.includes("Yok") && uniSan.length > 1) {
    alanlar.universite_sanayi_isbirligi = uniSan.filter((x) => x !== "Yok");
    notlar.push("Üniversite-sanayi seçiminde 'Yok' diğer seçeneklerle birlikte geldiği için kaldırıldı.");
  }
  if (!liste(alanlar.universite_sanayi_isbirligi).includes("Diğer")) {
    alanlar.universite_sanayi_diger = null;
  } else if (!alanlar.universite_sanayi_diger) {
    notlar.push("Üniversite-sanayi iş birliğinde 'Diğer' seçili ama açıklaması boş.");
  }

  sonuc.sorular = (sonuc.sorular ?? []).slice(0, 5);
  return notlar;
}

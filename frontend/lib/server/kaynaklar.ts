// Kaynak toplama: web sitesi metni ve NACE kod listesi.

import * as cheerio from "cheerio";

const KULLANICI_AJANI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) TeknoparkBasvuruAsistani/1.0";
const SAYFA_BASINA_MAKS_KARAKTER = 15_000;
const TOPLAM_MAKS_KARAKTER = 60_000;
const MAKS_ALT_SAYFA = 6;

// Ürün, teknoloji ve şirket bilgisi içermesi muhtemel alt sayfalar
const ILGILI_YOL_KELIMELERI = [
  "hakkimizda", "hakkında", "hakkinda", "about", "kurumsal", "biz-kimiz",
  "urun", "ürün", "product", "cozum", "çözüm", "solution", "hizmet", "service",
  "teknoloji", "technology", "platform", "ozellik", "özellik", "feature",
  "referans", "reference", "musteri", "customer", "sektor", "sektör", "industr",
];

function normallestir(url: string): string {
  url = url.trim();
  if (!/^https?:\/\//.test(url)) url = "https://" + url;
  return url.replace(/\/+$/, "");
}

async function sayfaGetir(url: string): Promise<cheerio.CheerioAPI | null> {
  const yanit = await fetch(url, {
    headers: { "User-Agent": KULLANICI_AJANI },
    signal: AbortSignal.timeout(20_000),
  });
  if (!yanit.ok) throw new Error(`HTTP ${yanit.status}`);
  if (!(yanit.headers.get("content-type") ?? "html").includes("html")) return null;
  return cheerio.load(await yanit.text());
}

function gorunurMetin($: cheerio.CheerioAPI): string {
  $("script, style, noscript, svg, iframe, form").remove();
  const baslik = $("title").first().text().trim();
  const aciklama = ($('meta[name="description"]').attr("content") ?? "").trim();
  // Blok öğeleri arasına satır sonu koyarak metni satırlara ayır
  $("br, p, div, li, h1, h2, h3, h4, h5, h6, tr, section, article, header, footer").after("\n");
  const govde = $("body").length ? $("body").text() : $.root().text();
  const metin = govde
    .split("\n")
    .map((s) => s.replace(/[ \t ]+/g, " ").trim())
    .filter((s) => s.length > 1)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  const onEk = [baslik && `Başlık: ${baslik}`, aciklama && `Açıklama: ${aciklama}`].filter(Boolean).join("\n");
  return (onEk + "\n" + metin).trim().slice(0, SAYFA_BASINA_MAKS_KARAKTER);
}

function ilgiliBaglantilar($: cheerio.CheerioAPI, kokUrl: string): string[] {
  const alan = new URL(kokUrl).host;
  const bulunanlar: string[] = [];
  $("a[href]").each((_, a) => {
    let p: URL;
    try {
      p = new URL($(a).attr("href")!, kokUrl + "/");
    } catch {
      return;
    }
    p.hash = "";
    const url = p.toString().replace(/\/+$/, "");
    if (p.host !== alan || !["http:", "https:"].includes(p.protocol)) return;
    if (/\.(pdf|jpg|jpeg|png|gif|zip|docx?|xlsx?)$/i.test(p.pathname)) return;
    const yol = (decodeURIComponent(p.pathname) + " " + $(a).text().trim()).toLowerCase();
    if (ILGILI_YOL_KELIMELERI.some((k) => yol.includes(k)) && !bulunanlar.includes(url)) bulunanlar.push(url);
  });
  return bulunanlar;
}

/**
 * Verilen adreslerin ve ilgili alt sayfalarının metnini toplar.
 * Dönen değer: [birleştirilmiş metin, hata/uyarı mesajları]
 */
export async function webSitesiMetni(urlListesi: string[]): Promise<[string, string[]]> {
  const hatalar: string[] = [];
  const kokler = new Set(urlListesi.filter((u) => u.trim()).map(normallestir));
  const ziyaretEdilecek = [...kokler];
  const ziyaretEdilen = new Set<string>();
  const parcalar: string[] = [];
  let toplam = 0;
  let altSayfaSayisi = 0;

  for (let sira = 0; sira < ziyaretEdilecek.length && toplam < TOPLAM_MAKS_KARAKTER; sira++) {
    const url = ziyaretEdilecek[sira];
    if (ziyaretEdilen.has(url)) continue;
    ziyaretEdilen.add(url);
    let $: cheerio.CheerioAPI | null;
    try {
      $ = await sayfaGetir(url);
    } catch (e) {
      hatalar.push(`${url} alınamadı: ${(e as Error).message}`);
      continue;
    }
    if (!$) continue;
    if (kokler.has(url)) {
      for (const baglanti of ilgiliBaglantilar($, url)) {
        if (altSayfaSayisi >= MAKS_ALT_SAYFA) break;
        if (!ziyaretEdilecek.includes(baglanti)) {
          ziyaretEdilecek.push(baglanti);
          altSayfaSayisi++;
        }
      }
    }
    const metin = gorunurMetin($).slice(0, TOPLAM_MAKS_KARAKTER - toplam);
    if (!metin) continue;
    parcalar.push(`--- Sayfa: ${url} ---\n${metin}`);
    toplam += metin.length;
  }

  if (!parcalar.length && ziyaretEdilecek.length) {
    hatalar.push(
      "Web sitesinden metin alınamadı. Site JavaScript ile yükleniyor olabilir; " +
        "tanıtım metnini elle yapıştırabilirsiniz."
    );
  }
  return [parcalar.join("\n\n"), hatalar];
}

/** NACE listesindeki kodları çıkarır (ör. 62.01, 62.01.01, 72.19). */
export function naceKodlari(naceMetni: string): Set<string> {
  return new Set(naceMetni.match(/\b\d{2}(?:\.\d{1,2}){1,2}\b/g) ?? []);
}

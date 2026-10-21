// Teknopark proje başvuru formunun alan tanımları, sınırları ve seçenek listeleri.

// Metin alanları: [etiket, kesin üst sınır veya null]
export const METIN_ALANLARI: Record<string, [string, number | null]> = {
  proje_adi: ["Proje Adı", 150],
  proje_kodu: ["Proje Kodu", 30],
  anahtar_kelimeler: ["Anahtar Kelimeler", null],
  proje_konusu: ["Proje Konusu", 10_000],
  arge_niteligi: ["Ar-Ge Niteliği", 10_000],
  proje_detayi: ["Proje Detayı", 40_000],
  hedeflenen_kazanimlar: ["Hedeflenen Kazanımlar", 20_000],
  ticarilesme_potansiyeli: ["Ticarileşme Potansiyeli", 10_000],
  yenilikci_yonu: ["Yenilikçi Yönü", 10_000],
  istihdam_ciro: ["İstihdam ve Ciro", null],
  maliyetler: ["Maliyetler", null],
  fiyat_maliyet_analizi: ["Fiyat / Maliyet Analizi", null],
  ilk_yatirim_maliyeti: ["İlk Yatırım Maliyeti", null],
  ciktilar_kullanim_alanlari: ["Çıktılar ve Kullanım Alanları", null],
  musteri_segmentleri: ["Müşteri Segmentleri", null],
  rakipler: ["Rakipler", null],
  urun_konumlandirma: ["Ürün Konumlandırma", null],
  satis_yontemleri: ["Satış Yöntemleri", null],
  ihracat_ithal_ikame: ["İhracat / İthal İkame", null],
  toplum_cevre_degeri: ["Toplum ve Çevreye Değeri", null],
};

export const ARGE_KATEGORILERI = [
  "Ar-Ge Projesine Doğrudan Bağlı Endüstriyel Tasarım ve Çizim",
  "Bir Yenilik Unsuru İçeren Yazılım Geliştirme",
  "Yeni ya da İyileştirilmiş Ürün ya da Süreçler İçin Prototip Geliştirilmesiyle Doğrudan İlişkili Sinai Mühendislik",
  "Yeni ya da İyileştirilmiş Ürün ya da Süreçler İçin Prototip Geliştirme",
];

export const HEDEF_KITLELER = [
  "Kendi Firmamız",
  "Sipariş Üzerine TGB Dışında Bulunan Kurum / Kuruluş",
  "TGB İçinde Bulunan Kurum / Kuruluş",
];

export const IS_BIRLIGI_SECENEKLERI = [
  "İş Birliği Yok",
  "Yabancı Firmalarla",
  "Bölge dışı Firmalarla",
  "Bölge içi Firmalarla",
];

export const UNIVERSITE_SANAYI_SECENEKLERI = [
  "Danışmanlık desteği alınması",
  "Yüksek lisans ya da doktora çalışması içermesi",
  "Üniversite imkanlarının kullanılıyor olması",
  "Laboratuvar hizmet alımı",
  "Kısmi zamanlı öğrenci çalıştırma",
  "Yok",
  "Diğer",
];

// Formdaki tüm alanların sırası (kaynak notları ve dışa aktarma için)
export const TUM_ALANLAR = [
  "proje_turu", "proje_adi", "proje_kodu", "faaliyet_kodlari", "anahtar_kelimeler",
  "proje_konusu", "arge_niteligi", "proje_detayi", "hedeflenen_kazanimlar",
  "ticarilesme_potansiyeli", "yenilikci_yonu", "baslangic_tarihi", "tahmini_bitis_tarihi",
  "arge_kategorisi", "hedef_kitle", "is_birligi", "arge_destek_kurumu", "kdv_muafiyeti",
  "universite_sanayi_isbirligi", "universite_sanayi_diger", "istihdam_ciro", "maliyetler",
  "fiyat_maliyet_analizi", "ilk_yatirim_maliyeti", "ciktilar_kullanim_alanlari",
  "musteri_segmentleri", "rakipler", "urun_konumlandirma", "satis_yontemleri",
  "ihracat_ithal_ikame", "toplum_cevre_degeri",
];

export const ALAN_ETIKETLERI: Record<string, string> = {
  ...Object.fromEntries(Object.entries(METIN_ALANLARI).map(([k, v]) => [k, v[0]])),
  proje_turu: "Proje Türü",
  faaliyet_kodlari: "Faaliyet Kodları (NACE)",
  baslangic_tarihi: "Başlangıç Tarihi",
  tahmini_bitis_tarihi: "Tahmini Bitiş Tarihi",
  arge_kategorisi: "Ar-Ge Kategorisi",
  hedef_kitle: "Hedef Kitle",
  is_birligi: "İş Birliği",
  arge_destek_kurumu: "Ar-Ge Destek Kurumu",
  kdv_muafiyeti: "KDV Muafiyeti",
  universite_sanayi_isbirligi: "Üniversite-Sanayi İş Birliği",
  universite_sanayi_diger: "Üniversite-Sanayi İş Birliği (Diğer)",
};

const metin = () => ({ type: "string" });
const bosOlabilirMetin = () => ({ anyOf: [{ type: "string" }, { type: "null" }] });
const secimListesi = (secenekler: string[]) => ({ type: "array", items: { type: "string", enum: secenekler } });

/** Structured outputs için JSON şeması. Seçmeli alanlar enum ile sabitlenir. */
export function ciktiSemasi(): Record<string, unknown> {
  const tanimlar: Record<string, unknown> = {
    proje_turu: { type: "string", enum: ["Arge Projesi"] },
    faaliyet_kodlari: { type: "array", items: { type: "string" } },
    baslangic_tarihi: bosOlabilirMetin(),
    tahmini_bitis_tarihi: bosOlabilirMetin(),
    arge_kategorisi: secimListesi(ARGE_KATEGORILERI),
    hedef_kitle: { type: "string", enum: HEDEF_KITLELER },
    is_birligi: secimListesi(IS_BIRLIGI_SECENEKLERI),
    arge_destek_kurumu: bosOlabilirMetin(),
    kdv_muafiyeti: { type: "string", enum: ["Evet", "Hayır"] },
    universite_sanayi_isbirligi: secimListesi(UNIVERSITE_SANAYI_SECENEKLERI),
    universite_sanayi_diger: bosOlabilirMetin(),
    ...Object.fromEntries(Object.keys(METIN_ALANLARI).map((k) => [k, metin()])),
  };
  const alanlar = Object.fromEntries(TUM_ALANLAR.map((k) => [k, tanimlar[k]]));

  return {
    type: "object",
    properties: {
      alanlar: {
        type: "object",
        properties: alanlar,
        required: TUM_ALANLAR,
        additionalProperties: false,
      },
      kaynak_notlari: {
        type: "array",
        items: {
          type: "object",
          properties: { alan: { type: "string", enum: TUM_ALANLAR }, not: metin() },
          required: ["alan", "not"],
          additionalProperties: false,
        },
      },
      eksik_bilgiler: { type: "array", items: metin() },
      uyarilar: { type: "array", items: metin() },
      sorular: { type: "array", items: metin() },
      arge_uygunluk_degerlendirmesi: {
        type: "object",
        properties: {
          puan: { type: "string", enum: ["Yüksek", "Orta", "Düşük"] },
          gerekce: metin(),
        },
        required: ["puan", "gerekce"],
        additionalProperties: false,
      },
    },
    required: [
      "alanlar", "kaynak_notlari", "eksik_bilgiler", "uyarilar", "sorular",
      "arge_uygunluk_degerlendirmesi",
    ],
    additionalProperties: false,
  };
}

export type Alanlar = Record<string, unknown>;

export interface Sonuc {
  alanlar: Alanlar;
  kaynak_notlari?: unknown[];
  eksik_bilgiler?: string[];
  uyarilar?: string[];
  sorular?: string[];
  arge_uygunluk_degerlendirmesi?: { puan: string; gerekce: string };
  tahminler?: Record<string, string[]>;
  tahmin_ozetleri?: Record<string, Record<string, string>>;
  uygulama_notlari?: string[];
  [anahtar: string]: unknown;
}

/** Liste değerlerini virgülle birleştirir, diğerlerini metne çevirir. */
export function degerMetni(deger: unknown): string {
  return Array.isArray(deger) ? deger.map(String).join(", ") : String(deger ?? "");
}

/** Forma kopyalamak için alanları okunur bir düz metne çevirir. */
export function duzMetinDisaAktar(sonuc: Sonuc): string {
  const satirlar: string[] = [];
  for (const [alan, deger] of Object.entries(sonuc.alanlar ?? {})) {
    const metin = Array.isArray(deger) ? (deger.length ? deger.join(", ") : "-") : deger ? String(deger) : "-";
    satirlar.push(`=== ${ALAN_ETIKETLERI[alan] ?? alan} ===\n${metin}\n`);
  }
  const listeler: [string, string[] | undefined][] = [
    ["EKSİK BİLGİLER", sonuc.eksik_bilgiler],
    ["UYARILAR", sonuc.uyarilar],
    ["SORULAR", sonuc.sorular],
  ];
  for (const [baslik, ogeler] of listeler) {
    if (ogeler?.length) {
      satirlar.push(`=== ${baslik} ===\n` + ogeler.map((x, i) => `${i + 1}. ${x}`).join("\n") + "\n");
    }
  }
  const deg = sonuc.arge_uygunluk_degerlendirmesi;
  if (deg) satirlar.push(`=== AR-GE UYGUNLUK DEĞERLENDİRMESİ ===\n${deg.puan}: ${deg.gerekce}\n`);
  return satirlar.join("\n");
}

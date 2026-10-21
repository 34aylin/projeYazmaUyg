export const METIN_ALANLARI: Record<
  string,
  { label: string; limit: number | null; onerilen?: [number, number] }
> = {
  proje_adi: { label: "Proje Adı", limit: 150 },
  proje_kodu: { label: "Proje Kodu", limit: 30 },
  anahtar_kelimeler: { label: "Anahtar Kelimeler", limit: null },
  proje_konusu: { label: "Proje Konusu", limit: 10000, onerilen: [800, 1500] },
  arge_niteligi: { label: "Ar-Ge Niteliği", limit: 10000, onerilen: [1500, 3000] },
  proje_detayi: { label: "Proje Detayı", limit: 40000, onerilen: [5000, 12000] },
  hedeflenen_kazanimlar: { label: "Hedeflenen Kazanımlar ve Sonuçlar", limit: 20000, onerilen: [1500, 3000] },
  ticarilesme_potansiyeli: { label: "Ticarileşme Potansiyeli", limit: 10000, onerilen: [1000, 2500] },
  yenilikci_yonu: { label: "Yenilikçi Yönü", limit: 10000, onerilen: [1000, 2500] },
  istihdam_ciro: { label: "İstihdam Potansiyeli / Ciro Beklentisi", limit: null, onerilen: [800, 2000] },
  maliyetler: { label: "Maliyetler", limit: null, onerilen: [1000, 3000] },
  fiyat_maliyet_analizi: { label: "Fiyat / Maliyet Analizi", limit: null, onerilen: [800, 2000] },
  ilk_yatirim_maliyeti: { label: "İlk Yatırım Maliyeti", limit: null, onerilen: [500, 1500] },
  ciktilar_kullanim_alanlari: { label: "Çıktılar ve Kullanım Alanları", limit: null, onerilen: [1000, 2500] },
  musteri_segmentleri: { label: "Müşteri Segmentleri ve Hedef Pazarlar", limit: null, onerilen: [1000, 2500] },
  rakipler: { label: "Rakipler ve Zayıf Yönler", limit: null, onerilen: [1000, 2500] },
  urun_konumlandirma: { label: "Ürün Konumlandırma Stratejisi", limit: null, onerilen: [800, 2000] },
  satis_yontemleri: { label: "Satış Yöntemleri", limit: null, onerilen: [600, 1500] },
  ihracat_ithal_ikame: { label: "İhracat Potansiyeli / İthal İkame Etkisi", limit: null, onerilen: [600, 1500] },
  toplum_cevre_degeri: { label: "Toplum ve Çevre Bazında Katacağı Değer", limit: null, onerilen: [600, 1500] },
};

export const STATULER = ["Taslak", "Devam Ediyor", "Başvuruldu", "Arşiv"] as const;
export type Statu = (typeof STATULER)[number];

export const STATU_RENKLER: Record<Statu, string> = {
  Taslak: "gray",
  "Devam Ediyor": "blue",
  Başvuruldu: "green",
  Arşiv: "orange",
};

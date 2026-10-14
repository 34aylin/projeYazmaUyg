"""Teknopark proje başvuru formunun alan tanımları, sınırları ve seçenek listeleri."""

# Metin alanları: (etiket, kesin üst sınır veya None, önerilen uzunluk aralığı veya None)
METIN_ALANLARI = {
    "proje_adi": ("Proje Adı", 150, None),
    "proje_kodu": ("Proje Kodu", 30, None),
    "anahtar_kelimeler": ("Anahtar Kelimeler", None, None),
    "proje_konusu": ("Proje Konusu", 10_000, (800, 1_500)),
    "arge_niteligi": ("Ar-Ge Niteliği", 10_000, (1_500, 3_000)),
    "proje_detayi": ("Proje Detayı", 40_000, (5_000, 12_000)),
    "hedeflenen_kazanimlar": ("Hedeflenen Kazanımlar", 20_000, (1_500, 3_000)),
    "ticarilesme_potansiyeli": ("Ticarileşme Potansiyeli", 10_000, (1_000, 2_500)),
    "yenilikci_yonu": ("Yenilikçi Yönü", 10_000, (1_000, 2_500)),
    "istihdam_ciro": ("İstihdam ve Ciro", None, (800, 2_000)),
    "maliyetler": ("Maliyetler", None, (1_000, 3_000)),
    "fiyat_maliyet_analizi": ("Fiyat / Maliyet Analizi", None, (800, 2_000)),
    "ilk_yatirim_maliyeti": ("İlk Yatırım Maliyeti", None, (500, 1_500)),
    "ciktilar_kullanim_alanlari": ("Çıktılar ve Kullanım Alanları", None, (1_000, 2_500)),
    "musteri_segmentleri": ("Müşteri Segmentleri", None, (1_000, 2_500)),
    "rakipler": ("Rakipler", None, (1_000, 2_500)),
    "urun_konumlandirma": ("Ürün Konumlandırma", None, (800, 2_000)),
    "satis_yontemleri": ("Satış Yöntemleri", None, (600, 1_500)),
    "ihracat_ithal_ikame": ("İhracat / İthal İkame", None, (600, 1_500)),
    "toplum_cevre_degeri": ("Toplum ve Çevreye Değeri", None, (600, 1_500)),
}

ARGE_KATEGORILERI = [
    "Ar-Ge Projesine Doğrudan Bağlı Endüstriyel Tasarım ve Çizim",
    "Bir Yenilik Unsuru İçeren Yazılım Geliştirme",
    "Yeni ya da İyileştirilmiş Ürün ya da Süreçler İçin Prototip Geliştirilmesiyle Doğrudan İlişkili Sinai Mühendislik",
    "Yeni ya da İyileştirilmiş Ürün ya da Süreçler İçin Prototip Geliştirme",
]

HEDEF_KITLELER = [
    "Kendi Firmamız",
    "Sipariş Üzerine TGB Dışında Bulunan Kurum / Kuruluş",
    "TGB İçinde Bulunan Kurum / Kuruluş",
]

IS_BIRLIGI_SECENEKLERI = [
    "İş Birliği Yok",
    "Yabancı Firmalarla",
    "Bölge dışı Firmalarla",
    "Bölge içi Firmalarla",
]

UNIVERSITE_SANAYI_SECENEKLERI = [
    "Danışmanlık desteği alınması",
    "Yüksek lisans ya da doktora çalışması içermesi",
    "Üniversite imkanlarının kullanılıyor olması",
    "Laboratuvar hizmet alımı",
    "Kısmi zamanlı öğrenci çalıştırma",
    "Yok",
    "Diğer",
]

# Formdaki tüm alanların sırası (kaynak notları ve dışa aktarma için)
TUM_ALANLAR = [
    "proje_turu", "proje_adi", "proje_kodu", "faaliyet_kodlari", "anahtar_kelimeler",
    "proje_konusu", "arge_niteligi", "proje_detayi", "hedeflenen_kazanimlar",
    "ticarilesme_potansiyeli", "yenilikci_yonu", "baslangic_tarihi", "tahmini_bitis_tarihi",
    "arge_kategorisi", "hedef_kitle", "is_birligi", "arge_destek_kurumu", "kdv_muafiyeti",
    "universite_sanayi_isbirligi", "universite_sanayi_diger", "istihdam_ciro", "maliyetler",
    "fiyat_maliyet_analizi", "ilk_yatirim_maliyeti", "ciktilar_kullanim_alanlari",
    "musteri_segmentleri", "rakipler", "urun_konumlandirma", "satis_yontemleri",
    "ihracat_ithal_ikame", "toplum_cevre_degeri",
]

ALAN_ETIKETLERI = {
    **{k: v[0] for k, v in METIN_ALANLARI.items()},
    "proje_turu": "Proje Türü",
    "faaliyet_kodlari": "Faaliyet Kodları (NACE)",
    "baslangic_tarihi": "Başlangıç Tarihi",
    "tahmini_bitis_tarihi": "Tahmini Bitiş Tarihi",
    "arge_kategorisi": "Ar-Ge Kategorisi",
    "hedef_kitle": "Hedef Kitle",
    "is_birligi": "İş Birliği",
    "arge_destek_kurumu": "Ar-Ge Destek Kurumu",
    "kdv_muafiyeti": "KDV Muafiyeti",
    "universite_sanayi_isbirligi": "Üniversite-Sanayi İş Birliği",
    "universite_sanayi_diger": "Üniversite-Sanayi İş Birliği (Diğer)",
}


def _metin():
    return {"type": "string"}


def _bos_olabilir_metin():
    return {"anyOf": [{"type": "string"}, {"type": "null"}]}


def _secim_listesi(secenekler):
    return {"type": "array", "items": {"type": "string", "enum": secenekler}}


def cikti_semasi() -> dict:
    """Structured outputs için JSON şeması. Seçmeli alanlar enum ile sabitlenir."""
    alanlar = {
        "proje_turu": {"type": "string", "enum": ["Arge Projesi"]},
        "faaliyet_kodlari": {"type": "array", "items": {"type": "string"}},
        "baslangic_tarihi": _bos_olabilir_metin(),
        "tahmini_bitis_tarihi": _bos_olabilir_metin(),
        "arge_kategorisi": _secim_listesi(ARGE_KATEGORILERI),
        "hedef_kitle": {"type": "string", "enum": HEDEF_KITLELER},
        "is_birligi": _secim_listesi(IS_BIRLIGI_SECENEKLERI),
        "arge_destek_kurumu": _bos_olabilir_metin(),
        "kdv_muafiyeti": {"type": "string", "enum": ["Evet", "Hayır"]},
        "universite_sanayi_isbirligi": _secim_listesi(UNIVERSITE_SANAYI_SECENEKLERI),
        "universite_sanayi_diger": _bos_olabilir_metin(),
        **{k: _metin() for k in METIN_ALANLARI},
    }
    alanlar = {k: alanlar[k] for k in TUM_ALANLAR}

    return {
        "type": "object",
        "properties": {
            "alanlar": {
                "type": "object",
                "properties": alanlar,
                "required": list(alanlar),
                "additionalProperties": False,
            },
            "kaynak_notlari": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "alan": {"type": "string", "enum": TUM_ALANLAR},
                        "not": _metin(),
                    },
                    "required": ["alan", "not"],
                    "additionalProperties": False,
                },
            },
            "eksik_bilgiler": {"type": "array", "items": _metin()},
            "uyarilar": {"type": "array", "items": _metin()},
            "sorular": {"type": "array", "items": _metin()},
            "arge_uygunluk_degerlendirmesi": {
                "type": "object",
                "properties": {
                    "puan": {"type": "string", "enum": ["Yüksek", "Orta", "Düşük"]},
                    "gerekce": _metin(),
                },
                "required": ["puan", "gerekce"],
                "additionalProperties": False,
            },
        },
        "required": [
            "alanlar", "kaynak_notlari", "eksik_bilgiler", "uyarilar", "sorular",
            "arge_uygunluk_degerlendirmesi",
        ],
        "additionalProperties": False,
    }

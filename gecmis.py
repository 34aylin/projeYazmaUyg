"""Geçmiş çalışmaları dosya sisteminde saklar ve okur."""

import json
import re
from datetime import datetime
from pathlib import Path

_GECMIS_KOKU = Path(__file__).parent / "data" / "gecmis"
MAX_KAYIT = 50


def _klasor(kullanici: str = "") -> Path:
    klasor = _GECMIS_KOKU / kullanici if kullanici else _GECMIS_KOKU / "_ortak"
    klasor.mkdir(parents=True, exist_ok=True)
    return klasor


def _guvenli_dosya_adi(metin: str) -> str:
    temiz = re.sub(r"[^A-Za-z0-9_-]", "_", (metin or "").strip())[:30]
    return temiz or "basvuru"


def kaydet(sonuc: dict, kullanici: str = "", klasor: str = "", statu: str = "Taslak") -> str | None:
    """Sonucu dosyaya kaydeder. Başarılıysa dosya adını döndürür."""
    GECMIS_KLASORU = _klasor(kullanici)
    proje_kodu = sonuc.get("alanlar", {}).get("proje_kodu") or "basvuru"
    proje_adi = sonuc.get("alanlar", {}).get("proje_adi") or ""
    simdi = datetime.now()
    damga = simdi.strftime("%Y%m%d_%H%M%S")
    dosya_adi = f"{damga}_{_guvenli_dosya_adi(proje_kodu)}.json"
    dosya = GECMIS_KLASORU / dosya_adi
    kayit = {
        "meta": {
            "tarih": simdi.isoformat(timespec="seconds"),
            "proje_kodu": proje_kodu,
            "proje_adi": proje_adi[:80],
            "klasor": klasor,
            "statu": statu,
        },
        "sonuc": sonuc,
    }
    try:
        dosya.write_text(json.dumps(kayit, ensure_ascii=False, indent=2), encoding="utf-8")
        _temizle_eskiler(GECMIS_KLASORU)
        return dosya_adi
    except OSError:
        return None


def listele(kullanici: str = "") -> list[dict]:
    """Kayıtlı çalışmaları yeniden eskiye sıralar."""
    klasor = _klasor(kullanici)
    sonuclar = []
    for dosya in sorted(klasor.glob("*.json"), reverse=True):
        try:
            kayit = json.loads(dosya.read_text(encoding="utf-8"))
            meta = kayit.get("meta", {})
            tarih_str = meta.get("tarih", "")
            try:
                tarih = datetime.fromisoformat(tarih_str)
                gosterim = tarih.strftime("%d.%m.%Y %H:%M")
            except ValueError:
                gosterim = tarih_str[:16]
            proje_kodu = meta.get("proje_kodu") or "?"
            proje_adi = meta.get("proje_adi") or ""
            etiket = f"{gosterim} · {proje_kodu}"
            if proje_adi:
                etiket += f" – {proje_adi[:40]}"
            sonuclar.append({
                "dosya": dosya.name,
                "tarih": gosterim,
                "proje_kodu": proje_kodu,
                "proje_adi": proje_adi,
                "etiket": etiket,
                "klasor": meta.get("klasor", ""),
                "statu": meta.get("statu", "Taslak"),
            })
        except (json.JSONDecodeError, OSError):
            continue
    return sonuclar


def yukle(dosya_adi: str, kullanici: str = "") -> dict | None:
    """Kayıttan `sonuc` sözlüğünü döndürür. Hata durumunda None."""
    dosya = _klasor(kullanici) / dosya_adi
    if not dosya.exists():
        return None
    try:
        kayit = json.loads(dosya.read_text(encoding="utf-8"))
        return kayit.get("sonuc")
    except (json.JSONDecodeError, OSError):
        return None


def sil(dosya_adi: str, kullanici: str = "") -> bool:
    """Kaydı siler. Başarılıysa True."""
    try:
        (_klasor(kullanici) / dosya_adi).unlink()
        return True
    except OSError:
        return False


def meta_guncelle(dosya_adi: str, kullanici: str = "", **updates) -> bool:
    """Kaydın meta alanlarını (klasor, statu) günceller."""
    dosya = _klasor(kullanici) / dosya_adi
    if not dosya.exists():
        return False
    try:
        kayit = json.loads(dosya.read_text(encoding="utf-8"))
        for k, v in updates.items():
            if k in ("klasor", "statu"):
                kayit["meta"][k] = v
        dosya.write_text(json.dumps(kayit, ensure_ascii=False, indent=2), encoding="utf-8")
        return True
    except (json.JSONDecodeError, OSError):
        return False


def txt_den_sonuca(icerik: str) -> dict | None:
    """Dışa aktarılmış TXT içeriğini sonuç sözlüğüne çevirir. Ayrıştırılamazsa None."""
    import re
    from form_alanlari import (
        ALAN_ETIKETLERI, TUM_ALANLAR,
        IS_BIRLIGI_SECENEKLERI, ARGE_KATEGORILERI,
        UNIVERSITE_SANAYI_SECENEKLERI,
    )

    etiket_key = {v: k for k, v in ALAN_ETIKETLERI.items()}
    parcalar = re.split(r'\n?=== (.+?) ===\n?', '\n' + icerik)

    alanlar: dict = {}
    eksik_bilgiler: list = []
    uyarilar: list = []
    sorular: list = []
    arge_deg = {"puan": "Orta", "gerekce": ""}

    for i in range(1, len(parcalar) - 1, 2):
        baslik = parcalar[i].strip()
        deger = parcalar[i + 1].strip()
        if deger == "-":
            deger = ""

        if baslik == "EKSİK BİLGİLER":
            eksik_bilgiler = _satirlari_ayir(deger)
        elif baslik == "UYARILAR":
            uyarilar = _satirlari_ayir(deger)
        elif baslik == "SORULAR":
            sorular = _satirlari_ayir(deger)
        elif baslik == "AR-GE UYGUNLUK DEĞERLENDİRMESİ":
            m = re.match(r'(Yüksek|Orta|Düşük):\s*(.*)', deger, re.DOTALL)
            if m:
                arge_deg = {"puan": m.group(1), "gerekce": m.group(2).strip()}
        else:
            key = etiket_key.get(baslik)
            if not key:
                continue
            if key == "faaliyet_kodlari":
                alanlar[key] = [x.strip() for x in deger.split(",") if x.strip()] if deger else []
            elif key == "arge_kategorisi":
                alanlar[key] = [s for s in ARGE_KATEGORILERI if s in deger]
            elif key == "is_birligi":
                alanlar[key] = [s for s in IS_BIRLIGI_SECENEKLERI if s in deger]
            elif key == "universite_sanayi_isbirligi":
                alanlar[key] = [s for s in UNIVERSITE_SANAYI_SECENEKLERI if s in deger]
            elif key in ("baslangic_tarihi", "tahmini_bitis_tarihi", "arge_destek_kurumu", "universite_sanayi_diger"):
                alanlar[key] = deger or None
            else:
                alanlar[key] = deger

    varsayilan = {
        "proje_turu": "Arge Projesi", "faaliyet_kodlari": [], "arge_kategorisi": [],
        "is_birligi": [], "universite_sanayi_isbirligi": [], "baslangic_tarihi": None,
        "tahmini_bitis_tarihi": None, "arge_destek_kurumu": None,
        "kdv_muafiyeti": "Evet", "hedef_kitle": "Kendi Firmamız", "universite_sanayi_diger": None,
    }
    for alan in TUM_ALANLAR:
        if alan not in alanlar:
            alanlar[alan] = varsayilan.get(alan, "")

    if not any(v for v in alanlar.values() if v and v != "Arge Projesi"):
        return None

    return {
        "alanlar": alanlar,
        "kaynak_notlari": [],
        "eksik_bilgiler": eksik_bilgiler,
        "uyarilar": uyarilar,
        "sorular": sorular,
        "arge_uygunluk_degerlendirmesi": arge_deg,
    }


def _satirlari_ayir(metin: str) -> list[str]:
    import re
    return [re.sub(r'^\d+\.\s*', '', s.strip()) for s in metin.splitlines() if s.strip()]


def _temizle_eskiler(klasor: Path) -> None:
    for eski in sorted(klasor.glob("*.json"), reverse=True)[MAX_KAYIT:]:
        try:
            eski.unlink()
        except OSError:
            pass

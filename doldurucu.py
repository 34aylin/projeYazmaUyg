"""Claude / Gemini API çağrısı ve çıktının kod tarafında doğrulanması."""

import base64
import json
import re
from datetime import date, datetime
from typing import Callable

import anthropic
from google import genai

import claude_cli
import gemini
from form_alanlari import ALAN_ETIKETLERI, METIN_ALANLARI, cikti_semasi
from istem import KISALTMA_ISTEMI, SISTEM_ISTEMI, kullanici_mesaji
from kaynaklar import nace_kodlari

MODEL = "claude-opus-5-5"
FALLBACK_BETA = "server-side-fallback-2026-07-01"
PDF_MAKS_BAYT = 32 * 1024 * 1024


class DoldurmaHatasi(Exception):
    pass


Istemci = anthropic.Anthropic | genai.Client | claude_cli.ClaudeCliIstemci


def formu_doldur(
    istemci: Istemci,
    pdf_baytlari: bytes | None,
    web_metni: str,
    kullanici_cevaplari: str,
    nace_listesi: str,
    bugun: date,
    ilerleme: Callable[[int], None] | None = None,
    efor: str = "high",
) -> dict:
    """Tüm kaynakları tek istekte gönderir ve şemaya uygun JSON sonucu döndürür."""
    if isinstance(istemci, claude_cli.ClaudeCliIstemci):
        if pdf_baytlari and len(pdf_baytlari) > PDF_MAKS_BAYT:
            raise DoldurmaHatasi("PDF 32 MB sınırını aşıyor. Lütfen daha küçük bir dosya yükleyin.")
        try:
            return claude_cli.doldur(
                SISTEM_ISTEMI,
                kullanici_mesaji(
                    pdf_var=bool(pdf_baytlari),
                    web_metni=web_metni,
                    kullanici_cevaplari=kullanici_cevaplari,
                    nace_listesi=nace_listesi,
                    bugun=bugun.strftime("%d.%m.%Y"),
                ),
                pdf_baytlari, cikti_semasi(), efor, ilerleme,
            )
        except claude_cli.ClaudeCliHatasi as e:
            raise DoldurmaHatasi(str(e)) from e

    if isinstance(istemci, genai.Client):
        metin = _gemini_doldur(istemci, pdf_baytlari, web_metni, kullanici_cevaplari,
                               nace_listesi, bugun, ilerleme, efor)
        try:
            return json.loads(metin)
        except json.JSONDecodeError as e:
            raise DoldurmaHatasi(f"Model çıktısı JSON olarak çözümlenemedi: {e}") from e

    if pdf_baytlari and len(pdf_baytlari) > PDF_MAKS_BAYT:
        raise DoldurmaHatasi("PDF 32 MB sınırını aşıyor. Lütfen daha küçük bir dosya yükleyin.")

    icerik: list[dict] = []
    if pdf_baytlari:
        icerik.append({
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": base64.standard_b64encode(pdf_baytlari).decode("ascii"),
            },
            "title": "Proje belgesi",
        })
    icerik.append({
        "type": "text",
        "text": kullanici_mesaji(
            pdf_var=bool(pdf_baytlari),
            web_metni=web_metni,
            kullanici_cevaplari=kullanici_cevaplari,
            nace_listesi=nace_listesi,
            bugun=bugun.strftime("%d.%m.%Y"),
        ),
    })

    uretilen = 0
    with istemci.beta.messages.stream(
        model=MODEL,
        max_tokens=64_000,
        betas=[FALLBACK_BETA],
        fallbacks="default",
        thinking={"type": "adaptive"},
        output_config={
            "effort": efor,
            "format": {"type": "json_schema", "schema": cikti_semasi()},
        },
        system=[{
            "type": "text",
            "text": SISTEM_ISTEMI,
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{"role": "user", "content": icerik}],
    ) as akis:
        for parca in akis.text_stream:
            uretilen += len(parca)
            if ilerleme:
                ilerleme(uretilen)
        yanit = akis.get_final_message()

    if yanit.stop_reason == "refusal":
        raise DoldurmaHatasi("Model isteği reddetti. Kaynak içeriğini kontrol edip tekrar deneyin.")
    if yanit.stop_reason == "max_tokens":
        raise DoldurmaHatasi(
            "Çıktı token sınırına ulaştı ve yarım kaldı. Kaynakları kısaltıp tekrar deneyin."
        )

    # Yedek modele geçildiyse yalnızca geçişten sonraki metni kullan
    metin = ""
    for blok in yanit.content:
        if blok.type == "fallback":
            metin = ""
        elif blok.type == "text":
            metin += blok.text

    try:
        return json.loads(metin)
    except json.JSONDecodeError as e:
        raise DoldurmaHatasi(f"Model çıktısı JSON olarak çözümlenemedi: {e}") from e


def _gemini_doldur(istemci, pdf_baytlari, web_metni, kullanici_cevaplari,
                   nace_listesi, bugun, ilerleme, efor) -> str:
    try:
        return gemini.doldur(
            istemci,
            sistem_istemi=SISTEM_ISTEMI,
            kullanici_metni=kullanici_mesaji(
                pdf_var=bool(pdf_baytlari),
                web_metni=web_metni,
                kullanici_cevaplari=kullanici_cevaplari,
                nace_listesi=nace_listesi,
                bugun=bugun.strftime("%d.%m.%Y"),
            ),
            pdf_baytlari=pdf_baytlari,
            sema=cikti_semasi(),
            efor=efor,
            ilerleme=ilerleme,
        )
    except gemini.GeminiHatasi as e:
        raise DoldurmaHatasi(str(e)) from e


def _kisalt(istemci: Istemci, alan: str, metin: str, sinir: int) -> str:
    hedef = int(sinir * 0.9)
    istem = KISALTMA_ISTEMI.format(
        etiket=ALAN_ETIKETLERI[alan], sinir=sinir, uzunluk=len(metin),
        hedef=hedef, metin=metin,
    )
    if isinstance(istemci, genai.Client):
        return gemini.kisalt(istemci, istem) or metin
    if isinstance(istemci, claude_cli.ClaudeCliIstemci):
        try:
            return claude_cli.kisalt(istem) or metin
        except claude_cli.ClaudeCliHatasi:
            return metin
    yanit = istemci.messages.create(
        model=MODEL,
        max_tokens=32_000,
        output_config={"effort": "low"},
        messages=[{"role": "user", "content": istem}],
    )
    if yanit.stop_reason in ("refusal", "max_tokens"):
        return metin
    return "".join(b.text for b in yanit.content if b.type == "text").strip() or metin


_TR_ASCII = str.maketrans("ÇĞİIÖŞÜçğıiöşü", "CGIIOSUCGIIOSU")


def _markdown_temizle(metin: str) -> str:
    metin = metin.replace("**", "").replace("__", "")
    metin = re.sub(r"^\s*#{1,6}\s*", "", metin, flags=re.M)
    return metin


def _tarih(deger: str | None) -> date | None:
    if not deger:
        return None
    try:
        return datetime.strptime(deger.strip(), "%d.%m.%Y").date()
    except ValueError:
        return None


def dogrula_ve_duzelt(
    istemci: Istemci, sonuc: dict, nace_listesi: str, bugun: date,
) -> list[str]:
    """Modelin garanti edemediği kuralları kodda uygular. Uygulama notlarını döndürür."""
    import html as _html_mod
    notlar: list[str] = []
    alanlar = sonuc["alanlar"]

    # HTML entity'leri çöz (AI bazen ' → &#x27; gibi encode eder)
    for alan in list(alanlar):
        if isinstance(alanlar[alan], str):
            alanlar[alan] = _html_mod.unescape(alanlar[alan])

    # Markdown işaretlerini temizle, karakter sınırlarını uygula
    for alan, (etiket, sinir, _) in METIN_ALANLARI.items():
        metin = _markdown_temizle(alanlar.get(alan) or "")
        if sinir and len(metin) > sinir:
            for _ in range(2):
                metin = _kisalt(istemci, alan, metin, sinir)
                if len(metin) <= sinir:
                    break
            if len(metin) > sinir:
                notlar.append(f"{etiket}: {len(metin)} karakter, sınır {sinir}. Elle kısaltılmalı.")
            else:
                notlar.append(f"{etiket}: sınırı aştığı için otomatik kısaltıldı.")
        alanlar[alan] = metin

    # Proje kodu: büyük harf, Türkçe karaktersiz, en fazla 30 karakter
    kod = (alanlar.get("proje_kodu") or "").translate(_TR_ASCII).upper()
    kod = re.sub(r"[^A-Z0-9-]", "-", kod).strip("-")[:30].strip("-")
    alanlar["proje_kodu"] = re.sub(r"-{2,}", "-", kod)

    # NACE kodları yalnızca verilen listeden olabilir
    gecerli = nace_kodlari(nace_listesi)
    kodlar = alanlar.get("faaliyet_kodlari") or []
    if not gecerli:
        if kodlar:
            notlar.append("NACE listesi verilmediği için faaliyet kodları doğrulanamadı.")
    else:
        bulunan = []
        for k in kodlar:
            eslesme = re.search(r"\d{2}(?:\.\d{1,2}){1,2}", k)
            if eslesme and eslesme.group(0) in gecerli:
                bulunan.append(k)
            else:
                notlar.append(f"Faaliyet kodu listede bulunmadığı için çıkarıldı: {k}")
        alanlar["faaliyet_kodlari"] = bulunan[:3]

    # Tarihler
    bas = _tarih(alanlar.get("baslangic_tarihi"))
    bit = _tarih(alanlar.get("tahmini_bitis_tarihi"))
    for alan, deger in (("baslangic_tarihi", bas), ("tahmini_bitis_tarihi", bit)):
        if alanlar.get(alan) and deger is None:
            notlar.append(f"{ALAN_ETIKETLERI[alan]} GG.AA.YYYY biçiminde değil: {alanlar[alan]}")
    if bas and bas < bugun:
        notlar.append("Başlangıç tarihi bugünden önce. Güncellenmeli.")
    if bas and bit:
        ay = (bit.year - bas.year) * 12 + (bit.month - bas.month)
        if bit <= bas:
            notlar.append("Bitiş tarihi başlangıç tarihinden sonra olmalı.")
        elif not 12 <= ay <= 36:
            notlar.append(f"Proje süresi {ay} ay; Ar-Ge projeleri tipik olarak 12-36 ay sürer.")

    # Çelişkili çoklu seçimler
    if "İş Birliği Yok" in alanlar["is_birligi"] and len(alanlar["is_birligi"]) > 1:
        alanlar["is_birligi"] = [x for x in alanlar["is_birligi"] if x != "İş Birliği Yok"]
        notlar.append("İş birliği seçiminde 'İş Birliği Yok' diğer seçeneklerle birlikte geldiği için kaldırıldı.")
    if "Yok" in alanlar["universite_sanayi_isbirligi"] and len(alanlar["universite_sanayi_isbirligi"]) > 1:
        alanlar["universite_sanayi_isbirligi"] = [x for x in alanlar["universite_sanayi_isbirligi"] if x != "Yok"]
        notlar.append("Üniversite-sanayi seçiminde 'Yok' diğer seçeneklerle birlikte geldiği için kaldırıldı.")
    if "Diğer" not in alanlar["universite_sanayi_isbirligi"]:
        alanlar["universite_sanayi_diger"] = None
    elif not alanlar.get("universite_sanayi_diger"):
        notlar.append("Üniversite-sanayi iş birliğinde 'Diğer' seçili ama açıklaması boş.")

    sonuc["sorular"] = sonuc.get("sorular", [])[:5]
    return notlar


def duz_metin_disa_aktar(sonuc: dict) -> str:
    """Forma kopyalamak için alanları okunur bir düz metne çevirir."""
    satirlar = []
    for alan, deger in sonuc["alanlar"].items():
        if isinstance(deger, list):
            deger = ", ".join(deger) if deger else "-"
        satirlar.append(f"=== {ALAN_ETIKETLERI.get(alan, alan)} ===\n{deger if deger else '-'}\n")
    for baslik, anahtar in (("EKSİK BİLGİLER", "eksik_bilgiler"), ("UYARILAR", "uyarilar"),
                            ("SORULAR", "sorular")):
        ogeler = sonuc.get(anahtar) or []
        if ogeler:
            satirlar.append(f"=== {baslik} ===\n" + "\n".join(f"{i}. {x}" for i, x in enumerate(ogeler, 1)) + "\n")
    deg = sonuc.get("arge_uygunluk_degerlendirmesi") or {}
    if deg:
        satirlar.append(f"=== AR-GE UYGUNLUK DEĞERLENDİRMESİ ===\n{deg.get('puan')}: {deg.get('gerekce')}\n")
    return "\n".join(satirlar)

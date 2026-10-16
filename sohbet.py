"""Form üzerinde sohbet tabanlı düzeltme: kullanıcı isteğini alır, ilgili alanları günceller."""

import json
import re

import anthropic
from google import genai
from google.genai import types

import claude_cli
import gemini as gemini_mod
from doldurucu import MODEL as CLAUDE_MODEL
from form_alanlari import ALAN_ETIKETLERI, TUM_ALANLAR

SISTEM = (
    "Sen bir Teknopark Ar-Ge proje başvuru formu düzenleme asistanısın. Türkçe yanıt ver.\n"
    "Kullanıcı mevcut form içeriğini görecek ve belirli alanları düzeltmeni ya da geliştirmeni isteyecek.\n"
    "Yalnızca istenen değişiklikleri yap; diğer alanlara dokunma.\n"
    "Yanıtını kesinlikle şu JSON biçiminde ver (başka hiçbir şey yazma):\n"
    '{"mesaj": "ne değiştirdiğini kısaca açıkla", "guncellenen_alanlar": {"python_alan_adi": "yeni içerik"}}\n\n'
    "Güncelleyebileceğin alan anahtarları (yalnızca bunları kullan):\n"
    "proje_adi, proje_kodu, anahtar_kelimeler, proje_konusu, arge_niteligi, proje_detayi,\n"
    "hedeflenen_kazanimlar, ticarilesme_potansiyeli, yenilikci_yonu, istihdam_ciro, maliyetler,\n"
    "fiyat_maliyet_analizi, ilk_yatirim_maliyeti, ciktilar_kullanim_alanlari, musteri_segmentleri,\n"
    "rakipler, urun_konumlandirma, satis_yontemleri, ihracat_ithal_ikame, toplum_cevre_degeri,\n"
    "baslangic_tarihi, tahmini_bitis_tarihi\n\n"
    "Metin alanlarında Markdown işaretleri (**bold**, ## başlık vb.) kullanma. Düz metin yaz."
)


def _form_icerigi(sonuc: dict) -> str:
    alanlar = sonuc.get("alanlar", {})
    parcalar = ["--- MEVCUT FORM İÇERİĞİ ---"]
    for alan in TUM_ALANLAR:
        deger = alanlar.get(alan)
        if not deger or deger == [] or deger == "-":
            continue
        etiket = ALAN_ETIKETLERI.get(alan, alan)
        deger_str = ", ".join(str(d) for d in deger) if isinstance(deger, list) else str(deger)
        if len(deger_str) > 3000:
            deger_str = deger_str[:3000] + f"\n[...toplam {len(deger_str):,} karakter, kısaltıldı]"
        parcalar.append(f"\n[{etiket} | alan: {alan}]\n{deger_str}")
    return "\n".join(parcalar)


def _parse(metin: str) -> dict:
    metin = metin.strip()
    m = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', metin, re.DOTALL)
    if m:
        metin = m.group(1)
    else:
        m = re.search(r'\{.*\}', metin, re.DOTALL)
        if m:
            metin = m.group(0)
    try:
        sonuc = json.loads(metin)
        if isinstance(sonuc, dict) and "mesaj" in sonuc:
            return sonuc
    except json.JSONDecodeError:
        pass
    return {"mesaj": metin, "guncellenen_alanlar": {}}


def isle(
    istemci,
    sonuc: dict,
    kullanici_mesaji: str,
    gecmis_listesi: list[dict],
) -> dict:
    """{'mesaj': str, 'guncellenen_alanlar': dict} döndürür."""
    form = _form_icerigi(sonuc)
    gecmis_metni = ""
    if gecmis_listesi:
        satirlar = ["--- ÖNCEKİ SOHBET ---"]
        for m in gecmis_listesi[-4:]:
            rol = "Kullanıcı" if m["role"] == "user" else "Asistan"
            satirlar.append(f"{rol}: {m['content'][:400]}")
        gecmis_metni = "\n".join(satirlar) + "\n\n"
    istem = f"{form}\n\n{gecmis_metni}Kullanıcı isteği: {kullanici_mesaji}"
    try:
        if isinstance(istemci, claude_cli.ClaudeCliIstemci):
            return _isle_cli(istem)
        elif isinstance(istemci, genai.Client):
            return _isle_gemini(istemci, istem)
        else:
            return _isle_api(istemci, istem)
    except Exception as e:
        return {"mesaj": f"Hata: {e}", "guncellenen_alanlar": {}}


def _isle_api(istemci: anthropic.Anthropic, istem: str) -> dict:
    yanit = istemci.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=16_000,
        system=SISTEM,
        messages=[{"role": "user", "content": istem}],
    )
    metin = "".join(b.text for b in yanit.content if b.type == "text")
    return _parse(metin)


def _isle_cli(istem: str) -> dict:
    sonuc = claude_cli._calistir(
        [{"type": "text", "text": istem}],
        SISTEM,
        "medium",
    )
    return _parse((sonuc.get("result") or "").strip())


def _isle_gemini(istemci: genai.Client, istem: str) -> dict:
    yanit = istemci.models.generate_content(
        model=gemini_mod.MODEL,
        contents=istem,
        config=types.GenerateContentConfig(
            system_instruction=SISTEM,
            max_output_tokens=16_000,
            response_mime_type="application/json",
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )
    return _parse((yanit.text or "").strip())

"""Google Gemini API çağrıları (ücretsiz katman ile kullanılabilir)."""

import os
from typing import Callable

from google import genai
from google.genai import errors, types

# Ücretsiz katmanda Flash modelleri kullanılabilir; .env'de GEMINI_MODEL ile değiştirilebilir
MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
YEDEK_MODEL = "gemini-flash-lite-latest"  # ana model yoğunsa (503) kullanılır
PDF_MAKS_BAYT = 20 * 1024 * 1024  # satır içi gönderim sınırı

_DUSUNME_BUTCESI = {"medium": 4_096, "high": -1, "xhigh": 24_576}  # -1 = model karar verir


class GeminiHatasi(Exception):
    pass


def doldur(
    istemci: genai.Client,
    sistem_istemi: str,
    kullanici_metni: str,
    pdf_baytlari: bytes | None,
    sema: dict,
    efor: str,
    ilerleme: Callable[[int], None] | None,
) -> str:
    """Formu tek akışlı istekle üretir, JSON metnini döndürür."""
    if pdf_baytlari and len(pdf_baytlari) > PDF_MAKS_BAYT:
        raise GeminiHatasi("Gemini için PDF 20 MB sınırını aşıyor. Lütfen daha küçük bir dosya yükleyin.")

    icerik: list = []
    if pdf_baytlari:
        icerik.append(types.Part.from_bytes(data=pdf_baytlari, mime_type="application/pdf"))
    icerik.append(kullanici_metni)

    for model in (MODEL, YEDEK_MODEL):
        try:
            return _akis(istemci, model, sistem_istemi, icerik, sema, efor, ilerleme)
        except errors.ServerError as e:
            if model == YEDEK_MODEL or e.code not in (500, 503):
                raise


def _akis(istemci, model, sistem_istemi, icerik, sema, efor, ilerleme) -> str:
    metin, uretilen, bitis = "", 0, None
    for parca in istemci.models.generate_content_stream(
        model=model,
        contents=icerik,
        config=types.GenerateContentConfig(
            system_instruction=sistem_istemi,
            max_output_tokens=65_536,
            response_mime_type="application/json",
            response_json_schema=sema,
            thinking_config=types.ThinkingConfig(thinking_budget=_DUSUNME_BUTCESI.get(efor, -1)),
        ),
    ):
        if parca.prompt_feedback and parca.prompt_feedback.block_reason:
            raise GeminiHatasi("Model isteği engelledi. Kaynak içeriğini kontrol edip tekrar deneyin.")
        if parca.text:
            metin += parca.text
            uretilen += len(parca.text)
            if ilerleme:
                ilerleme(uretilen)
        if parca.candidates and parca.candidates[0].finish_reason:
            bitis = parca.candidates[0].finish_reason

    if bitis == types.FinishReason.MAX_TOKENS:
        raise GeminiHatasi("Çıktı token sınırına ulaştı ve yarım kaldı. Kaynakları kısaltıp tekrar deneyin.")
    if bitis not in (None, types.FinishReason.STOP):
        raise GeminiHatasi(f"Model yanıtı tamamlayamadı ({bitis.name}). Tekrar deneyin.")
    return metin


def kisalt(istemci: genai.Client, istem: str) -> str | None:
    yanit = istemci.models.generate_content(
        model=YEDEK_MODEL,
        contents=istem,
        config=types.GenerateContentConfig(
            max_output_tokens=32_000,
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )
    return (yanit.text or "").strip() or None

"""Claude Code CLI (`claude -p`) üzerinden çağrı: API anahtarı yerine Claude aboneliği kullanılır.

Her istekte ayrı bir `claude` süreci başlatılır; mesaj stdin'den stream-json olarak verilir,
yanıt stdout'tan satır satır JSON olarak okunur. Süreç cevap bitince kapanır.
"""

import base64
import json
import os
import shutil
import subprocess
import tempfile
from typing import Callable

MODEL = os.getenv("CLAUDE_CLI_MODEL", "opus")
ZAMAN_ASIMI_SN = 20 * 60


class ClaudeCliHatasi(Exception):
    pass


class ClaudeCliIstemci:
    """doldurucu.py'de sağlayıcıyı ayırt etmek için kullanılan işaretçi."""


def kurulu_mu() -> bool:
    return shutil.which("claude") is not None


def oturum_durumu() -> dict:
    """`claude auth status` çıktısı (loggedIn, email, orgName...). Okunamazsa boş sözlük."""
    if not kurulu_mu():
        return {}
    ortam = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
    try:
        cikti = subprocess.run(["claude", "auth", "status", "--json"], env=ortam,
                               capture_output=True, text=True, timeout=30)
        return json.loads(cikti.stdout)
    except (subprocess.SubprocessError, json.JSONDecodeError, OSError):
        return {}


def _calistir(
    icerik: list[dict],
    sistem_istemi: str,
    efor: str,
    sema: dict | None = None,
    ilerleme: Callable[[int], None] | None = None,
) -> dict:
    """Tek bir `claude -p` süreci çalıştırır ve son 'result' satırını döndürür."""
    if not kurulu_mu():
        raise ClaudeCliHatasi(
            "'claude' komutu bulunamadı. Claude Code'u kurup 'claude' ile bir kez giriş yapın."
        )
    komut = [
        "claude", "-p",
        "--input-format", "stream-json",
        "--output-format", "stream-json",
        "--verbose",
        "--include-partial-messages",
        "--model", MODEL,
        "--effort", efor,
        "--system-prompt", sistem_istemi,
        "--tools", "",  # dosya, kabuk vb. araçlar kapalı
        "--strict-mcp-config",
        "--no-session-persistence",
    ]
    if sema:
        komut += ["--json-schema", json.dumps(sema, ensure_ascii=False)]

    # ANTHROPIC_API_KEY varsa CLI onu kullanır (ücretli); abonelikle çalışması için çıkarılır
    ortam = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
    mesaj = json.dumps({"type": "user", "message": {"role": "user", "content": icerik}}, ensure_ascii=False)

    # Proje klasöründeki CLAUDE.md vb. yüklenmesin diye boş bir klasörde çalıştırılır
    with tempfile.TemporaryDirectory() as klasor, tempfile.TemporaryFile("w+", encoding="utf-8") as hata_kaydi:
        surec = subprocess.Popen(
            komut, cwd=klasor, env=ortam, text=True, encoding="utf-8",
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=hata_kaydi,
        )
        sonuc, uretilen = None, 0
        try:
            surec.stdin.write(mesaj + "\n")
            surec.stdin.close()
            for satir in surec.stdout:
                try:
                    olay = json.loads(satir)
                except json.JSONDecodeError:
                    continue
                if olay.get("type") == "stream_event":
                    delta = olay["event"].get("delta") or {}
                    parca = delta.get("text") or delta.get("partial_json") or ""
                    if parca and delta.get("type") in ("text_delta", "input_json_delta"):
                        uretilen += len(parca)
                        if ilerleme:
                            ilerleme(uretilen)
                elif olay.get("type") == "result":
                    sonuc = olay
            surec.wait(timeout=ZAMAN_ASIMI_SN)
        finally:
            if surec.poll() is None:
                surec.kill()

        if sonuc is None:
            hata_kaydi.seek(0)
            hata = hata_kaydi.read().strip()[-500:]
            raise ClaudeCliHatasi(f"Claude Code yanıt vermedi (çıkış kodu {surec.returncode}). {hata}")
    if sonuc.get("is_error") or sonuc.get("subtype") != "success":
        ayrinti = sonuc.get("result") or "; ".join(sonuc.get("errors") or []) or sonuc.get("subtype")
        if "login" in str(ayrinti).lower() or "auth" in str(ayrinti).lower():
            raise ClaudeCliHatasi("Claude Code oturumu açık değil. Terminalde 'claude' yazıp giriş yapın.")
        raise ClaudeCliHatasi(f"Claude Code hatası: {ayrinti}")
    return sonuc


def doldur(
    sistem_istemi: str,
    kullanici_metni: str,
    pdf_baytlari: bytes | None,
    sema: dict,
    efor: str,
    ilerleme: Callable[[int], None] | None,
) -> dict:
    """Formu tek istekte üretir, şemaya uygun sonucu sözlük olarak döndürür."""
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
    icerik.append({"type": "text", "text": kullanici_metni})

    sonuc = _calistir(icerik, sistem_istemi, efor, sema=sema, ilerleme=ilerleme)
    if isinstance(sonuc.get("structured_output"), dict):
        return sonuc["structured_output"]
    try:
        return json.loads(sonuc.get("result") or "")
    except json.JSONDecodeError as e:
        raise ClaudeCliHatasi(f"Model çıktısı JSON olarak çözümlenemedi: {e}") from e


def kisalt(istem: str) -> str | None:
    sonuc = _calistir([{"type": "text", "text": istem}], "Yalnızca istenen metni yaz.", "low")
    return (sonuc.get("result") or "").strip() or None

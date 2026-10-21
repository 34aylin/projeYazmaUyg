"""FastAPI backend — proje-marta-tr v2."""

import asyncio
import json
import os
import sys
import threading
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import bcrypt
from fastapi import Depends, FastAPI, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

# Mevcut proje kütüphaneleri PATH'e ekle
SRC = Path(__file__).parent.parent.parent / "proje-marta-tr"
sys.path.insert(0, str(SRC))

import gecmis
import oturum
from form_alanlari import TUM_ALANLAR

# ─── Ortam ───────────────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv(SRC / ".env")
load_dotenv(Path(__file__).parent / ".env")

JWT_SECRET = os.environ.get("JWT_SECRET", "proje-marta-jwt-secret-2024-degistir")
JWT_ALGO = "HS256"
JWT_EXP_DAYS = 30

app = FastAPI(title="Proje Asistan API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:30205", "http://127.0.0.1:30205", "https://proje.marta.tr"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer = HTTPBearer(auto_error=False)


# ─── Auth yardımcıları ────────────────────────────────────────────────────────
def _token_olustur(email: str, ad: str, rol: str) -> str:
    exp = datetime.utcnow() + timedelta(days=JWT_EXP_DAYS)
    return jwt.encode({"sub": email, "name": ad, "role": rol, "exp": exp}, JWT_SECRET, JWT_ALGO)


def _token_coz(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except JWTError:
        raise HTTPException(status_code=401, detail="Geçersiz veya süresi dolmuş oturum")


def zorunlu_oturum(cred: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if not cred:
        raise HTTPException(status_code=401, detail="Oturum gerekli")
    return _token_coz(cred.credentials)


def admin_oturum(kullanici: dict = Depends(zorunlu_oturum)) -> dict:
    if kullanici.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Yönetici yetkisi gerekli")
    return kullanici


# ─── Modeller ────────────────────────────────────────────────────────────────
class GirisIstegi(BaseModel):
    email: str
    sifre: str


class SifreDegistirIstegi(BaseModel):
    eski_sifre: str
    yeni_sifre: str


class KullaniciEkleIstegi(BaseModel):
    email: str
    ad: str
    sifre: str
    admin: bool = False


class MetaGuncelleIstegi(BaseModel):
    statu: str | None = None


class PaylasSavIstegi(BaseModel):
    kullanicilar: list[str]


class SohbetMesaji(BaseModel):
    rol: str
    icerik: str


class KisaltIstegi(BaseModel):
    metin: str
    alan: str
    limit: int


# ─── Kimlik doğrulama ─────────────────────────────────────────────────────────
@app.post("/api/auth/giris")
def giris(req: GirisIstegi):
    email = req.email.strip().lower()
    if not oturum.sifre_dogrula(email, req.sifre.strip()):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı")
    kullanicilar = oturum.kullanicilari_yukle()
    bilgi = kullanicilar.get(email, {})
    ad = bilgi.get("name") or email
    rol = bilgi.get("role") or "user"
    token = _token_olustur(email, ad, rol)
    return {"token": token, "email": email, "ad": ad, "rol": rol}


@app.get("/api/auth/ben")
def ben(kullanici: dict = Depends(zorunlu_oturum)):
    return {"email": kullanici["sub"], "ad": kullanici.get("name"), "rol": kullanici.get("role")}


@app.post("/api/auth/sifre-degistir")
def sifre_degistir(req: SifreDegistirIstegi, kullanici: dict = Depends(zorunlu_oturum)):
    email = kullanici["sub"]
    if not oturum.sifre_dogrula(email, req.eski_sifre):
        raise HTTPException(status_code=400, detail="Mevcut şifre hatalı")
    oturum.sifre_degistir(email, req.yeni_sifre)
    return {"ok": True}


# ─── Kullanıcılar (admin) ─────────────────────────────────────────────────────
@app.get("/api/kullanicilar")
def kullanicilari_listele(_k: dict = Depends(zorunlu_oturum)):
    kullanicilar = oturum.kullanicilari_yukle()
    return [
        {"email": e, "ad": v.get("name", e), "rol": v.get("role", "user")}
        for e, v in kullanicilar.items()
    ]


@app.post("/api/kullanicilar")
def kullanici_ekle(req: KullaniciEkleIstegi, _k: dict = Depends(admin_oturum)):
    mevcut = oturum.kullanicilari_yukle()
    if req.email in mevcut:
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kayıtlı")
    oturum.kullanici_ekle(req.email, req.ad, req.sifre, req.admin)
    return {"ok": True}


@app.delete("/api/kullanicilar/{email}")
def kullanici_sil(email: str, kullanici: dict = Depends(admin_oturum)):
    if email == kullanici["sub"]:
        raise HTTPException(status_code=400, detail="Kendi hesabınızı silemezsiniz")
    oturum.kullanici_sil(email)
    return {"ok": True}


def _bookmarklet_guncelle(sonuc: dict, email: str) -> None:
    try:
        import portal
        portal.js_dosyasina_kaydet(sonuc, email)
    except Exception:
        pass


# ─── Projeler ─────────────────────────────────────────────────────────────────
@app.get("/api/projeler")
def projeleri_listele(kullanici: dict = Depends(zorunlu_oturum)):
    return gecmis.listele(kullanici=kullanici["sub"])


@app.get("/api/projeler/paylasilanlar")
def paylasilan_projeleri_listele(kullanici: dict = Depends(zorunlu_oturum)):
    return gecmis.paylasilan_listele(kullanici["sub"])


@app.get("/api/projeler/{dosya_adi}")
def proje_yukle(dosya_adi: str, kullanici: dict = Depends(zorunlu_oturum)):
    sonuc = gecmis.yukle(dosya_adi, kullanici=kullanici["sub"])
    if not sonuc:
        # Paylaşılan projeyi dene
        paylasilan = gecmis.paylasilan_listele(kullanici["sub"])
        for p in paylasilan:
            if p["dosya"] == dosya_adi:
                sonuc = gecmis.yukle(dosya_adi, kullanici=p["sahip"])
                break
    if not sonuc:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")
    _bookmarklet_guncelle(sonuc, kullanici["sub"])
    return sonuc


@app.get("/api/projeler/{dosya_adi}/sohbet")
def sohbet_yukle(dosya_adi: str, kullanici: dict = Depends(zorunlu_oturum)):
    return {"sohbet": gecmis.sohbet_yukle(dosya_adi, kullanici=kullanici["sub"])}


@app.get("/api/projeler/{dosya_adi}/versiyonlar")
def versiyonlar_yukle(dosya_adi: str, kullanici: dict = Depends(zorunlu_oturum)):
    return {"versiyonlar": gecmis.versiyonlar_yukle(dosya_adi, kullanici=kullanici["sub"])}


@app.post("/api/projeler/{dosya_adi}/versiyon-geri-al/{idx}")
def versiyon_geri_al(dosya_adi: str, idx: int, kullanici: dict = Depends(zorunlu_oturum)):
    eski = gecmis.versiyon_geri_al(dosya_adi, kullanici["sub"], idx)
    if not eski:
        raise HTTPException(status_code=404, detail="Versiyon bulunamadı")
    gecmis.guncelle(dosya_adi, eski, kullanici=kullanici["sub"], snapshot=True)
    return {"ok": True}


@app.put("/api/projeler/{dosya_adi}")
async def proje_guncelle(dosya_adi: str, body: dict, kullanici: dict = Depends(zorunlu_oturum)):
    sonuc = body.get("sonuc", body)
    sohbet = body.get("sohbet")
    snapshot = body.get("snapshot", False)
    ok = gecmis.guncelle(dosya_adi, sonuc, kullanici=kullanici["sub"], sohbet=sohbet, snapshot=snapshot)
    if not ok:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")
    _bookmarklet_guncelle(sonuc, kullanici["sub"])
    return {"ok": True}


@app.patch("/api/projeler/{dosya_adi}/meta")
def meta_guncelle(dosya_adi: str, req: MetaGuncelleIstegi, kullanici: dict = Depends(zorunlu_oturum)):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    ok = gecmis.meta_guncelle(dosya_adi, kullanici=kullanici["sub"], **updates)
    if not ok:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")
    return {"ok": True}


@app.delete("/api/projeler/{dosya_adi}")
def proje_sil(dosya_adi: str, kullanici: dict = Depends(zorunlu_oturum)):
    ok = gecmis.sil(dosya_adi, kullanici=kullanici["sub"])
    if not ok:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")
    return {"ok": True}


@app.post("/api/projeler/{dosya_adi}/paylas")
def paylas(dosya_adi: str, req: PaylasSavIstegi, kullanici: dict = Depends(zorunlu_oturum)):
    ok = gecmis.paylas(dosya_adi, kullanici["sub"], req.kullanicilar)
    if not ok:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")
    return {"ok": True}


# ─── AI: yeni proje oluştur (SSE akışı) ──────────────────────────────────────
@app.post("/api/ai/doldur")
async def ai_doldur(
    pdf: UploadFile | None = None,
    web_url: str = Form(""),
    kullanici_cevaplari: str = Form(""),
    efor: str = Form("high"),
    saglayici: str = Form("Claude (CLI)"),
    kullanici: dict = Depends(zorunlu_oturum),
):
    """Yeni başvuru formu doldurma — Server-Sent Events ile ilerleme."""
    import doldurucu
    import kaynaklar

    pdf_baytlari = await pdf.read() if pdf else None

    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def _bildir(msg: str):
        loop.call_soon_threadsafe(queue.put_nowait, {"type": "progress", "msg": msg})

    web_metni = ""
    if web_url:
        _bildir(f"Web sitesi okunuyor: {web_url}")
        try:
            web_metni, web_hatalar = kaynaklar.web_sitesi_metni([web_url])
            if web_metni:
                _bildir(f"Web sitesinden {len(web_metni):,} karakter alındı.")
            else:
                hata_str = "; ".join(web_hatalar) if web_hatalar else "İçerik bulunamadı."
                _bildir(f"Web sitesi okunamadı: {hata_str}")
        except Exception as exc:
            _bildir(f"Web sitesi hatası: {exc}")

    if pdf_baytlari:
        _bildir(f"PDF hazır ({len(pdf_baytlari):,} bayt).")

    nace_dosyasi = SRC / "data" / "nace.txt"
    nace_listesi_str = nace_dosyasi.read_text(encoding="utf-8") if nace_dosyasi.exists() else ""
    istemci = _istemci_sec(saglayici)

    _son_ilerleme: list[float] = [0.0]

    def ilerleme_cb(uretilen: int = 0, gecen: int = 0, **_kw):
        import time as _time
        now = _time.monotonic()
        if now - _son_ilerleme[0] < 1.0:
            return
        _son_ilerleme[0] = now
        msg = f"Oluşturuluyor… {uretilen} karakter ({gecen}s)"
        loop.call_soon_threadsafe(queue.put_nowait, {"type": "progress", "msg": msg})

    def _calistir():
        try:
            sonuc = doldurucu.formu_doldur(
                istemci, pdf_baytlari, web_metni, kullanici_cevaplari,
                nace_listesi_str, date.today(), ilerleme=ilerleme_cb, efor=efor,
            )
            dosya_adi = gecmis.kaydet(sonuc, kullanici=kullanici["sub"])
            loop.call_soon_threadsafe(queue.put_nowait, {"type": "done", "sonuc": sonuc, "dosya": dosya_adi})
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, {"type": "error", "msg": str(exc)})

    threading.Thread(target=_calistir, daemon=True).start()

    async def _gen():
        while True:
            item = await queue.get()
            yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"
            if item["type"] in ("done", "error"):
                break

    return StreamingResponse(_gen(), media_type="text/event-stream")


# ─── AI: sohbet asistanı ──────────────────────────────────────────────────────
@app.post("/api/ai/sohbet/{dosya_adi}")
async def ai_sohbet(
    dosya_adi: str,
    body: dict,
    kullanici: dict = Depends(zorunlu_oturum),
):
    import sohbet as sohbet_mod

    sonuc = gecmis.yukle(dosya_adi, kullanici=kullanici["sub"])
    if not sonuc:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")

    gecmis_sohbet = gecmis.sohbet_yukle(dosya_adi, kullanici=kullanici["sub"])
    mesaj = body.get("mesaj", "")
    saglayici = body.get("saglayici", "Claude (CLI)")

    istemci = _istemci_sec(saglayici)
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def _calistir():
        try:
            yanit_dict = sohbet_mod.isle(
                istemci=istemci,
                sonuc=sonuc,
                kullanici_mesaji=mesaj,
                gecmis_listesi=gecmis_sohbet,
            )
            guncellenen = yanit_dict.get("guncellenen_alanlar", {})
            yeni_sonuc = dict(sonuc)
            yeni_sonuc["alanlar"] = {**sonuc.get("alanlar", {}), **guncellenen}
            yeni_sohbet = gecmis_sohbet + [
                {"role": "user", "content": mesaj},
                {"role": "assistant", "content": yanit_dict.get("mesaj", "")},
            ]
            gecmis.guncelle(dosya_adi, yeni_sonuc, kullanici=kullanici["sub"], sohbet=yeni_sohbet, snapshot=True)
            loop.call_soon_threadsafe(queue.put_nowait, {
                "type": "done", "sonuc": yeni_sonuc, "yanit": yanit_dict.get("mesaj", ""),
                "guncellenen_alanlar": list(guncellenen.keys()),
            })
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, {"type": "error", "msg": str(exc)})

    threading.Thread(target=_calistir, daemon=True).start()
    item = await queue.get()
    if item["type"] == "error":
        raise HTTPException(status_code=500, detail=item["msg"])
    return item


# ─── AI: eksikleri bağlama göre tamamla ──────────────────────────────────────
@app.post("/api/ai/tamamla/{dosya_adi}")
async def ai_tamamla(
    dosya_adi: str,
    body: dict = {},
    kullanici: dict = Depends(zorunlu_oturum),
):
    import sohbet as sohbet_mod

    sonuc = gecmis.yukle(dosya_adi, kullanici=kullanici["sub"])
    if not sonuc:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")

    saglayici = body.get("saglayici", "Claude (CLI)")
    istemci = _istemci_sec(saglayici)

    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def _calistir():
        try:
            ozet = sohbet_mod.eksikleri_tahmin_et(istemci, sonuc)
            gecmis.guncelle(dosya_adi, sonuc, kullanici=kullanici["sub"], snapshot=True)
            loop.call_soon_threadsafe(queue.put_nowait, {
                "type": "done", "sonuc": sonuc,
                "doldurulan": ozet["doldurulan"], "kalan": ozet["kalan"],
            })
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, {"type": "error", "msg": str(exc)})

    threading.Thread(target=_calistir, daemon=True).start()
    item = await queue.get()
    if item["type"] == "error":
        raise HTTPException(status_code=500, detail=item["msg"])
    return item


# ─── AI: metin kısalt ─────────────────────────────────────────────────────────
@app.post("/api/ai/kisalt")
async def ai_kisalt(req: KisaltIstegi, kullanici: dict = Depends(zorunlu_oturum)):
    import claude_cli
    from istem import KISALTMA_ISTEMI
    from form_alanlari import ALAN_ETIKETLERI

    etiket = ALAN_ETIKETLERI.get(req.alan, req.alan)
    istem = KISALTMA_ISTEMI.format(etiket=etiket, sinir=req.limit, uzunluk=len(req.metin)) + "\n\n" + req.metin
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def _calistir():
        try:
            kisaltilmis = claude_cli.kisalt(istem) or req.metin
            loop.call_soon_threadsafe(queue.put_nowait, {"ok": True, "metin": kisaltilmis})
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, {"ok": False, "msg": str(exc)})

    threading.Thread(target=_calistir, daemon=True).start()
    return await queue.get()


# ─── Dışa aktarma ────────────────────────────────────────────────────────────
@app.get("/api/projeler/{dosya_adi}/word")
def word_indir(dosya_adi: str, kullanici: dict = Depends(zorunlu_oturum)):
    import word_aktar
    sonuc = gecmis.yukle(dosya_adi, kullanici=kullanici["sub"])
    if not sonuc:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")
    cikti = word_aktar.word_olustur(sonuc)
    isim = (sonuc.get("alanlar", {}).get("proje_kodu") or "proje") + ".docx"
    return StreamingResponse(
        iter([cikti]),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{isim}"'},
    )


@app.get("/api/projeler/{dosya_adi}/txt")
def txt_indir(dosya_adi: str, kullanici: dict = Depends(zorunlu_oturum)):
    import pdf_aktar
    sonuc = gecmis.yukle(dosya_adi, kullanici=kullanici["sub"])
    if not sonuc:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")
    metin = pdf_aktar.txt_olustur(sonuc)
    isim = (sonuc.get("alanlar", {}).get("proje_kodu") or "proje") + ".txt"
    return StreamingResponse(
        iter([metin.encode("utf-8")]),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{isim}"'},
    )


# ─── Web kaynakları ───────────────────────────────────────────────────────────
@app.get("/api/web-metni")
def web_metni(url: str, kullanici: dict = Depends(zorunlu_oturum)):
    import kaynaklar
    try:
        metin, _ = kaynaklar.web_sitesi_metni([url])
        return {"metin": metin}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ─── Yardımcılar ─────────────────────────────────────────────────────────────
def _istemci_sec(saglayici: str):
    import claude_cli
    import gemini
    if saglayici == "Gemini":
        api_key = os.getenv("GEMINI_API_KEY", "")
        return gemini.istemci_olustur(api_key)
    elif saglayici == "Claude (API)":
        import anthropic
        return anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
    else:
        return claude_cli.ClaudeCliIstemci()


@app.get("/api/saglik")
def saglik():
    return {"durum": "ok", "zaman": datetime.now().isoformat()}

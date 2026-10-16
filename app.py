"""Teknopark Ar-Ge proje başvuru formu doldurma asistanı (Streamlit arayüzü).

Çalıştırma: streamlit run app.py
"""

import json
import os
from datetime import date, datetime, timedelta
from pathlib import Path

import anthropic
import bcrypt
import extra_streamlit_components as stx
import streamlit as st
import yaml
from dotenv import load_dotenv
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from google import genai
from google.genai import errors as genai_errors

import claude_cli
import gecmis
import pdf_aktar
import portal
import sohbet
import word_aktar
from doldurucu import DoldurmaHatasi, dogrula_ve_duzelt, duz_metin_disa_aktar, formu_doldur
from form_alanlari import (
    ALAN_ETIKETLERI, ARGE_KATEGORILERI, HEDEF_KITLELER, IS_BIRLIGI_SECENEKLERI,
    METIN_ALANLARI, UNIVERSITE_SANAYI_SECENEKLERI,
)
from kaynaklar import nace_kodlari, web_sitesi_metni

load_dotenv()
VERI_KLASORU = Path(__file__).parent / "data"
NACE_DOSYASI = VERI_KLASORU / "nace.txt"


def _ozet_mesaji(sonuc: dict) -> str:
    eksikler = sonuc.get("eksik_bilgiler") or []
    uyarilar = sonuc.get("uyarilar") or []
    sorular = sonuc.get("sorular") or []
    # [EKSİK] yer tutucu sayısı — tahmin butonu için de kullanılıyor
    eksik_yer_tutucu = sum(
        str(v).count("[EKSİK") for v in (sonuc.get("alanlar") or {}).values() if v
    )
    satirlar = ["Formu doldurdum. İşte dikkat etmenizi istediğim noktalar:"]
    if eksik_yer_tutucu:
        satirlar.append(
            f"\n**{eksik_yer_tutucu} adet [EKSİK] yer tutucu** kaldı. "
            "\"Eksikleri tahmin et\" butonuyla yapay zeka bunları tahminlerle doldurabilir "
            "ya da siz doğrudan form alanlarını düzenleyebilirsiniz."
        )
    if eksikler:
        satirlar.append(f"\n**Temin edilmesi gereken bilgiler ({len(eksikler)}):**")
        for i, e in enumerate(eksikler, 1):
            satirlar.append(f"{i}. {e}")
    if uyarilar:
        satirlar.append(f"\n**Uyarılar ({len(uyarilar)}):**")
        for i, u in enumerate(uyarilar, 1):
            satirlar.append(f"{i}. {u}")
    if sorular:
        satirlar.append(f"\n**Size sorum var ({len(sorular)}):**")
        for i, s in enumerate(sorular, 1):
            satirlar.append(f"{i}. {s}")
    if not (eksik_yer_tutucu or eksikler or uyarilar or sorular):
        satirlar = ["Formu doldurdum. Belirgin bir eksik veya uyarı bulamadım — her alanı okuyup onaylayın."]
    return "\n".join(satirlar)


st.set_page_config(page_title="Teknopark Başvuru Asistanı", layout="wide")
st.markdown(
    "<style>"
    "[data-testid='stTextArea'] textarea { color: inherit !important; }"
    "[data-testid='InputInstructions'] { display: none !important; }"
    "</style>",
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------- Cookie / oturum
_KULLANICI_DOSYASI = Path(__file__).parent / "data" / "kullanicilar.yaml"
_cookie_conf = yaml.safe_load(_KULLANICI_DOSYASI.read_text(encoding="utf-8"))["cookie"]
_COOKIE_NAME = _cookie_conf["name"]
_COOKIE_DAYS = int(_cookie_conf["expiry_days"])
_signer = URLSafeTimedSerializer(_cookie_conf["key"])
_cookie_mgr = stx.CookieManager(key="_cmgr")


@st.cache_data(ttl=30, show_spinner=False)
def _kullanicilari_yukle() -> dict:
    return yaml.safe_load(_KULLANICI_DOSYASI.read_text(encoding="utf-8"))["credentials"]["usernames"]


def _sifre_dogrula(email: str, sifre: str) -> bool:
    kullanicilar = _kullanicilari_yukle()
    kayit = kullanicilar.get(email)
    if not kayit:
        return False
    try:
        return bcrypt.checkpw(sifre.encode(), kayit["password"].encode())
    except Exception:
        return False


def _cookie_oturum_ac() -> bool:
    """Cookie geçerliyse session state'i doldur ve True döndür.
    st.context.cookies HTTP request header'ından senkron okur — timing sorunu yok.
    """
    if st.session_state.get("_cikis_yapildi"):
        return False
    try:
        token = st.context.cookies.get(_COOKIE_NAME)
    except Exception:
        return False
    if not token:
        return False
    try:
        payload = _signer.loads(token, max_age=_COOKIE_DAYS * 86400)
        st.session_state["giris_yapildi"] = True
        st.session_state["kullanici_email"] = payload["e"]
        st.session_state["kullanici_ad"] = payload["n"]
        st.session_state["kullanici_rol"] = payload["r"]
        return True
    except (SignatureExpired, BadSignature, KeyError, Exception):
        return False


def _cookie_kaydet(email: str, ad: str, rol: str) -> None:
    token = _signer.dumps({"e": email, "n": ad, "r": rol})
    _cookie_mgr.set(_COOKIE_NAME, token,
                    expires_at=datetime.now() + timedelta(days=_COOKIE_DAYS))


if not st.session_state.get("giris_yapildi"):
    if _cookie_oturum_ac():
        st.rerun()
    st.markdown("""
    <style>
    #MainMenu, footer, header {visibility:hidden}
    .login-card {
        max-width: 400px; margin: 80px auto 0;
        padding: 40px; border-radius: 12px;
        border: 1px solid rgba(49,51,63,0.15);
        box-shadow: 0 4px 24px rgba(0,0,0,0.07);
    }
    .login-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
    .login-sub { color: #888; font-size: 0.9rem; margin-bottom: 28px; }
    </style>
    <div class="login-card">
        <div class="login-title">Teknopark Başvuru Asistanı</div>
        <div class="login-sub">Marta Teknoloji — AR-GE proje hazırlama</div>
    </div>
    """, unsafe_allow_html=True)
    _, _orta, _ = st.columns([1, 2, 1])
    with _orta:
        with st.form("login_form"):
            _email_girdi = st.text_input("E-posta", placeholder="ad@firma.com")
            _sifre_girdi = st.text_input("Şifre", type="password", placeholder="••••••")
            _submitted = st.form_submit_button("Giriş yap", use_container_width=True, type="primary")
        if _submitted:
            _email_temiz = _email_girdi.strip().lower()
            if _sifre_dogrula(_email_temiz, _sifre_girdi):
                _kl = _kullanicilari_yukle()
                _ad = _kl[_email_temiz].get("name", _email_temiz)
                _rol = _kl[_email_temiz].get("role", "user")
                st.session_state["giris_yapildi"] = True
                st.session_state["kullanici_email"] = _email_temiz
                st.session_state["kullanici_ad"] = _ad
                st.session_state["kullanici_rol"] = _rol
                _cookie_kaydet(_email_temiz, _ad, _rol)
                st.rerun()
            else:
                st.error("E-posta veya şifre hatalı.")
    st.stop()

_kullanici = st.session_state["kullanici_email"]
_kullanici_ad = st.session_state["kullanici_ad"]
_kullanici_rol = st.session_state.get("kullanici_rol", "user")

st.title("Teknopark Başvuru Asistanı")
st.caption("Proje belgesi ve web sitesinden Ar-Ge başvuru formunu otomatik doldurur.")

@st.cache_data(ttl=300, show_spinner=False)
def claude_oturumu() -> dict:
    return claude_cli.oturum_durumu()


# ---------------------------------------------------------------- Kenar çubuğu
with st.sidebar:
    # ---- Profil kartı ----
    _harf = _kullanici_ad[0].upper() if _kullanici_ad else "?"
    st.markdown(f"""
    <div style="display:flex;align-items:center;gap:12px;padding:12px 0 8px">
        <div style="width:42px;height:42px;border-radius:50%;background:#1f77b4;
                    display:flex;align-items:center;justify-content:center;
                    color:white;font-size:1.1rem;font-weight:700;flex-shrink:0">{_harf}</div>
        <div>
            <div style="font-weight:600;font-size:0.95rem">{_kullanici_ad}</div>
            <div style="color:#888;font-size:0.75rem">{_kullanici}</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    _col_yeni, _col_cikis = st.columns(2)
    if _col_yeni.button("Yeni çalışma", use_container_width=True, type="primary"):
        for _k in ("sonuc", "calisma", "sohbet", "tahmin_alanlari"):
            st.session_state.pop(_k, None)
        st.rerun()
    if _col_cikis.button("Çıkış yap", use_container_width=True):
        try:
            _cookie_mgr.delete(_COOKIE_NAME)
        except Exception:
            pass
        st.session_state.clear()
        st.session_state["_cikis_yapildi"] = True
        st.rerun()

    with st.expander("Profil / Şifre değiştir"):
        with st.form("pw_form"):
            _pw_eski = st.text_input("Mevcut şifre", type="password")
            _pw_yeni = st.text_input("Yeni şifre", type="password")
            _pw_yeni2 = st.text_input("Yeni şifre (tekrar)", type="password")
            _pw_sub = st.form_submit_button("Değiştir", use_container_width=True)
        if _pw_sub:
            if not _sifre_dogrula(_kullanici, _pw_eski):
                st.error("Mevcut şifre hatalı.")
            elif len(_pw_yeni) < 6:
                st.error("En az 6 karakter olmalı.")
            elif _pw_yeni != _pw_yeni2:
                st.error("Şifreler eşleşmiyor.")
            else:
                _yeni_hash = bcrypt.hashpw(_pw_yeni.encode(), bcrypt.gensalt(12)).decode()
                _conf = yaml.safe_load(_KULLANICI_DOSYASI.read_text(encoding="utf-8"))
                _conf["credentials"]["usernames"][_kullanici]["password"] = _yeni_hash
                _KULLANICI_DOSYASI.write_text(
                    yaml.dump(_conf, allow_unicode=True, default_flow_style=False),
                    encoding="utf-8",
                )
                _kullanicilari_yukle.clear()
                st.success("Şifre güncellendi.")

    # ---- Admin paneli ----
    if _kullanici_rol == "admin":
        with st.expander("Kullanıcı yönetimi"):
            _kl_adm = _kullanicilari_yukle()

            st.markdown("**Kayıtlı kullanıcılar**")
            for _em, _bil in _kl_adm.items():
                _c1, _c2 = st.columns([3, 1])
                _rol_etk = " (admin)" if _bil.get("role") == "admin" else ""
                _c1.markdown(f"**{_bil.get('name','')}**{_rol_etk}  \n{_em}")
                if _em != _kullanici:
                    if _c2.button("Sil", key=f"sil_{_em}", use_container_width=True):
                        _conf_adm = yaml.safe_load(_KULLANICI_DOSYASI.read_text(encoding="utf-8"))
                        del _conf_adm["credentials"]["usernames"][_em]
                        _KULLANICI_DOSYASI.write_text(
                            yaml.dump(_conf_adm, allow_unicode=True, default_flow_style=False),
                            encoding="utf-8",
                        )
                        _kullanicilari_yukle.clear()
                        st.rerun()

            st.markdown("---")
            st.markdown("**Yeni kullanıcı ekle**")
            with st.form("yeni_kullanici_form"):
                _yk_ad = st.text_input("Ad Soyad")
                _yk_email = st.text_input("E-posta")
                _yk_sifre = st.text_input("Şifre", type="password")
                _yk_admin = st.checkbox("Admin yetkisi")
                _yk_sub = st.form_submit_button("Ekle", use_container_width=True, type="primary")
            if _yk_sub:
                _yk_email_t = _yk_email.strip().lower()
                if not _yk_ad or not _yk_email_t or not _yk_sifre:
                    st.error("Tüm alanları doldurun.")
                elif _yk_email_t in _kl_adm:
                    st.error("Bu e-posta zaten kayıtlı.")
                elif len(_yk_sifre) < 6:
                    st.error("Şifre en az 6 karakter olmalı.")
                else:
                    _conf_adm = yaml.safe_load(_KULLANICI_DOSYASI.read_text(encoding="utf-8"))
                    _conf_adm["credentials"]["usernames"][_yk_email_t] = {
                        "email": _yk_email_t,
                        "name": _yk_ad.strip(),
                        "role": "admin" if _yk_admin else "user",
                        "password": bcrypt.hashpw(_yk_sifre.encode(), bcrypt.gensalt(12)).decode(),
                    }
                    _KULLANICI_DOSYASI.write_text(
                        yaml.dump(_conf_adm, allow_unicode=True, default_flow_style=False),
                        encoding="utf-8",
                    )
                    _kullanicilari_yukle.clear()
                    st.success(f"{_yk_ad} eklendi.")

            st.markdown("---")
            st.markdown("**Şifre sıfırla**")
            with st.form("sifre_sifirla_form"):
                _sr_email = st.selectbox("Kullanıcı", [e for e in _kl_adm if e != _kullanici])
                _sr_sifre = st.text_input("Yeni şifre", type="password")
                _sr_sub = st.form_submit_button("Sıfırla", use_container_width=True)
            if _sr_sub:
                if len(_sr_sifre) < 6:
                    st.error("En az 6 karakter olmalı.")
                else:
                    _conf_adm = yaml.safe_load(_KULLANICI_DOSYASI.read_text(encoding="utf-8"))
                    _conf_adm["credentials"]["usernames"][_sr_email]["password"] = \
                        bcrypt.hashpw(_sr_sifre.encode(), bcrypt.gensalt(12)).decode()
                    _KULLANICI_DOSYASI.write_text(
                        yaml.dump(_conf_adm, allow_unicode=True, default_flow_style=False),
                        encoding="utf-8",
                    )
                    _kullanicilari_yukle.clear()
                    st.success(f"{_sr_email} şifresi güncellendi.")

    st.divider()
    st.header("Ayarlar")
    saglayici = st.radio(
        "Yapay zekâ", ["Claude (abonelik)", "Gemini (ücretsiz)", "Claude (API)"],
        help=(
            "**Claude (abonelik):** Yerel Claude Code üzerinden Pro/Max aboneliğiyle çalışır.\n\n"
            "**Gemini (ücretsiz):** API anahtarı https://aistudio.google.com/apikey adresinden alınır.\n\n"
            "**Claude (API):** Anthropic API anahtarı gerektirir, kullanım başına ücretlidir."
        ),
    )
    gemini_secili = saglayici.startswith("Gemini")
    cli_secili = saglayici == "Claude (abonelik)"
    if cli_secili:
        api_anahtari = ""
        oturum = claude_oturumu()
        if not claude_cli.kurulu_mu():
            st.error("'claude' komutu bulunamadı.")
        elif oturum.get("loggedIn"):
            st.caption(f"{oturum.get('email', '?')} · {claude_cli.MODEL}")
        else:
            st.error("Giriş yapılmamış — terminalde `claude auth login` çalıştırın.")
    else:
        anahtar_degiskeni = "GEMINI_API_KEY" if gemini_secili else "ANTHROPIC_API_KEY"
        api_anahtari = st.text_input(
            "API anahtarı",
            value=os.getenv(anahtar_degiskeni, ""), type="password", key=anahtar_degiskeni,
            help=f"Ortam değişkeni: {anahtar_degiskeni}",
        )
    efor = st.select_slider(
        "Analiz derinliği", options=["medium", "high", "xhigh"], value="high",
        format_func={"medium": "Orta (hızlı)", "high": "Yüksek", "xhigh": "Çok yüksek (yavaş)"}.get,
    )

    with st.expander("NACE Rev.2.1 kod listesi"):
        nace_yukleme = st.file_uploader(
            "Liste dosyası (.txt / .csv)", type=["txt", "csv"],
            help="Her satırda kod ve açıklama: '62.10 Bilgisayar programlama faaliyetleri'",
        )
        if nace_yukleme is not None:
            VERI_KLASORU.mkdir(exist_ok=True)
            NACE_DOSYASI.write_bytes(nace_yukleme.getvalue())
        nace_listesi = NACE_DOSYASI.read_text(encoding="utf-8", errors="replace") if NACE_DOSYASI.exists() else ""
        kod_sayisi = len(nace_kodlari(nace_listesi))
        if kod_sayisi:
            st.success(f"{kod_sayisi} kod yüklü.")
        else:
            st.warning("Yüklenmedi — faaliyet kodları boş kalacak.")

    # ---------------------------------------------------------------- Geçmiş
    _STATU_RENK = {
        "Taslak": "#9e9e9e",
        "Devam Ediyor": "#1f77b4",
        "Başvuruldu": "#4caf50",
        "Arşiv": "#607d8b",
    }
    _STATU_SECENEKLER = list(_STATU_RENK.keys())

    st.divider()
    if "_gecmis_liste_cache" not in st.session_state:
        st.session_state["_gecmis_liste_cache"] = gecmis.listele(kullanici=_kullanici)
    gecmis_liste = st.session_state["_gecmis_liste_cache"]
    st.markdown(f"**Geçmişim** {'— ' + str(len(gecmis_liste)) + ' çalışma' if gecmis_liste else ''}")
    if not gecmis_liste:
        st.caption("Form doldurulunca otomatik kaydedilir.")
    else:
        _aktif_dosya = st.session_state.get("_gecmis_aktif_dosya", "")

        # Klasör oluştur
        with st.form("klasor_olustur_form"):
            _kf_col1, _kf_col2 = st.columns([3, 1])
            _yeni_kf = _kf_col1.text_input("Klasör adı", placeholder="Yeni klasör adı", label_visibility="collapsed")
            _kf_sub = _kf_col2.form_submit_button("+ Ekle", use_container_width=True)
        if _kf_sub and _yeni_kf.strip():
            _am = st.session_state.get("_gecmis_aktif_meta", {})
            st.session_state["_gecmis_aktif_meta"] = {"klasor": _yeni_kf.strip(), "statu": _am.get("statu", "Taslak")}
            if _aktif_dosya:
                st.session_state.pop("_gecmis_liste_cache", None)
                gecmis.meta_guncelle(_aktif_dosya, kullanici=_kullanici, klasor=_yeni_kf.strip())
            st.rerun()

        # Klasörlere göre grupla; klasörü olmayanlar "Genel"e gider
        _klasor_gruplari: dict[str, list] = {}
        for _g in gecmis_liste:
            _kadi = _g["klasor"].strip() if _g.get("klasor", "").strip() else "Genel"
            _klasor_gruplari.setdefault(_kadi, []).append(_g)

        _gi = 0
        for _kadi, _items in _klasor_gruplari.items():
            _has_active = any(_g["dosya"] == _aktif_dosya for _g in _items)
            with st.expander(f"📁 {_kadi}  ({len(_items)})", expanded=_has_active):
                for _g in _items:
                    _kodu = _g["proje_kodu"] if _g["proje_kodu"] not in ("?", "basvuru") else ""
                    _adi = _g["proje_adi"][:25] if _g["proje_adi"] else ""
                    _baslik = (_kodu + (" – " + _adi if _adi else "")) if _kodu else (_adi or "İsimsiz çalışma")
                    _statu = _g.get("statu", "Taslak")
                    _renk = _STATU_RENK.get(_statu, "#9e9e9e")
                    _aktif = _g["dosya"] == _aktif_dosya
                    _border = "2px solid #1f77b4" if _aktif else "1px solid rgba(49,51,63,0.12)"
                    st.markdown(
                        f'<div style="border:{_border};border-radius:8px;padding:8px 10px;margin-bottom:4px">'
                        f'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">'
                        f'<span style="font-size:0.72rem;color:#888">{_g["tarih"]}</span>'
                        f'<span style="font-size:0.68rem;color:#fff;background:{_renk};'
                        f'padding:1px 7px;border-radius:10px;white-space:nowrap">{_statu}</span>'
                        f'</div>'
                        f'<div style="font-size:0.82rem;font-weight:600;white-space:nowrap;'
                        f'overflow:hidden;text-overflow:ellipsis" title="{_g["proje_adi"]}">{_baslik}</div>'
                        f'</div>',
                        unsafe_allow_html=True,
                    )
                    _gc1, _gc2 = st.columns([3, 1])
                    if _gc1.button("Yükle", key=f"gyukle_{_gi}", use_container_width=True):
                        yuklenen = gecmis.yukle(_g["dosya"], kullanici=_kullanici)
                        if yuklenen:
                            st.session_state["sonuc"] = yuklenen
                            st.session_state["calisma"] = st.session_state.get("calisma", 0) + 1
                            st.session_state["sohbet"] = [{"role": "assistant", "content": _ozet_mesaji(yuklenen)}]
                            st.session_state["_gecmis_aktif_dosya"] = _g["dosya"]
                            st.session_state["_gecmis_aktif_meta"] = {"klasor": _g.get("klasor", ""), "statu": _statu}
                            st.session_state.pop("tahmin_alanlari", None)
                            st.rerun()
                        else:
                            st.error("Kayıt okunamadı.")
                    if _gc2.button("Sil", key=f"gsil_{_gi}", use_container_width=True):
                        st.session_state.pop("_gecmis_liste_cache", None)
                        gecmis.sil(_g["dosya"], kullanici=_kullanici)
                        if _aktif_dosya == _g["dosya"]:
                            st.session_state.pop("_gecmis_aktif_dosya", None)
                            st.session_state.pop("_gecmis_aktif_meta", None)
                        st.rerun()

                    # Aktif kayıtta statü/klasör düzenleme
                    if _aktif:
                        with st.form(f"meta_form_{_gi}"):
                            _mf1, _mf2 = st.columns(2)
                            _yeni_statu = _mf1.selectbox(
                                "Statü", _STATU_SECENEKLER,
                                index=_STATU_SECENEKLER.index(_statu) if _statu in _STATU_SECENEKLER else 0,
                                key=f"statu_sel_{_gi}",
                            )
                            _mevcut_klasor = _g.get("klasor", "").strip()
                            _yeni_klasor = _mf2.text_input(
                                "Klasör", value=_mevcut_klasor,
                                placeholder="Klasör adı", key=f"klasor_inp_{_gi}",
                            )
                            if st.form_submit_button("Güncelle", use_container_width=True):
                                st.session_state.pop("_gecmis_liste_cache", None)
                                gecmis.meta_guncelle(
                                    _g["dosya"], kullanici=_kullanici,
                                    statu=_yeni_statu, klasor=_yeni_klasor.strip(),
                                )
                                st.session_state["_gecmis_aktif_meta"] = {
                                    "klasor": _yeni_klasor.strip(), "statu": _yeni_statu
                                }
                                st.rerun()
                    _gi += 1

# ---------------------------------------------------------------- Kaynaklar
st.subheader("Kaynaklar")
sekme_yeni, sekme_dosya = st.tabs(["Yeni çalışma", "Dosyadan yükle"])

with sekme_yeni:
    sol, sag = st.columns(2)
    with sol:
        pdf = st.file_uploader("Proje belgesi (PDF)", type=["pdf"])
    with sag:
        url_metni = st.text_area(
            "Web sitesi adresleri (her satıra bir adres)", height=100,
            placeholder="https://www.firmaniz.com.tr\nhttps://www.firmaniz.com.tr/urunler",
        )
        alt_sayfalar = st.checkbox("İlgili alt sayfaları da tara", value=True)
    elle_tanitim = st.text_area(
        "Tanıtım metni (isteğe bağlı)", height=80,
        help="Site okunamıyorsa veya ek bilgi eklemek istiyorsanız buraya yazın.",
        placeholder="Firma tanıtımı, ürün açıklaması, teknik detaylar...",
    )



    with st.expander("Bildiğiniz bilgiler (isteğe bağlı)"):
        st.caption("Boş bırakılanlar uydurulmaz; formda [EKSİK] olarak işaretlenir.")
        c1, c2, c3 = st.columns(3)
        with c1:
            baslangic = st.date_input("Başlangıç tarihi", value=None, format="DD.MM.YYYY")
            sure_ay = st.number_input("Proje süresi (ay)", min_value=0, max_value=60, value=0,
                                      help="0 = bilinmiyor")
            butce = st.text_input("Bütçe ve kalemler", placeholder="ör. 4.500.000 TL; personel %70")
        with c2:
            personel = st.text_input("Ar-Ge / destek personeli", placeholder="ör. 4 Ar-Ge, 1 destek")
            ciro = st.text_input("Ciro beklentisi", placeholder="ör. 1. yıl 2 M TL")
            fiyat = st.text_input("Fiyatlandırma", placeholder="ör. aylık 15.000 TL abonelik")
        with c3:
            is_birligi = st.multiselect("İş birliği", IS_BIRLIGI_SECENEKLERI)
            uni = st.multiselect("Üniversite-sanayi iş birliği", UNIVERSITE_SANAYI_SECENEKLERI)
            destek = st.text_input("Alınan / başvurulan destek", placeholder="ör. TÜBİTAK 1501")
        ek_notlar = st.text_area("Diğer notlar", height=80,
                                  placeholder="Ekip, müşteriler, rakipler, teknik ayrıntılar...")

    def kullanici_cevaplarini_derle() -> str:
        satirlar = []
        if baslangic:
            satirlar.append(f"Planlanan başlangıç tarihi: {baslangic.strftime('%d.%m.%Y')}")
        if sure_ay:
            satirlar.append(f"Proje süresi: {sure_ay} ay")
        for etiket, deger in [
            ("Bütçe", butce), ("Personel", personel), ("Ciro beklentisi", ciro),
            ("Fiyatlandırma", fiyat), ("Alınan/başvurulan destek", destek),
        ]:
            if deger.strip():
                satirlar.append(f"{etiket}: {deger.strip()}")
        if is_birligi:
            satirlar.append(f"İş birliği: {', '.join(is_birligi)}")
        if uni:
            satirlar.append(f"Üniversite-sanayi iş birliği: {', '.join(uni)}")
        if ek_notlar.strip():
            satirlar.append(f"Diğer notlar:\n{ek_notlar.strip()}")
        return "\n".join(satirlar)

    if st.button("Formu Doldur", type="primary", use_container_width=True):
        url_listesi = [u for u in url_metni.splitlines() if u.strip()]
        if not (api_anahtari or cli_secili):
            st.error("API anahtarı gerekli (kenar çubuğu).")
        elif cli_secili and not claude_cli.kurulu_mu():
            st.error("'claude' komutu bulunamadı.")
        elif not (pdf or url_listesi or elle_tanitim.strip()):
            st.error("En az bir kaynak verin: PDF, web sitesi adresi veya tanıtım metni.")
        else:
            if cli_secili:
                istemci = claude_cli.ClaudeCliIstemci()
            elif gemini_secili:
                istemci = genai.Client(api_key=api_anahtari)
            else:
                istemci = anthropic.Anthropic(api_key=api_anahtari)
            bugun = date.today()
            try:
                with st.status("Form hazırlanıyor...", expanded=True) as durum:
                    web_metni = ""
                    if url_listesi:
                        st.write("Web sitesi okunuyor...")
                        web_metni, hatalar = web_sitesi_metni(url_listesi, alt_sayfalar)
                        for h in hatalar:
                            st.warning(h)
                        st.write(f"Web sitesinden {len(web_metni):,} karakter alındı.")
                    if elle_tanitim.strip():
                        web_metni = (web_metni + "\n\n--- Kullanıcının yapıştırdığı tanıtım metni ---\n"
                                     + elle_tanitim.strip()).strip()
                    st.write(f"{saglayici.split()[0]} analiz ediyor ve alanları yazıyor...")
                    sayac = st.empty()
                    sonuc = formu_doldur(
                        istemci,
                        pdf_baytlari=pdf.getvalue() if pdf else None,
                        web_metni=web_metni,
                        kullanici_cevaplari=kullanici_cevaplarini_derle(),
                        nace_listesi=nace_listesi,
                        bugun=bugun,
                        ilerleme=lambda n: sayac.write(f"Üretilen metin: {n:,} karakter"),
                        efor=efor,
                    )
                    st.write("Karakter sınırları ve seçimler kontrol ediliyor...")
                    sonuc["uygulama_notlari"] = dogrula_ve_duzelt(istemci, sonuc, nace_listesi, bugun)
                    durum.update(label="Form hazır.", state="complete", expanded=False)
                st.session_state["sonuc"] = sonuc
                st.session_state["calisma"] = st.session_state.get("calisma", 0) + 1
                st.session_state["sohbet"] = [{"role": "assistant", "content": _ozet_mesaji(sonuc)}]
                st.session_state.pop("tahmin_alanlari", None)
                _am = st.session_state.get("_gecmis_aktif_meta", {})
                st.session_state.pop("_gecmis_liste_cache", None)
                gecmis.kaydet(sonuc, kullanici=_kullanici,
                              klasor=_am.get("klasor", ""), statu=_am.get("statu", "Taslak"))
                st.toast("Geçmişe kaydedildi.")
            except DoldurmaHatasi as e:
                st.error(str(e))
            except anthropic.AuthenticationError:
                st.error("API anahtarı geçersiz.")
            except anthropic.RateLimitError:
                st.error("API hız sınırına takıldı — biraz bekleyip tekrar deneyin.")
            except anthropic.APIStatusError as e:
                st.error(f"API hatası ({e.status_code}): {e.message}")
            except anthropic.APIConnectionError:
                st.error("API'ye bağlanılamadı.")
            except genai_errors.APIError as e:
                if e.code == 429:
                    st.error("Gemini kota/hız sınırına takıldı — biraz bekleyip tekrar deneyin.")
                elif e.code in (500, 503):
                    st.error("Gemini sunucuları şu an yoğun.")
                elif e.code in (400, 401, 403) and "API key" in (e.message or ""):
                    st.error("Gemini API anahtarı geçersiz.")
                else:
                    st.error(f"Gemini API hatası ({e.code}): {e.message}")

with sekme_dosya:
    st.caption("Daha önce bu uygulamadan indirdiğiniz TXT veya JSON dosyasını yükleyin.")
    _yukle_dosya = st.file_uploader(
        "TXT veya JSON seçin", type=["txt", "json"], key="dosyadan_yukle",
        label_visibility="collapsed",
    )
    _yuklenen = None
    if _yukle_dosya:
        _icerik_bytes = _yukle_dosya.getvalue()
        if _yukle_dosya.name.endswith(".json"):
            try:
                _yuklenen = json.loads(_icerik_bytes.decode("utf-8"))
                if "alanlar" not in _yuklenen:
                    st.error("Geçerli bir sonuç JSON'u değil.")
                    _yuklenen = None
            except (json.JSONDecodeError, UnicodeDecodeError):
                st.error("JSON okunamadı.")
        else:
            _yuklenen = gecmis.txt_den_sonuca(_icerik_bytes.decode("utf-8", errors="replace"))
            if not _yuklenen:
                st.error("TXT ayrıştırılamadı — uygulamadan indirilen bir dosya olmalı.")
        if _yuklenen:
            if st.button("Formu yükle", type="primary", key="dosyadan_yukle_btn", use_container_width=True):
                st.session_state["sonuc"] = _yuklenen
                st.session_state["calisma"] = st.session_state.get("calisma", 0) + 1
                st.session_state["sohbet"] = [{"role": "assistant", "content": _ozet_mesaji(_yuklenen)}]
                st.session_state.pop("tahmin_alanlari", None)
                _am = st.session_state.get("_gecmis_aktif_meta", {})
                st.session_state.pop("_gecmis_liste_cache", None)
                gecmis.kaydet(_yuklenen, kullanici=_kullanici,
                              klasor=_am.get("klasor", ""), statu=_am.get("statu", "Taslak"))
                st.toast("Dosyadan yüklendi.")
                st.rerun()

# ---------------------------------------------------------------- Sonuçlar
sonuc = st.session_state.get("sonuc")
if sonuc:
    alanlar = sonuc["alanlar"]
    k = st.session_state.get("calisma", 0)
    st.divider()

    # Ar-Ge uygunluk
    deg = sonuc["arge_uygunluk_degerlendirmesi"]
    puan = deg["puan"]
    renk_map = {"Yüksek": "green", "Orta": "orange", "Düşük": "red"}
    renk = renk_map.get(puan, "grey")
    _kutu_renk = {"Yüksek": ("#2d8a4e", "#f0fdf4"), "Orta": ("#b45309", "#fffbeb"), "Düşük": ("#b91c1c", "#fef2f2")}
    _kenar, _arka = _kutu_renk.get(puan, ("#555", "#f5f5f5"))
    st.markdown(
        f"<div style='padding:12px 16px;border-radius:8px;border-left:5px solid {_kenar};"
        f"background:{_arka};color:#1a1a1a'>"
        f"<b style='color:{_kenar}'>Ar-Ge Uygunluğu: {puan}</b><br>"
        f"<span style='font-size:0.9em;color:#1a1a1a'>{deg['gerekce']}</span></div>",
        unsafe_allow_html=True,
    )
    st.write("")

    _eksik_toplam = (len(sonuc.get("eksik_bilgiler") or []) +
                     len(sonuc.get("uyarilar") or []) +
                     len(sonuc.get("sorular") or []))
    sekme_form, sekme_eksik, sekme_kaynak = st.tabs([
        "Form alanları",
        f"Eksikler / uyarılar / sorular ({_eksik_toplam})",
        "Kaynak notları",
    ])

    with sekme_form:
        _tahmin_alanlari = st.session_state.get("tahmin_alanlari", set())
        if _tahmin_alanlari:
            _css = " ".join(
                f".st-key-{alan}{k} textarea "
                f"{{ border: 1.5px solid #e53935 !important; background-color: #fff5f5 !important; color: #1a1a1a !important; }}"
                for alan in _tahmin_alanlari
                if alan in METIN_ALANLARI
            )
            if _css:
                st.markdown(f"<style>{_css}</style>", unsafe_allow_html=True)

        _eksik_sayisi = sum(
            str(v).count("[EKSİK") for v in alanlar.values() if v
        )
        _tahmin_sayisi = sum(
            str(v).count("~") for v in alanlar.values() if v and isinstance(v, str)
        )
        _ust_sol, _ust_sag = st.columns([4, 1])
        _ust_sol.caption("Alanları burada düzenleyebilirsiniz; indirilen dosyalar düzenlenmiş hâli içerir.")
        _buton_etiketi = (
            f"Eksikleri tahmin et ({_eksik_sayisi})" if _eksik_sayisi
            else f"Tahminleri yenile ({_tahmin_sayisi}~)" if _tahmin_sayisi
            else None
        )
        if _buton_etiketi and _ust_sag.button(
            _buton_etiketi,
            use_container_width=True,
            help="[EKSİK] yer tutucuları ve ~ tahmin değerlerini proje bağlamına göre AI ile doldurur.",
        ):
            _istem = (
                "Formdaki tüm [EKSİK] yer tutucularını proje bağlamına, sektör normlarına ve "
                "varsa teknik detaylara dayanarak makul tahminlerle doldur. "
                "Kesin veri yoksa tipik bir değer öner ve başına '~' ekle (örn: '~%3 yanlış pozitif oranı'). "
                "Yalnızca [EKSİK] içeren alanları güncelle; diğer alanlara dokunma."
            )
            st.session_state.setdefault("sohbet", []).append({"role": "user", "content": _istem})
            with st.spinner("Eksikler tahmin ediliyor..."):
                if cli_secili:
                    _istemci_e = claude_cli.ClaudeCliIstemci()
                elif gemini_secili:
                    _istemci_e = genai.Client(api_key=api_anahtari)
                else:
                    _istemci_e = anthropic.Anthropic(api_key=api_anahtari)
                _yanit = sohbet.isle(
                    _istemci_e,
                    st.session_state["sonuc"],
                    _istem,
                    st.session_state["sohbet"][:-1],
                )
            _guncellenen = _yanit.get("guncellenen_alanlar") or {}
            if _guncellenen:
                _guncellenen_alanlar = []
                _yeni_tahmin_alanlari = set()
                for _alan, _deger in _guncellenen.items():
                    if _alan in st.session_state["sonuc"]["alanlar"]:
                        st.session_state["sonuc"]["alanlar"][_alan] = _deger
                        _guncellenen_alanlar.append(
                            ALAN_ETIKETLERI.get(_alan, _alan)
                        )
                        _yeni_tahmin_alanlari.add(_alan)
                st.session_state["tahmin_alanlari"] = (
                    st.session_state.get("tahmin_alanlari", set()) | _yeni_tahmin_alanlari
                )
                st.session_state["calisma"] = st.session_state.get("calisma", 0) + 1
                st.session_state.pop("_gecmis_liste_cache", None)
                _am = st.session_state.get("_gecmis_aktif_meta", {})
                gecmis.kaydet(st.session_state["sonuc"], kullanici=_kullanici,
                              klasor=_am.get("klasor", ""), statu=_am.get("statu", "Taslak"))
                _alan_listesi = ", ".join(_guncellenen_alanlar)
                _cevap = (
                    (_yanit.get("mesaj") or "")
                    + f"\n\n*Güncellenen alanlar ({len(_guncellenen_alanlar)}): {_alan_listesi}*"
                )
            else:
                _cevap = _yanit.get("mesaj") or "Güncellenecek alan bulunamadı."
            st.session_state["sohbet"].append({"role": "assistant", "content": _cevap})
            st.rerun()
        a, b = st.columns(2)
        with a:
            st.text_input("Proje türü", alanlar["proje_turu"], disabled=True)
            alanlar["faaliyet_kodlari"] = [
                x.strip() for x in st.text_input(
                    "Faaliyet kodları (virgülle)", ", ".join(alanlar["faaliyet_kodlari"]), key=f"nace{k}",
                ).split(",") if x.strip()
            ]
            alanlar["baslangic_tarihi"] = st.text_input(
                "Başlangıç tarihi (GG.AA.YYYY)", alanlar["baslangic_tarihi"] or "", key=f"bas{k}") or None
            alanlar["tahmini_bitis_tarihi"] = st.text_input(
                "Tahmini bitiş tarihi (GG.AA.YYYY)", alanlar["tahmini_bitis_tarihi"] or "", key=f"bit{k}") or None
            alanlar["arge_destek_kurumu"] = st.text_input(
                "Ar-Ge destek kurumu", alanlar["arge_destek_kurumu"] or "", key=f"des{k}") or None
            alanlar["kdv_muafiyeti"] = st.radio(
                "KDV muafiyeti", ["Evet", "Hayır"],
                index=["Evet", "Hayır"].index(alanlar["kdv_muafiyeti"]),
                horizontal=True, key=f"kdv{k}")
        with b:
            alanlar["arge_kategorisi"] = st.multiselect(
                "Ar-Ge kategorisi", ARGE_KATEGORILERI, alanlar["arge_kategorisi"], key=f"kat{k}")
            alanlar["hedef_kitle"] = st.selectbox(
                "Hedef kitle", HEDEF_KITLELER,
                HEDEF_KITLELER.index(alanlar["hedef_kitle"]), key=f"hed{k}")
            alanlar["is_birligi"] = st.multiselect(
                "İş birliği", IS_BIRLIGI_SECENEKLERI, alanlar["is_birligi"], key=f"isb{k}")
            alanlar["universite_sanayi_isbirligi"] = st.multiselect(
                "Üniversite-sanayi iş birliği", UNIVERSITE_SANAYI_SECENEKLERI,
                alanlar["universite_sanayi_isbirligi"], key=f"uni{k}")
            if "Diğer" in alanlar["universite_sanayi_isbirligi"]:
                alanlar["universite_sanayi_diger"] = st.text_input(
                    "Üniversite-sanayi (Diğer)", alanlar["universite_sanayi_diger"] or "",
                    key=f"dig{k}") or None

        for alan, (etiket, sinir, onerilen) in METIN_ALANLARI.items():
            import html as _html
            import re as _re
            metin = alanlar[alan] or ""
            yukseklik = 68 if alan in ("proje_adi", "proje_kodu", "anahtar_kelimeler") else (
                500 if alan == "proje_detayi" else 220)
            if "~" in metin:
                st.markdown(f"**{etiket}**")
                _escaped = _html.escape(metin, quote=False)
                _styled = _re.sub(
                    r"(~[^,;\n]+)",
                    r'<span style="color:#e53935;font-weight:600">\1</span>',
                    _escaped,
                )
                st.markdown(
                    f'<div style="border:1px solid rgba(49,51,63,0.2);border-radius:0.5rem;'
                    f'padding:0.75rem 1rem;height:{yukseklik}px;overflow-y:auto;'
                    f'font-size:0.875rem;white-space:pre-wrap;line-height:1.6">'
                    f'{_styled}</div>',
                    unsafe_allow_html=True,
                )
                with st.expander("Düzenle"):
                    alanlar[alan] = st.text_area(
                        etiket, metin, height=yukseklik,
                        key=f"{alan}{k}", label_visibility="collapsed",
                    )
            else:
                alanlar[alan] = st.text_area(etiket, metin, height=yukseklik, key=f"{alan}{k}")
            n = len(alanlar[alan])
            bilgi = f"{n:,} karakter"
            if sinir:
                bilgi += f" / en fazla {sinir:,}"
            if onerilen:
                bilgi += f" · önerilen {onerilen[0]:,}–{onerilen[1]:,}"
            eksik = alanlar[alan].count("[EKSİK")
            if eksik:
                bilgi += f" · {eksik} eksik yer tutucu"
            if sinir and n > sinir:
                st.error(bilgi)
            else:
                st.caption(bilgi)

    with sekme_eksik:
        for baslik, anahtar in (
            ("Eksik bilgiler", "eksik_bilgiler"),
            ("Uyarılar", "uyarilar"),
            ("Önerilen sorular", "sorular"),
            ("Otomatik kontrol notları", "uygulama_notlari"),
        ):
            ogeler = sonuc.get(anahtar) or []
            if ogeler:
                st.subheader(f"{baslik} ({len(ogeler)})")
                for i, oge in enumerate(ogeler, 1):
                    st.markdown(f"{i}. {oge}")

    with sekme_kaynak:
        for kayit in sonuc["kaynak_notlari"]:
            st.markdown(f"**{ALAN_ETIKETLERI.get(kayit['alan'], kayit['alan'])}:** {kayit['not']}")

    # İndirme ve portal
    st.divider()
    dosya_adi = alanlar["proje_kodu"] or "basvuru"
    d1, d2, d3, d4 = st.columns(4)
    d1.download_button(
        "TXT olarak indir", duz_metin_disa_aktar(sonuc).encode("utf-8"),
        file_name=f"{dosya_adi}.txt", mime="text/plain", use_container_width=True)
    d2.download_button(
        "JSON olarak indir", json.dumps(sonuc, ensure_ascii=False, indent=2).encode("utf-8"),
        file_name=f"{dosya_adi}.json", mime="application/json", use_container_width=True)
    d3.download_button(
        "PDF olarak indir", pdf_aktar.pdf_olustur(sonuc),
        file_name=f"{dosya_adi}.pdf", mime="application/pdf", use_container_width=True)
    d4.download_button(
        "Word olarak indir", word_aktar.word_olustur(sonuc),
        file_name=f"{dosya_adi}.docx",
        mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        use_container_width=True)

    with st.expander("Teknopark portalına otomatik doldur"):
        _bm_url = portal.bookmarklet_olustur(sonuc)
        import streamlit.components.v1 as _components
        _components.html(
            f"""<!DOCTYPE html><html><body style="margin:0;padding:8px;font-family:sans-serif">
            <p style="margin:0 0 8px;font-size:13px;color:#333">
                Aşağıdaki butonu <b>yer imleri çubuğuna sürükleyin</b>
                (Ctrl+Shift+B ile çubuğu gösterin).<br>
                Teknopark portal formunda iken tıklayın — form otomatik dolar.
            </p>
            <a href="{_bm_url}"
               style="display:inline-block;padding:9px 20px;background:#1f77b4;
                      color:white;border-radius:6px;text-decoration:none;
                      font-weight:bold;font-size:14px;cursor:grab">
                ⭐ Portala Doldur
            </a>
            <span style="margin-left:12px;font-size:12px;color:#888">
                Form değiştiğinde yer imini güncelleyin.
            </span>
            </body></html>""",
            height=90,
        )
        _portal_js = portal.js_olustur(sonuc)
        with st.expander("Console script (alternatif — F12 → Console)"):
            st.code(_portal_js, language="javascript")
            st.download_button(
                "Script'i indir (.js)", _portal_js.encode("utf-8"),
                file_name=f"{dosya_adi}_portal.js", mime="text/javascript",
                use_container_width=True,
            )

    # ---------------------------------------------------------------- Sohbet
    st.divider()
    st.subheader("Sohbet ile düzelt")

    sohbet_gecmisi = st.session_state.setdefault("sohbet", [])
    for msg in sohbet_gecmisi:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    kullanici_sorusu = st.chat_input("Hangi alanı nasıl değiştireyim?")
    if kullanici_sorusu:
        sohbet_gecmisi.append({"role": "user", "content": kullanici_sorusu})
        with st.spinner("Düzenleniyor..."):
            if cli_secili:
                istemci_sohbet = claude_cli.ClaudeCliIstemci()
            elif gemini_secili:
                istemci_sohbet = genai.Client(api_key=api_anahtari)
            else:
                istemci_sohbet = anthropic.Anthropic(api_key=api_anahtari)
            yanit = sohbet.isle(
                istemci_sohbet,
                st.session_state["sonuc"],
                kullanici_sorusu,
                sohbet_gecmisi[:-1],
            )
        mesaj = yanit.get("mesaj", "")
        guncellenen = yanit.get("guncellened_alanlar") or yanit.get("guncellenen_alanlar") or {}
        if guncellenen:
            for alan, yeni_deger in guncellenen.items():
                if alan in st.session_state["sonuc"]["alanlar"]:
                    st.session_state["sonuc"]["alanlar"][alan] = yeni_deger
            st.session_state["calisma"] = st.session_state.get("calisma", 0) + 1
            cevap = mesaj + f"\n\n*{len(guncellenen)} alan güncellendi.*"
        else:
            cevap = mesaj or "Yanıt alınamadı."
        sohbet_gecmisi.append({"role": "assistant", "content": cevap})
        st.rerun()

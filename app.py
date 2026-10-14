"""Teknopark Ar-Ge proje başvuru formu doldurma asistanı (Streamlit arayüzü).

Çalıştırma: streamlit run app.py
"""

import json
import os
from datetime import date
from pathlib import Path

import anthropic
import streamlit as st
from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors

import claude_cli
from doldurucu import DoldurmaHatasi, dogrula_ve_duzelt, duz_metin_disa_aktar, formu_doldur
from form_alanlari import (
    ALAN_ETIKETLERI, ARGE_KATEGORILERI, HEDEF_KITLELER, IS_BIRLIGI_SECENEKLERI,
    METIN_ALANLARI, UNIVERSITE_SANAYI_SECENEKLERI,
)
from kaynaklar import nace_kodlari, web_sitesi_metni

load_dotenv()
VERI_KLASORU = Path(__file__).parent / "data"
NACE_DOSYASI = VERI_KLASORU / "nace.txt"

st.set_page_config(page_title="Teknopark Başvuru Asistanı", page_icon="📝", layout="wide")
st.title("Teknopark Ar-Ge Proje Başvuru Asistanı")
st.caption(
    "Proje belgesi, web sitesi ve verdiğiniz bilgilere göre başvuru formunu doldurur. "
    "Çıktı bir taslaktır; göndermeden önce her alanı okuyup [EKSİK] yerlerini tamamlayın."
)

@st.cache_data(ttl=300, show_spinner=False)
def claude_oturumu() -> dict:
    return claude_cli.oturum_durumu()


# ---------------------------------------------------------------- Kenar çubuğu
with st.sidebar:
    st.header("Ayarlar")
    saglayici = st.radio(
        "Yapay zekâ", ["Claude (abonelik)", "Gemini (ücretsiz)", "Claude (API)"],
        help="Gemini: anahtar https://aistudio.google.com/apikey adresinden ücretsiz alınır; ücretsiz "
             "katmanda içerik Google tarafından modeli geliştirmek için kullanılabilir.\n\n"
             "Claude (abonelik): bu bilgisayarda giriş yapılmış Claude Code (claude komutu) üzerinden "
             "Claude Pro/Max aboneliğinizle çalışır; API anahtarı gerekmez, kullanım abonelik "
             "limitlerinden düşer.\n\nClaude (API): Anthropic API anahtarıyla, kullanım başına ücretli.",
    )
    gemini_secili = saglayici.startswith("Gemini")
    cli_secili = saglayici == "Claude (abonelik)"
    if cli_secili:
        api_anahtari = ""
        oturum = claude_oturumu()
        if not claude_cli.kurulu_mu():
            st.error("'claude' komutu bulunamadı. KURULUM.md'deki adımları izleyin.")
        elif oturum.get("loggedIn"):
            st.caption(f"Claude hesabı: {oturum.get('email', '?')} · model: {claude_cli.MODEL}")
        else:
            st.error("Claude'a giriş yapılmamış. Terminalde `claude auth login` çalıştırıp sayfayı yenileyin.")
    else:
        anahtar_degiskeni = "GEMINI_API_KEY" if gemini_secili else "ANTHROPIC_API_KEY"
        api_anahtari = st.text_input(
            "Gemini API anahtarı" if gemini_secili else "Anthropic API anahtarı",
            value=os.getenv(anahtar_degiskeni, ""), type="password", key=anahtar_degiskeni,
            help=f"Ortam değişkeninde veya .env dosyasında {anahtar_degiskeni} tanımlıysa otomatik gelir.",
        )
    efor = st.select_slider(
        "Analiz derinliği", options=["medium", "high", "xhigh"], value="high",
        format_func={"medium": "Orta (hızlı)", "high": "Yüksek", "xhigh": "Çok yüksek (yavaş)"}.get,
    )

    st.subheader("NACE Rev.2.1 kod listesi")
    nace_yukleme = st.file_uploader(
        "Liste dosyası (.txt / .csv)", type=["txt", "csv"],
        help="Her satırda kod ve açıklama olmalı, ör. '62.10 Bilgisayar programlama faaliyetleri'. "
             "Bir kez yüklenince kaydedilir.",
    )
    if nace_yukleme is not None:
        VERI_KLASORU.mkdir(exist_ok=True)
        NACE_DOSYASI.write_bytes(nace_yukleme.getvalue())
    nace_listesi = NACE_DOSYASI.read_text(encoding="utf-8", errors="replace") if NACE_DOSYASI.exists() else ""
    kod_sayisi = len(nace_kodlari(nace_listesi))
    if kod_sayisi:
        st.success(f"{kod_sayisi} NACE kodu yüklü.")
    else:
        st.warning("NACE listesi yüklenmedi; faaliyet kodları boş bırakılacak.")

# ---------------------------------------------------------------- Kaynaklar
st.header("1. Kaynaklar")
sol, sag = st.columns(2)
with sol:
    pdf = st.file_uploader("Proje belgesi (PDF)", type=["pdf"])
with sag:
    url_metni = st.text_area(
        "Web sitesi adresleri (her satıra bir adres)", height=100,
        placeholder="https://www.firmaniz.com.tr\nhttps://www.firmaniz.com.tr/urunler",
    )
    alt_sayfalar = st.checkbox("İlgili alt sayfaları da tara (hakkımızda, ürünler vb.)", value=True)
elle_tanitim = st.text_area(
    "Tanıtım metni (isteğe bağlı)", height=100,
    help="Site okunamıyorsa veya ek tanıtım metniniz varsa buraya yapıştırın.",
)

st.header("2. Bildiğiniz bilgiler (isteğe bağlı)")
st.caption("Boş bırakılan bilgiler uydurulmaz; formda [EKSİK] olarak işaretlenir.")
c1, c2, c3 = st.columns(3)
with c1:
    baslangic = st.date_input("Planlanan başlangıç tarihi", value=None, format="DD.MM.YYYY")
    sure_ay = st.number_input("Proje süresi (ay)", min_value=0, max_value=60, value=0,
                              help="0 = bilinmiyor")
    butce = st.text_input("Toplam bütçe ve kalemler", placeholder="ör. 4.500.000 TL; personel %70 ...")
with c2:
    personel = st.text_input("Ar-Ge / destek personeli", placeholder="ör. 4 Ar-Ge, 1 destek")
    ciro = st.text_input("Ciro beklentisi", placeholder="ör. 1. yıl 2 M TL, 2. yıl 6 M TL")
    fiyat = st.text_input("Fiyatlandırma", placeholder="ör. aylık 15.000 TL abonelik")
with c3:
    is_birligi = st.multiselect("İş birliği", IS_BIRLIGI_SECENEKLERI)
    uni = st.multiselect("Üniversite-sanayi iş birliği", UNIVERSITE_SANAYI_SECENEKLERI)
    destek = st.text_input("Alınan / başvurulan destek", placeholder="ör. TÜBİTAK 1501")
ek_notlar = st.text_area("Diğer notlar (ekip, müşteriler, rakipler, teknik ayrıntılar vb.)", height=100)


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


# ---------------------------------------------------------------- Çalıştırma
st.header("3. Formu doldur")
if st.button("Formu Doldur", type="primary", use_container_width=True):
    url_listesi = [u for u in url_metni.splitlines() if u.strip()]
    if not (api_anahtari or cli_secili):
        st.error("API anahtarı gerekli (kenar çubuğu).")
    elif cli_secili and not claude_cli.kurulu_mu():
        st.error("'claude' komutu bulunamadı (kenar çubuğu).")
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

                st.write(f"{saglayici.split()[0]} kaynakları analiz ediyor ve alanları yazıyor (birkaç dakika sürebilir)...")
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
        except DoldurmaHatasi as e:
            st.error(str(e))
        except anthropic.AuthenticationError:
            st.error("API anahtarı geçersiz.")
        except anthropic.RateLimitError:
            st.error("API hız sınırına takıldı. Biraz bekleyip tekrar deneyin.")
        except anthropic.APIStatusError as e:
            st.error(f"API hatası ({e.status_code}): {e.message}")
        except anthropic.APIConnectionError:
            st.error("API'ye bağlanılamadı. İnternet bağlantınızı kontrol edin.")
        except genai_errors.APIError as e:
            if e.code == 429:
                st.error("Gemini ücretsiz kota/hız sınırına takıldı. Biraz bekleyip tekrar deneyin.")
            elif e.code in (500, 503):
                st.error("Gemini sunucuları şu an yoğun. Bir iki dakika sonra tekrar deneyin.")
            elif e.code in (400, 401, 403) and "API key" in (e.message or ""):
                st.error("Gemini API anahtarı geçersiz.")
            else:
                st.error(f"Gemini API hatası ({e.code}): {e.message}")

# ---------------------------------------------------------------- Sonuçlar
sonuc = st.session_state.get("sonuc")
if sonuc:
    alanlar = sonuc["alanlar"]
    k = st.session_state.get("calisma", 0)
    st.divider()

    deg = sonuc["arge_uygunluk_degerlendirmesi"]
    renk = {"Yüksek": "green", "Orta": "orange", "Düşük": "red"}[deg["puan"]]
    st.subheader(f"Ar-Ge uygunluk değerlendirmesi: :{renk}[{deg['puan']}]")
    st.write(deg["gerekce"])

    sekme_form, sekme_eksik, sekme_kaynak = st.tabs(
        ["Form alanları", f"Eksikler, uyarılar, sorular ({len(sonuc['eksik_bilgiler'])})", "Kaynak notları"]
    )

    with sekme_form:
        st.caption("Alanları burada düzenleyebilirsiniz; indirilen dosyalar düzenlenmiş hâli içerir.")
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
                "KDV muafiyeti", ["Evet", "Hayır"], index=["Evet", "Hayır"].index(alanlar["kdv_muafiyeti"]),
                horizontal=True, key=f"kdv{k}")
        with b:
            alanlar["arge_kategorisi"] = st.multiselect(
                "Ar-Ge kategorisi", ARGE_KATEGORILERI, alanlar["arge_kategorisi"], key=f"kat{k}")
            alanlar["hedef_kitle"] = st.selectbox(
                "Hedef kitle", HEDEF_KITLELER, HEDEF_KITLELER.index(alanlar["hedef_kitle"]), key=f"hed{k}")
            alanlar["is_birligi"] = st.multiselect(
                "İş birliği", IS_BIRLIGI_SECENEKLERI, alanlar["is_birligi"], key=f"isb{k}")
            alanlar["universite_sanayi_isbirligi"] = st.multiselect(
                "Üniversite-sanayi iş birliği", UNIVERSITE_SANAYI_SECENEKLERI,
                alanlar["universite_sanayi_isbirligi"], key=f"uni{k}")
            if "Diğer" in alanlar["universite_sanayi_isbirligi"]:
                alanlar["universite_sanayi_diger"] = st.text_input(
                    "Üniversite-sanayi (Diğer)", alanlar["universite_sanayi_diger"] or "", key=f"dig{k}") or None

        for alan, (etiket, sinir, onerilen) in METIN_ALANLARI.items():
            metin = alanlar[alan]
            yukseklik = 68 if alan in ("proje_adi", "proje_kodu", "anahtar_kelimeler") else (
                500 if alan == "proje_detayi" else 220)
            alanlar[alan] = st.text_area(etiket, metin, height=yukseklik, key=f"{alan}{k}")
            n = len(alanlar[alan])
            bilgi = f"{n:,} karakter"
            if sinir:
                bilgi += f" / en fazla {sinir:,}"
            if onerilen:
                bilgi += f" (önerilen {onerilen[0]:,}-{onerilen[1]:,})"
            eksik = alanlar[alan].count("[EKSİK")
            if eksik:
                bilgi += f" · {eksik} eksik yer tutucu"
            if sinir and n > sinir:
                st.error(bilgi)
            else:
                st.caption(bilgi)

    with sekme_eksik:
        for baslik, anahtar in (("Eksik bilgiler", "eksik_bilgiler"), ("Uyarılar", "uyarilar"),
                                ("Önerilen sorular", "sorular"), ("Otomatik kontrol notları", "uygulama_notlari")):
            ogeler = sonuc.get(anahtar) or []
            st.subheader(f"{baslik} ({len(ogeler)})")
            for i, oge in enumerate(ogeler, 1):
                st.markdown(f"{i}. {oge}")

    with sekme_kaynak:
        for kayit in sonuc["kaynak_notlari"]:
            st.markdown(f"**{ALAN_ETIKETLERI.get(kayit['alan'], kayit['alan'])}:** {kayit['not']}")

    st.divider()
    d1, d2 = st.columns(2)
    dosya_adi = alanlar["proje_kodu"] or "basvuru"
    d1.download_button(
        "Düz metin olarak indir (.txt)", duz_metin_disa_aktar(sonuc).encode("utf-8"),
        file_name=f"{dosya_adi}.txt", mime="text/plain", use_container_width=True)
    d2.download_button(
        "JSON olarak indir", json.dumps(sonuc, ensure_ascii=False, indent=2).encode("utf-8"),
        file_name=f"{dosya_adi}.json", mime="application/json", use_container_width=True)

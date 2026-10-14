"""Kaynak toplama: web sitesi metni ve NACE kod listesi."""

import re
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

KULLANICI_AJANI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) TeknoparkBasvuruAsistani/1.0"
SAYFA_BASINA_MAKS_KARAKTER = 15_000
TOPLAM_MAKS_KARAKTER = 60_000
MAKS_ALT_SAYFA = 6

# Ürün, teknoloji ve şirket bilgisi içermesi muhtemel alt sayfalar
ILGILI_YOL_KELIMELERI = [
    "hakkimizda", "hakkında", "hakkinda", "about", "kurumsal", "biz-kimiz",
    "urun", "ürün", "product", "cozum", "çözüm", "solution", "hizmet", "service",
    "teknoloji", "technology", "platform", "ozellik", "özellik", "feature",
    "referans", "reference", "musteri", "customer", "sektor", "sektör", "industr",
]


def _sayfa_getir(url: str) -> tuple[str, BeautifulSoup | None]:
    yanit = requests.get(url, headers={"User-Agent": KULLANICI_AJANI}, timeout=20)
    yanit.raise_for_status()
    if "html" not in yanit.headers.get("Content-Type", "html"):
        return "", None
    yanit.encoding = yanit.apparent_encoding or yanit.encoding
    return yanit.text, BeautifulSoup(yanit.text, "html.parser")


def _gorunur_metin(soup: BeautifulSoup) -> str:
    for etiket in soup(["script", "style", "noscript", "svg", "iframe", "form"]):
        etiket.decompose()
    baslik = soup.title.get_text(strip=True) if soup.title else ""
    aciklama = soup.find("meta", attrs={"name": "description"})
    aciklama = aciklama.get("content", "").strip() if aciklama else ""
    govde = soup.body or soup
    satirlar = [s.strip() for s in govde.get_text("\n").splitlines()]
    metin = "\n".join(s for s in satirlar if len(s) > 1)
    metin = re.sub(r"\n{3,}", "\n\n", metin)
    on_ek = "\n".join(x for x in [f"Başlık: {baslik}" if baslik else "",
                                   f"Açıklama: {aciklama}" if aciklama else ""] if x)
    return (on_ek + "\n" + metin).strip()[:SAYFA_BASINA_MAKS_KARAKTER]


def _ilgili_baglantilar(soup: BeautifulSoup, kok_url: str) -> list[str]:
    alan = urlparse(kok_url).netloc
    bulunanlar = []
    for a in soup.find_all("a", href=True):
        url = urljoin(kok_url, a["href"]).split("#")[0].rstrip("/")
        p = urlparse(url)
        if p.netloc != alan or p.scheme not in ("http", "https"):
            continue
        if re.search(r"\.(pdf|jpg|jpeg|png|gif|zip|docx?|xlsx?)$", p.path, re.I):
            continue
        yol = (p.path + " " + a.get_text(" ", strip=True)).lower()
        if any(k in yol for k in ILGILI_YOL_KELIMELERI) and url not in bulunanlar:
            bulunanlar.append(url)
    return bulunanlar


def web_sitesi_metni(url_listesi: list[str], alt_sayfalari_tara: bool = True) -> tuple[str, list[str]]:
    """Verilen adreslerin ve (istenirse) ilgili alt sayfalarının metnini toplar.

    Dönen değer: (birleştirilmiş metin, hata/uyarı mesajları)
    """
    hatalar: list[str] = []
    ziyaret_edilecek: list[str] = []
    for url in url_listesi:
        url = url.strip()
        if not url:
            continue
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        ziyaret_edilecek.append(url.rstrip("/"))

    parcalar: list[str] = []
    ziyaret_edilen: set[str] = set()
    toplam = 0
    sira = 0
    alt_sayfa_sayisi = 0
    while sira < len(ziyaret_edilecek) and toplam < TOPLAM_MAKS_KARAKTER:
        url = ziyaret_edilecek[sira]
        sira += 1
        if url in ziyaret_edilen:
            continue
        ziyaret_edilen.add(url)
        try:
            _, soup = _sayfa_getir(url)
        except requests.RequestException as e:
            hatalar.append(f"{url} alınamadı: {e}")
            continue
        if soup is None:
            continue
        if alt_sayfalari_tara and url in url_listesi_normallestir(url_listesi):
            for baglanti in _ilgili_baglantilar(soup, url):
                if alt_sayfa_sayisi >= MAKS_ALT_SAYFA:
                    break
                if baglanti not in ziyaret_edilecek:
                    ziyaret_edilecek.append(baglanti)
                    alt_sayfa_sayisi += 1
        metin = _gorunur_metin(soup)
        if not metin:
            continue
        metin = metin[: TOPLAM_MAKS_KARAKTER - toplam]
        parcalar.append(f"--- Sayfa: {url} ---\n{metin}")
        toplam += len(metin)

    if not parcalar and ziyaret_edilecek:
        hatalar.append(
            "Web sitesinden metin alınamadı. Site JavaScript ile yükleniyor olabilir; "
            "tanıtım metnini elle yapıştırabilirsiniz."
        )
    return "\n\n".join(parcalar), hatalar


def url_listesi_normallestir(url_listesi: list[str]) -> set[str]:
    sonuc = set()
    for url in url_listesi:
        url = url.strip()
        if not url:
            continue
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        sonuc.add(url.rstrip("/"))
    return sonuc


def nace_kodlari(nace_metni: str) -> set[str]:
    """NACE listesindeki kodları çıkarır (ör. 62.01, 62.01.01, 72.19)."""
    return set(re.findall(r"\b\d{2}(?:\.\d{1,2}){1,2}\b", nace_metni))

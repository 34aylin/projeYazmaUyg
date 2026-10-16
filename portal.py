"""Teknopark portalını otomatik dolduran JavaScript console script'i ve bookmarklet URL'si üretir."""

import json
import re as _re
import urllib.parse as _urlparse

# Uygulama alanı → portal input name eşlemesi
_METIN = {
    "proje_adi":               "Adi",
    "proje_kodu":              "Kodu",
    "anahtar_kelimeler":       "AnahtarKelimeler",
    "baslangic_tarihi":        "BaslangicTarihi",
    "tahmini_bitis_tarihi":    "TahminiBitisTarihi",
    "proje_konusu":            "Konusu",
    "arge_niteligi":           "ArgeNiteligi",
    "proje_detayi":            "Detayi",
    "hedeflenen_kazanimlar":   "KazanimVeSonuclar",
    "ticarilesme_potansiyeli": "TicarilesmePotansiyeli",
    "yenilikci_yonu":          "YenilikciYonu",
    "istihdam_ciro":           "IstihdamPotansiyeliCiroBeklentisi",
    "maliyetler":              "Maliyetler",
    "fiyat_maliyet_analizi":   "FiyatMaliyetAnalizi",
    "ilk_yatirim_maliyeti":    "IlkYatirimMaliyeti",
    "ciktilar_kullanim_alanlari": "CiktilarVeKullanimAlanlari",
    "musteri_segmentleri":     "PotansiyelMüsteriler",
    "rakipler":                "RakiplerVeZayifYonler",
    "urun_konumlandirma":      "UrunKonumlamaStratejisi",
    "satis_yontemleri":        "ProjeCiktisiVeSatisYontemleri",
    "ihracat_ithal_ikame":     "IhracatPotansiyeliIthalIkameEtkisi",
    "toplum_cevre_degeri":     "ToplumVeCevreBazindaKatacagiDeger",
}

# Checkbox name2 grubu → {uygulama_degeri: portal_checkbox_name}
_ARGE_KAT = {
    "Ar-Ge Projesine Doğrudan Bağlı Endüstriyel Tasarım ve Çizim": "2",
    "Bir Yenilik Unsuru İçeren Yazılım Geliştirme": "4",
    "Yeni ya da İyileştirilmiş Ürün ya da Süreçler İçin Prototip Geliştirilmesiyle Doğrudan İlişkili Sinai Mühendislik": "3",
    "Yeni ya da İyileştirilmiş Ürün ya da Süreçler İçin Prototip Geliştirme": "1",
}

_HEDEF_KITLE = {
    "Kendi Firmamız": "3",
    "Sipariş Üzerine TGB Dışında Bulunan Kurum / Kuruluş": "4",
    "TGB İçinde Bulunan Kurum / Kuruluş": "2",
}

_IS_BIRLIGI = {
    "İş Birliği Yok": "4",
    "Yabancı Firmalarla": "3",
    "Bölge dışı Firmalarla": "2",
    "Bölge içi Firmalarla": "1",
}

_UNI_SAN = {
    "Danışmanlık desteği alınması": "1",
    "Yüksek lisans ya da doktora çalışması içermesi": " 2",
    "Üniversite imkanlarının kullanılıyor olması": " 3",
    "Laboratuvar hizmet alımı": " 4",
    "Kısmi zamanlı öğrenci çalıştırma": " 5",
    "Yok": " 6",
    "Diğer": " 7",
}

_JS_YARDIMCI = r"""
  /* --- yardımcı fonksiyonlar --- */
  function setVal(name, val) {
    var el = document.querySelector('[name="' + name + '"]');
    if (!el) { console.warn('Alan bulunamadi: ' + name); return; }
    el.value = val;
    el.dispatchEvent(new Event('input',  {bubbles:true}));
    el.dispatchEvent(new Event('change', {bubbles:true}));
  }
  function setSelect(name, val) {
    var el = document.querySelector('select[name="' + name + '"]');
    if (!el) { console.warn('Select bulunamadi: ' + name); return; }
    el.value = String(val);
    el.dispatchEvent(new Event('change', {bubbles:true}));
  }
  function setSelectByText(name, text) {
    var el = document.querySelector('select[name="' + name + '"]');
    if (!el) { console.warn('Select bulunamadi: ' + name); return; }
    for (var i = 0; i < el.options.length; i++) {
      if (el.options[i].text.trim().includes(text.trim())) {
        el.value = el.options[i].value;
        el.dispatchEvent(new Event('change', {bubbles:true}));
        return;
      }
    }
    console.warn('Select secenegi bulunamadi: ' + name + ' = ' + text);
  }
  function tickCbs(name2val, ids) {
    var box = document.querySelector('[name2="' + name2val + '"]');
    if (!box) { console.warn('Checkbox grubu bulunamadi: ' + name2val); return; }
    ids.forEach(function(id) {
      var cb = box.querySelector('input[type="checkbox"][name="' + id + '"]');
      if (cb) {
        if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', {bubbles:true})); }
      } else { console.warn('Checkbox bulunamadi: ' + name2val + '[name=' + id + ']'); }
    });
  }
  async function addNaceCodes(codes) {
    var textarea = document.querySelector('textarea[name="FaaliyetKodlari"]');
    if (!textarea) { console.warn('NACE alani bulunamadi.'); return; }
    var $el = window.jQuery ? jQuery(textarea) : null;
    for (var code of codes) {
      try {
        var r   = await fetch('/PublicOp/FeedNace?term=' + encodeURIComponent(code.replace(/\.\d+$/, '').trim()));
        var arr = await r.json();
        if (!arr || !arr.length) { console.warn('NACE kodu yanit vermedi: ' + code); continue; }
        /* tam kod eslesmesini sec; yoksa ilk sonucu al */
        var item = arr.find(function(x){ return (x.name||x.text||'').startsWith(code.split(' ')[0]); }) || arr[0];
        var added = false;
        if ($el) {
          /* MagicSuggest */
          var ms = $el.data('magicSuggest') || $el.data('ms');
          if (ms && ms.addToSelection) { ms.addToSelection([item]); added = true; }
          /* tokenInput */
          if (!added && jQuery.fn.tokenInput && $el.data('tokenInputObject')) {
            $el.tokenInput('add', item); added = true;
          }
        }
        if (!added) {
          /* son care: textarea'ya virgülle yaz (ID tabanlı) */
          var cur = textarea.value ? textarea.value.split(',').map(function(s){ return s.trim(); }) : [];
          var id  = String(item.id || item.value || '');
          if (id && !cur.includes(id)) { cur.push(id); textarea.value = cur.join(','); }
          console.info('NACE mekanik eklendi (plugin API yok): ' + code + ' -> id=' + id);
        }
      } catch(e) { console.warn('NACE hata (' + code + '):', e); }
    }
  }
"""


def js_olustur(sonuc: dict) -> str:
    """Form verisini portalı dolduracak JS console script'ine dönüştürür."""
    a = sonuc.get("alanlar", {})
    satirlar: list[str] = []

    # Metin / textarea alanları
    for alan, portal_adi in _METIN.items():
        deger = a.get(alan) or ""
        if deger:
            satirlar.append(f"  setVal({json.dumps(portal_adi)}, {json.dumps(str(deger))});")

    # Proje türü sabit: Arge Projesi → 1
    satirlar.append("  setSelect('ProjeTuruId', 1);")

    # KDV muafiyeti
    kdv_val = 1 if a.get("kdv_muafiyeti", "Evet") == "Evet" else 2
    satirlar.append(f"  setSelect('KdvMuhafiyetTalebi', {kdv_val});")

    # Ar-Ge destek kurumu (select, metne göre)
    destek = a.get("arge_destek_kurumu") or ""
    if destek:
        satirlar.append(f"  setSelectByText('DestekKurumId', {json.dumps(str(destek))});")

    # Checkbox grupları
    def _tick(name2: str, mapping: dict, degerler) -> None:
        if not degerler:
            return
        if isinstance(degerler, str):
            degerler = [degerler]
        ids = [mapping[v] for v in degerler if v in mapping]
        if ids:
            satirlar.append(f"  tickCbs({json.dumps(name2)}, {json.dumps(ids)});")

    _tick("TgbFirmaProjeArgeKategorisiId", _ARGE_KAT, a.get("arge_kategorisi") or [])
    _tick("TgbFirmaProjeHedefKitleId",     _HEDEF_KITLE, a.get("hedef_kitle") or "")
    _tick("Isbirligi",                     _IS_BIRLIGI, a.get("is_birligi") or [])
    _tick("ÜniversiteSanayiIsbirligi", _UNI_SAN, a.get("universite_sanayi_isbirligi") or [])

    # Üniversite-sanayi "Diğer" metin alanı
    uni_diger = a.get("universite_sanayi_diger") or ""
    if uni_diger:
        satirlar.append(f"  setVal('ÜniversiteSanayiIsbBirligi', {json.dumps(str(uni_diger))});")

    # NACE kodları
    nace = a.get("faaliyet_kodlari") or []
    if nace:
        satirlar.append(f"  await addNaceCodes({json.dumps(nace)});")

    islemler = "\n".join(satirlar)
    return (
        "(async function() {\n"
        + _JS_YARDIMCI
        + "\n  /* --- alan doldurmalar --- */\n"
        + islemler
        + "\n\n  alert('Form dolduruldu — kontrol edip kaydedin.');\n"
        "})();"
    )


def _minify(js: str) -> str:
    """Yorumları ve fazla boşlukları temizler."""
    js = _re.sub(r'/\*.*?\*/', '', js, flags=_re.DOTALL)
    js = _re.sub(r'//[^\n]*', '', js)
    js = _re.sub(r'\n[ \t]+', '\n', js)
    js = _re.sub(r'\n{2,}', '\n', js)
    return js.strip()


def bookmarklet_olustur(sonuc: dict) -> str:
    """JS script'ini tarayıcı yer imi olarak kullanılabilecek javascript: URL'sine dönüştürür."""
    js = _minify(js_olustur(sonuc))
    return "javascript:" + _urlparse.quote(js)

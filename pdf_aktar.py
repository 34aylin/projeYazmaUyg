"""fpdf2 ile başvuru formunu PDF'e çevirir. DejaVu fontları kullanır (Türkçe destekli)."""

from datetime import date

from fpdf import FPDF

from form_alanlari import ALAN_ETIKETLERI, TUM_ALANLAR

_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
_FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


class _PDF(FPDF):
    def header(self):
        self.set_font("dv", "B", 9)
        self.set_text_color(80, 80, 80)
        self.cell(0, 7, "Teknopark Ar-Ge Proje Başvuru Formu – Taslak", align="C")
        self.ln(4)
        self.set_draw_color(200, 200, 200)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)
        self.set_text_color(0)

    def footer(self):
        self.set_y(-12)
        self.set_font("dv", size=8)
        self.set_text_color(150)
        self.cell(0, 5, f"Sayfa {self.page_no()} / {{nb}}", align="C")
        self.set_text_color(0)


def pdf_olustur(sonuc: dict) -> bytes:
    pdf = _PDF("P", "mm", "A4")
    pdf.add_font("dv", fname=_FONT)
    pdf.add_font("dv", style="B", fname=_FONT_BOLD)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(15, 15, 15)
    pdf.alias_nb_pages()
    pdf.add_page()

    alanlar = sonuc.get("alanlar", {})
    deg = sonuc.get("arge_uygunluk_degerlendirmesi", {})

    # Tarih
    pdf.set_font("dv", size=8)
    pdf.set_text_color(130)
    pdf.cell(0, 5, f"Oluşturulma: {date.today().strftime('%d.%m.%Y')}", align="R")
    pdf.ln(6)
    pdf.set_text_color(0)

    # Ar-Ge uygunluk değerlendirmesi
    if deg:
        puan = deg.get("puan", "")
        r, g, b = {"Yüksek": (0, 140, 70), "Orta": (180, 100, 0), "Düşük": (190, 30, 30)}.get(puan, (0, 0, 0))
        pdf.set_font("dv", "B", 10)
        pdf.set_text_color(r, g, b)
        pdf.cell(0, 6, f"Ar-Ge Uygunluk Değerlendirmesi: {puan}", align="L")
        pdf.set_text_color(0)
        pdf.ln(6)
        pdf.set_font("dv", size=9)
        pdf.multi_cell(0, 5, deg.get("gerekce", ""), align="L")
        pdf.ln(5)

    # Form alanları
    _bolum_baslik(pdf, "Form Alanları")
    for alan in TUM_ALANLAR:
        deger = alanlar.get(alan)
        if deger is None or deger == "" or deger == []:
            continue
        etiket = ALAN_ETIKETLERI.get(alan, alan)
        deger_str = ", ".join(str(d) for d in deger) if isinstance(deger, list) else str(deger)
        _alan_yaz(pdf, etiket, deger_str)

    # Eksikler + uyarılar
    eksikler = (sonuc.get("eksik_bilgiler") or []) + (sonuc.get("uyarilar") or [])
    if eksikler:
        _bolum_baslik(pdf, "Eksikler ve Uyarılar")
        for i, m in enumerate(eksikler, 1):
            pdf.set_font("dv", size=9)
            pdf.multi_cell(0, 5, f"{i}. {m}", align="L")
            pdf.ln(1)

    sorular = sonuc.get("sorular") or []
    if sorular:
        _bolum_baslik(pdf, "Önerilen Sorular")
        for i, s in enumerate(sorular, 1):
            pdf.set_font("dv", size=9)
            pdf.multi_cell(0, 5, f"{i}. {s}", align="L")
            pdf.ln(1)

    return bytes(pdf.output())


def _bolum_baslik(pdf: _PDF, baslik: str) -> None:
    pdf.ln(3)
    pdf.set_fill_color(235, 235, 235)
    pdf.set_font("dv", "B", 10)
    pdf.cell(0, 7, f"  {baslik}", fill=True, align="L")
    pdf.ln(6)


def _alan_yaz(pdf: _PDF, etiket: str, deger: str) -> None:
    pdf.set_font("dv", "B", 9)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(0, 5, etiket, align="L")
    pdf.ln(5)
    pdf.set_font("dv", size=9)
    pdf.set_text_color(0)
    pdf.multi_cell(0, 5, deger or "—", align="L")
    pdf.ln(3)

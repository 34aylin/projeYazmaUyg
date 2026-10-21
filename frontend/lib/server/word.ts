// Başvuru formunu Word (.docx) dosyasına çevirir.
// Tahmini değerler (~ ile başlayanlar ya da kayıtlı tahminler) belgede kırmızı gösterilir.

import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, ShadingType, TextRun } from "docx";
import { ALAN_ETIKETLERI, degerMetni, TUM_ALANLAR, type Sonuc } from "./form";

const KIRMIZI = "E53935";
const GRI = "3C3C3C";
const TILDE_RE = /(~[^,;\n]+)/;

// docx yazı boyutları yarım punto cinsindendir
const pt = (n: number) => n * 2;
// Aralıklar twip (1/20 punto) cinsindendir
const twip = (n: number) => n * 20;

function kacis(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Metni tahmin parçaları kırmızı olacak şekilde run'lara böler. */
function renkliRunlar(metin: string, boyut = 9, tahminler: string[] = []): TextRun[] {
  if (!metin) return [new TextRun({ text: "—", size: pt(boyut) })];
  const bulunan = tahminler.filter((t) => t && metin.includes(t));
  const desen = bulunan.length
    ? new RegExp("(" + [...bulunan].sort((a, b) => b.length - a.length).map(kacis).join("|") + ")")
    : TILDE_RE;
  return metin
    .split(desen)
    .filter(Boolean)
    .map((parca) => {
      const tahmin = bulunan.length ? bulunan.includes(parca) : parca.startsWith("~");
      return new TextRun({ text: parca, size: pt(boyut), ...(tahmin ? { color: KIRMIZI, bold: true } : {}) });
    });
}

function bolumBaslik(baslik: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `  ${baslik}`, size: pt(10), bold: true })],
    shading: { type: ShadingType.CLEAR, color: "auto", fill: "EBEBEB" },
    spacing: { before: twip(8), after: twip(4) },
  });
}

function alanParagraflari(etiket: string, metin: string, tahminler?: string[]): Paragraph[] {
  const satirlar = metin ? metin.split(/\r?\n/) : [""];
  return [
    new Paragraph({
      children: [new TextRun({ text: etiket, size: pt(9), bold: true, color: GRI })],
      spacing: { before: 0, after: twip(1) },
    }),
    // Çok satırlı içerikte her satır ayrı paragraf
    ...satirlar.map(
      (satir, i) =>
        new Paragraph({
          children: renkliRunlar(satir, 9, tahminler),
          spacing: { before: 0, after: i < satirlar.length - 1 ? 0 : twip(4) },
        })
    ),
  ];
}

function numaraliListe(ogeler: string[]): Paragraph[] {
  return ogeler.map(
    (m, i) => new Paragraph({ children: renkliRunlar(`${i + 1}. ${m}`), spacing: { after: twip(2) } })
  );
}

export async function wordOlustur(sonuc: Sonuc): Promise<Buffer> {
  const bugun = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const govde: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Teknopark Ar-Ge Proje Başvuru Formu – Taslak", size: pt(14), bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: `Oluşturulma: ${p(bugun.getDate())}.${p(bugun.getMonth() + 1)}.${bugun.getFullYear()}`,
          size: pt(8),
          color: "828282",
        }),
      ],
    }),
  ];

  const deg = sonuc.arge_uygunluk_degerlendirmesi;
  if (deg) {
    const renk = ({ Yüksek: "008C46", Orta: "B46400", Düşük: "BE1E1E" } as Record<string, string>)[deg.puan] ?? "000000";
    govde.push(
      new Paragraph({
        spacing: { before: twip(6) },
        children: [new TextRun({ text: `Ar-Ge Uygunluk Değerlendirmesi: ${deg.puan}`, bold: true, size: pt(10), color: renk })],
      })
    );
    if (deg.gerekce) govde.push(new Paragraph({ children: renkliRunlar(deg.gerekce) }));
  }

  govde.push(bolumBaslik("Form Alanları"));
  const alanlar = sonuc.alanlar ?? {};
  for (const alan of TUM_ALANLAR) {
    const deger = alanlar[alan];
    if (deger == null || deger === "" || (Array.isArray(deger) && !deger.length)) continue;
    govde.push(...alanParagraflari(ALAN_ETIKETLERI[alan] ?? alan, degerMetni(deger), sonuc.tahminler?.[alan]));
  }

  const eksikler = [...(sonuc.eksik_bilgiler ?? []), ...(sonuc.uyarilar ?? [])];
  if (eksikler.length) govde.push(bolumBaslik("Eksikler ve Uyarılar"), ...numaraliListe(eksikler));
  const sorular = sonuc.sorular ?? [];
  if (sorular.length) govde.push(bolumBaslik("Önerilen Sorular"), ...numaraliListe(sorular));

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: twip(50), bottom: twip(50), left: twip(70), right: twip(70) } } },
        children: govde,
      },
    ],
  });
  return Packer.toBuffer(doc);
}

// Proje kayıtlarını DATA_DIR/gecmis/<kullanıcı>/<dosya>.json olarak saklar.
// Her kayıt: { meta, sonuc, sohbet?, versiyonlar? }

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Sonuc } from "./form";
import { HttpHata } from "./http";
import { VERI_KLASORU } from "./veri";

const GECMIS_KOKU = path.join(VERI_KLASORU, "gecmis");
const MAKS_KAYIT = 50;
const MAKS_VERSIYON = 20;

export interface Mesaj {
  role: "user" | "assistant";
  content: string;
}

interface Meta {
  tarih: string;
  proje_kodu: string;
  proje_adi: string;
  klasor: string;
  statu: string;
  paylasilan?: string[];
}

interface Kayit {
  meta: Meta;
  sonuc: Sonuc;
  sohbet?: Mesaj[];
  versiyonlar?: { tarih: string; sonuc: Sonuc }[];
}

const DOSYA_RE = /^[A-Za-z0-9_-]+\.json$/;

function klasorYolu(kullanici: string): string {
  // Kullanıcı adı klasör adı olarak kullanıldığı için yol ayırıcı içeremez
  if (!kullanici || /[/\\]/.test(kullanici) || kullanici.startsWith(".")) {
    throw new HttpHata(400, "Geçersiz kullanıcı");
  }
  return path.join(GECMIS_KOKU, kullanici);
}

function dosyaYolu(dosya: string, kullanici: string): string {
  if (!DOSYA_RE.test(dosya)) throw new HttpHata(400, "Geçersiz dosya adı");
  return path.join(klasorYolu(kullanici), dosya);
}

/** Yerel saatle "YYYY-MM-DDTHH:MM:SS". */
function simdiIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function guvenliDosyaAdi(metin: string): string {
  return (metin || "").trim().replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 30) || "basvuru";
}

async function oku(yol: string): Promise<Kayit | null> {
  try {
    return JSON.parse(await readFile(yol, "utf-8"));
  } catch {
    return null;
  }
}

async function yaz(yol: string, kayit: Kayit): Promise<void> {
  await writeFile(yol, JSON.stringify(kayit, null, 2), "utf-8");
}

async function jsonDosyalari(klasor: string): Promise<string[]> {
  try {
    return (await readdir(klasor)).filter((f) => f.endsWith(".json")).sort().reverse();
  } catch {
    return [];
  }
}

/** Eksik yer tutucu içermeyen dolu alanların oranı (0–1). */
export function dolulukOrani(alanlar: Record<string, unknown>): number {
  const degerler = Object.values(alanlar ?? {});
  if (!degerler.length) return 0;
  const dolu = degerler.filter((v) => doluMu(v) && !String(v).includes("[EKSİK")).length;
  return dolu / degerler.length;
}

function doluMu(v: unknown): boolean {
  return Array.isArray(v) ? v.length > 0 : Boolean(v);
}

function ozet(dosya: string, kayit: Kayit) {
  const meta = kayit.meta ?? ({} as Meta);
  const tarihIso = meta.tarih ?? "";
  const m = tarihIso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  const gosterim = m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : tarihIso.slice(0, 16);
  const projeKodu = meta.proje_kodu || "?";
  const projeAdi = meta.proje_adi || "";
  const sonuc = kayit.sonuc ?? ({} as Sonuc);
  const alanlar = sonuc.alanlar ?? {};
  return {
    dosya,
    tarih: gosterim,
    tarih_iso: tarihIso,
    proje_kodu: projeKodu,
    proje_adi: projeAdi,
    etiket: `${gosterim} · ${projeKodu}` + (projeAdi ? ` – ${projeAdi.slice(0, 40)}` : ""),
    klasor: meta.klasor ?? "",
    statu: meta.statu ?? "Taslak",
    puan: sonuc.arge_uygunluk_degerlendirmesi?.puan ?? "Orta",
    eksik: Object.values(alanlar).reduce<number>(
      (t, v) => t + (v ? String(v).split("[EKSİK").length - 1 : 0), 0
    ),
    doluluk: dolulukOrani(alanlar),
  };
}

/** Sonucu yeni bir kayıt olarak saklar, dosya adını döndürür. */
export async function kaydet(sonuc: Sonuc, kullanici: string): Promise<string> {
  const klasor = klasorYolu(kullanici);
  await mkdir(klasor, { recursive: true });
  const projeKodu = String(sonuc.alanlar?.proje_kodu || "basvuru");
  const tarih = simdiIso();
  const dosya = `${tarih.replace(/-/g, "").replace("T", "_").replace(/:/g, "")}_${guvenliDosyaAdi(projeKodu)}.json`;
  await yaz(path.join(klasor, dosya), {
    meta: {
      tarih,
      proje_kodu: projeKodu,
      proje_adi: String(sonuc.alanlar?.proje_adi || "").slice(0, 80),
      klasor: "",
      statu: "Taslak",
    },
    sonuc,
    sohbet: [],
    versiyonlar: [],
  });
  // En yeni MAKS_KAYIT kayıt tutulur
  for (const eski of (await jsonDosyalari(klasor)).slice(MAKS_KAYIT)) {
    await unlink(path.join(klasor, eski)).catch(() => {});
  }
  return dosya;
}

/** Kullanıcının kayıtlarını yeniden eskiye sıralar. */
export async function listele(kullanici: string) {
  const klasor = klasorYolu(kullanici);
  const sonuclar = [];
  for (const dosya of await jsonDosyalari(klasor)) {
    const kayit = await oku(path.join(klasor, dosya));
    if (kayit) sonuclar.push(ozet(dosya, kayit));
  }
  return sonuclar;
}

/** Başka kullanıcıların bu kullanıcıyla paylaştığı kayıtlar. */
export async function paylasilanListele(kullanici: string) {
  const sonuclar = [];
  let sahipler: string[] = [];
  try {
    sahipler = await readdir(GECMIS_KOKU);
  } catch {
    return [];
  }
  for (const sahip of sahipler) {
    if (sahip === kullanici || sahip.startsWith(".") || sahip.startsWith("_")) continue;
    const klasor = path.join(GECMIS_KOKU, sahip);
    for (const dosya of await jsonDosyalari(klasor)) {
      const kayit = await oku(path.join(klasor, dosya));
      if (kayit?.meta?.paylasilan?.includes(kullanici)) sonuclar.push({ ...ozet(dosya, kayit), sahip });
    }
  }
  return sonuclar;
}

/** Kaydın yolunu bulur: önce kullanıcının kendi klasörü, sonra onunla paylaşılanlar. */
async function bul(dosya: string, kullanici: string, paylasilanDahil = true): Promise<string> {
  const kendi = dosyaYolu(dosya, kullanici);
  if (existsSync(kendi)) return kendi;
  if (paylasilanDahil) {
    for (const p of await paylasilanListele(kullanici)) {
      if (p.dosya === dosya) return dosyaYolu(dosya, p.sahip);
    }
  }
  throw new HttpHata(404, "Proje bulunamadı");
}

async function kayitAl(yol: string): Promise<Kayit> {
  const kayit = await oku(yol);
  if (!kayit) throw new HttpHata(404, "Proje bulunamadı");
  return kayit;
}

export async function yukle(dosya: string, kullanici: string): Promise<Sonuc> {
  return (await kayitAl(await bul(dosya, kullanici))).sonuc;
}

export async function sohbetYukle(dosya: string, kullanici: string): Promise<Mesaj[]> {
  return (await kayitAl(await bul(dosya, kullanici))).sohbet ?? [];
}

/** Önceki sürümler, yeniden eskiye. */
export async function versiyonlarYukle(dosya: string, kullanici: string) {
  return (await kayitAl(await bul(dosya, kullanici))).versiyonlar ?? [];
}

/**
 * Kaydın sonucunu değiştirir; klasör, statü ve paylaşım korunur.
 * snapshot=true ise mevcut sonuç önce sürüm geçmişine eklenir.
 */
export async function guncelle(
  dosya: string,
  kullanici: string,
  sonuc: Sonuc,
  secenek: { sohbet?: Mesaj[]; snapshot?: boolean } = {}
): Promise<void> {
  const yol = await bul(dosya, kullanici);
  const kayit = await kayitAl(yol);
  if (secenek.snapshot && kayit.sonuc) {
    kayit.versiyonlar = [{ tarih: simdiIso(), sonuc: kayit.sonuc }, ...(kayit.versiyonlar ?? [])].slice(0, MAKS_VERSIYON);
  }
  const alanlar = sonuc.alanlar ?? {};
  kayit.meta.proje_kodu = String(alanlar.proje_kodu || "basvuru");
  kayit.meta.proje_adi = String(alanlar.proje_adi || "").slice(0, 80);
  kayit.sonuc = sonuc;
  if (secenek.sohbet) kayit.sohbet = secenek.sohbet;
  await yaz(yol, kayit);
}

export async function versiyonGeriAl(dosya: string, kullanici: string, idx: number): Promise<void> {
  const versiyon = (await versiyonlarYukle(dosya, kullanici))[idx];
  if (!versiyon) throw new HttpHata(404, "Versiyon bulunamadı");
  await guncelle(dosya, kullanici, versiyon.sonuc, { snapshot: true });
}

/** Meta alanlarını (klasor, statu) günceller; yalnızca sahibi yapabilir. */
export async function metaGuncelle(
  dosya: string,
  kullanici: string,
  degisiklik: { klasor?: string; statu?: string }
): Promise<void> {
  const yol = await bul(dosya, kullanici, false);
  const kayit = await kayitAl(yol);
  if (degisiklik.klasor !== undefined) kayit.meta.klasor = degisiklik.klasor;
  if (degisiklik.statu !== undefined) kayit.meta.statu = degisiklik.statu;
  await yaz(yol, kayit);
}

export async function sil(dosya: string, kullanici: string): Promise<void> {
  await unlink(await bul(dosya, kullanici, false));
}

export async function paylas(dosya: string, kullanici: string, kullanicilar: string[]): Promise<void> {
  const yol = await bul(dosya, kullanici, false);
  const kayit = await kayitAl(yol);
  kayit.meta.paylasilan = [...new Set(kullanicilar.map((k) => k.trim()).filter((k) => k && k !== kullanici))];
  await yaz(yol, kayit);
}

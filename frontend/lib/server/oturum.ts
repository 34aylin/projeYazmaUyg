// Kullanıcı dosyası (DATA_DIR/kullanicilar.yaml) ve şifre doğrulama.

import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import YAML from "yaml";
import { VERI_KLASORU } from "./veri";

const KULLANICI_DOSYASI = path.join(VERI_KLASORU, "kullanicilar.yaml");

export interface KullaniciKaydi {
  email: string;
  name: string;
  role: string;
  password: string;
}

interface Ayarlar {
  cookie?: Record<string, unknown>;
  credentials: { usernames: Record<string, KullaniciKaydi> };
}

/** Kullanıcı dosyası yoksa varsayılan yönetici hesabıyla oluşturur. */
async function dosyayiHazirla(): Promise<void> {
  if (existsSync(KULLANICI_DOSYASI)) return;
  await mkdir(VERI_KLASORU, { recursive: true });
  await yaz({
    cookie: { name: "proje_asistani_auth", expiry_days: 30, key: randomBytes(32).toString("hex") },
    credentials: {
      usernames: {
        "admin@firma.com": {
          email: "admin@firma.com",
          name: "Yönetici",
          role: "admin",
          password: await bcrypt.hash("123456", 12),
        },
      },
    },
  });
}

async function oku(): Promise<Ayarlar> {
  await dosyayiHazirla();
  const conf = YAML.parse(await readFile(KULLANICI_DOSYASI, "utf-8")) ?? {};
  conf.credentials ??= {};
  conf.credentials.usernames ??= {};
  return conf;
}

async function yaz(conf: Ayarlar): Promise<void> {
  await writeFile(KULLANICI_DOSYASI, YAML.stringify(conf), "utf-8");
}

export async function kullanicilariYukle(): Promise<Record<string, KullaniciKaydi>> {
  try {
    return (await oku()).credentials.usernames;
  } catch {
    return {};
  }
}

/** E-posta anahtara ya da kayıttaki email alanına göre (büyük/küçük harf duyarsız) eşleşir. */
export async function kullaniciBul(email: string): Promise<[string, KullaniciKaydi] | null> {
  const temiz = email.trim().toLowerCase();
  for (const [k, v] of Object.entries(await kullanicilariYukle())) {
    if (k.trim().toLowerCase() === temiz || (v.email ?? "").trim().toLowerCase() === temiz) return [k, v];
  }
  return null;
}

export async function sifreDogrula(email: string, sifre: string): Promise<boolean> {
  const bulunan = await kullaniciBul(email);
  if (!bulunan) return false;
  const kayitli = String(bulunan[1].password ?? "");
  for (const s of new Set([sifre, sifre.trim()])) {
    try {
      if (await bcrypt.compare(s, kayitli)) return true;
    } catch {
      // bcrypt biçiminde olmayan eski kayıt
    }
  }
  return false;
}

export async function sifreDegistir(email: string, yeniSifre: string): Promise<void> {
  const conf = await oku();
  const bulunan = await kullaniciBul(email);
  if (!bulunan) throw new Error("Kullanıcı bulunamadı");
  conf.credentials.usernames[bulunan[0]].password = await bcrypt.hash(yeniSifre, 12);
  await yaz(conf);
}

export async function kullaniciEkle(email: string, ad: string, sifre: string, admin: boolean): Promise<void> {
  const conf = await oku();
  conf.credentials.usernames[email] = {
    email,
    name: ad,
    role: admin ? "admin" : "user",
    password: await bcrypt.hash(sifre, 12),
  };
  await yaz(conf);
}

export async function kullaniciSil(email: string): Promise<boolean> {
  const conf = await oku();
  if (!(email in conf.credentials.usernames)) return false;
  delete conf.credentials.usernames[email];
  await yaz(conf);
  return true;
}

// Veri klasörü: kullanıcılar, proje geçmişi ve NACE listesi burada tutulur.

import { readFile } from "node:fs/promises";
import path from "node:path";

// Depo kökündeki .env (API anahtarları, JWT_SECRET) yerel geliştirmede de okunsun;
// ortamda zaten tanımlı değişkenlerin üzerine yazmaz
try {
  process.loadEnvFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "..", ".env"));
} catch {
  // .env yok
}

// Varsayılan: depo kökündeki data/ (uygulama frontend/ içinden çalıştırılır)
export const VERI_KLASORU = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || path.join(process.cwd(), "..", "data"));

/** data/nace.txt varsa içeriğini, yoksa boş metin döndürür. */
export async function naceListesi(): Promise<string> {
  try {
    return await readFile(path.join(VERI_KLASORU, "nace.txt"), "utf-8");
  } catch {
    return "";
  }
}

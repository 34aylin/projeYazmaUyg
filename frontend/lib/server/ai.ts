// Yapay zekâ sağlayıcıları: Claude Code CLI (abonelik), Claude API ve Gemini.

import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import Anthropic from "@anthropic-ai/sdk";
import { ApiError as GeminiApiError, FinishReason, GoogleGenAI } from "@google/genai";
import "./veri";

export const SAGLAYICILAR = ["Claude (CLI)", "Gemini", "Claude (API)"] as const;
export type Saglayici = (typeof SAGLAYICILAR)[number];
export type Efor = "low" | "medium" | "high" | "xhigh";

export class AiHatasi extends Error {}

export function saglayiciSec(deger: unknown): Saglayici {
  return SAGLAYICILAR.includes(deger as Saglayici) ? (deger as Saglayici) : "Claude (CLI)";
}

export function eforSec(deger: unknown): Efor {
  return ["low", "medium", "high", "xhigh"].includes(deger as string) ? (deger as Efor) : "high";
}

type Ilerleme = (uretilen: number) => void;

interface FormIstegi {
  sistem: string;
  metin: string;
  pdf: Buffer | null;
  sema: Record<string, unknown>;
  efor: Efor;
  ilerleme?: Ilerleme;
}

interface MetinIstegi {
  sistem: string;
  istem: string;
  efor: Efor;
  /** Gemini'de JSON yanıt biçimini zorlar */
  json?: boolean;
  /** Gemini'de hızlı yedek modeli kullanır (kısaltma gibi basit işler) */
  hafif?: boolean;
}

/** Formu tek istekte üretir; şemaya uygun sonucu nesne olarak döndürür. */
export async function formUret(saglayici: Saglayici, istek: FormIstegi): Promise<unknown> {
  if (saglayici === "Gemini") return jsonCoz(await geminiForm(istek));
  if (saglayici === "Claude (API)") return jsonCoz(await claudeApiForm(istek));
  return claudeCliForm(istek);
}

/** Serbest metin yanıtı döndürür (sohbet, tahmin, kısaltma). */
export async function metinIste(saglayici: Saglayici, istek: MetinIstegi): Promise<string> {
  if (saglayici === "Gemini") return geminiMetin(istek);
  if (saglayici === "Claude (API)") return claudeApiMetin(istek);
  const sonuc = await cliCalistir([{ type: "text", text: istek.istem }], istek.sistem, istek.efor);
  return String(sonuc.result ?? "").trim();
}

function jsonCoz(metin: string): unknown {
  try {
    return JSON.parse(metin);
  } catch (e) {
    throw new AiHatasi(`Model çıktısı JSON olarak çözümlenemedi: ${(e as Error).message}`);
  }
}

function pdfBlogu(pdf: Buffer) {
  return {
    type: "document" as const,
    source: { type: "base64" as const, media_type: "application/pdf" as const, data: pdf.toString("base64") },
    title: "Proje belgesi",
  };
}

// ─── Claude API ──────────────────────────────────────────────────────────────

const CLAUDE_MODEL = "claude-opus-5-5";
// Güvenlik sınıflandırıcısı isteği reddederse sunucu tarafında uygun modele geçilir
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

function claudeIstemci(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || undefined });
}

/** Yedek modele geçildiyse yalnızca geçişten sonraki metni alır. */
function yanitMetni(yanit: Anthropic.Beta.BetaMessage): string {
  if (yanit.stop_reason === "refusal") {
    throw new AiHatasi("Model isteği reddetti. Kaynak içeriğini kontrol edip tekrar deneyin.");
  }
  if (yanit.stop_reason === "max_tokens") {
    throw new AiHatasi("Çıktı token sınırına ulaştı ve yarım kaldı. Kaynakları kısaltıp tekrar deneyin.");
  }
  let metin = "";
  for (const blok of yanit.content) {
    if (blok.type === "fallback") metin = "";
    else if (blok.type === "text") metin += blok.text;
  }
  return metin;
}

async function claudeApiForm(istek: FormIstegi): Promise<string> {
  const icerik: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (istek.pdf) icerik.push(pdfBlogu(istek.pdf));
  icerik.push({ type: "text", text: istek.metin });

  const akis = claudeIstemci().beta.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 64_000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: istek.efor, format: { type: "json_schema", schema: istek.sema } },
    system: [{ type: "text", text: istek.sistem, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: icerik }],
  });
  let uretilen = 0;
  akis.on("text", (parca) => {
    uretilen += parca.length;
    istek.ilerleme?.(uretilen);
  });
  return yanitMetni(await akis.finalMessage());
}

async function claudeApiMetin(istek: MetinIstegi): Promise<string> {
  const yanit = await claudeIstemci().beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16_000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: istek.efor },
    system: istek.sistem,
    messages: [{ role: "user", content: istek.istem }],
  });
  return yanitMetni(yanit).trim();
}

// ─── Claude Code CLI (abonelik) ──────────────────────────────────────────────

const CLI_MODEL = process.env.CLAUDE_CLI_MODEL || "opus";
const CLI_ZAMAN_ASIMI_MS = 20 * 60 * 1000;

interface CliSonuc {
  type: "result";
  subtype?: string;
  is_error?: boolean;
  result?: string;
  errors?: string[];
  structured_output?: unknown;
}

/**
 * Tek bir `claude -p` süreci çalıştırır ve son 'result' satırını döndürür.
 * Mesaj stdin'den stream-json olarak verilir, yanıt stdout'tan satır satır okunur.
 */
async function cliCalistir(
  icerik: unknown[],
  sistem: string,
  efor: Efor,
  sema?: Record<string, unknown>,
  ilerleme?: Ilerleme
): Promise<CliSonuc> {
  const komut = [
    "-p",
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--model", CLI_MODEL,
    "--effort", efor,
    "--system-prompt", sistem,
    "--tools", "", // dosya, kabuk vb. araçlar kapalı
    "--strict-mcp-config",
    "--no-session-persistence",
  ];
  if (sema) komut.push("--json-schema", JSON.stringify(sema));

  // ANTHROPIC_API_KEY varsa CLI onu kullanır (ücretli); abonelikle çalışması için çıkarılır
  const ortam = { ...process.env };
  delete ortam.ANTHROPIC_API_KEY;

  // Proje klasöründeki CLAUDE.md vb. yüklenmesin diye boş bir klasörde çalıştırılır
  const klasor = await mkdtemp(path.join(os.tmpdir(), "proje-asistan-"));
  try {
    return await new Promise<CliSonuc>((resolve, reject) => {
      const surec = spawn("claude", komut, { cwd: klasor, env: ortam, stdio: ["pipe", "pipe", "pipe"] });
      let sonuc: CliSonuc | null = null;
      let hata = "";
      let uretilen = 0;
      const zamanlayici = setTimeout(() => surec.kill(), CLI_ZAMAN_ASIMI_MS);

      surec.on("error", (e: NodeJS.ErrnoException) => {
        clearTimeout(zamanlayici);
        reject(
          new AiHatasi(
            e.code === "ENOENT"
              ? "'claude' komutu bulunamadı. Claude Code'u kurup 'claude' ile bir kez giriş yapın."
              : `Claude Code başlatılamadı: ${e.message}`
          )
        );
      });
      surec.stderr.on("data", (d) => {
        hata = (hata + d).slice(-500);
      });
      createInterface({ input: surec.stdout }).on("line", (satir) => {
        let olay;
        try {
          olay = JSON.parse(satir);
        } catch {
          return;
        }
        if (olay.type === "stream_event") {
          const delta = olay.event?.delta ?? {};
          const parca = delta.text || delta.partial_json || "";
          if (parca && (delta.type === "text_delta" || delta.type === "input_json_delta")) {
            uretilen += parca.length;
            ilerleme?.(uretilen);
          }
        } else if (olay.type === "result") {
          sonuc = olay;
        }
      });
      surec.on("close", (kod) => {
        clearTimeout(zamanlayici);
        if (!sonuc) {
          reject(new AiHatasi(`Claude Code yanıt vermedi (çıkış kodu ${kod}). ${hata.trim()}`));
          return;
        }
        if (sonuc.is_error || sonuc.subtype !== "success") {
          const ayrinti = sonuc.result || (sonuc.errors ?? []).join("; ") || sonuc.subtype || "";
          reject(
            new AiHatasi(
              /login|auth/i.test(ayrinti)
                ? "Claude Code oturumu açık değil. Terminalde 'claude' yazıp giriş yapın."
                : `Claude Code hatası: ${ayrinti}`
            )
          );
          return;
        }
        resolve(sonuc);
      });

      surec.stdin.end(
        JSON.stringify({ type: "user", message: { role: "user", content: icerik } }) + "\n"
      );
    });
  } finally {
    await rm(klasor, { recursive: true, force: true });
  }
}

async function claudeCliForm(istek: FormIstegi): Promise<unknown> {
  const icerik: unknown[] = [];
  if (istek.pdf) icerik.push(pdfBlogu(istek.pdf));
  icerik.push({ type: "text", text: istek.metin });
  const sonuc = await cliCalistir(icerik, istek.sistem, istek.efor, istek.sema, istek.ilerleme);
  if (sonuc.structured_output && typeof sonuc.structured_output === "object") return sonuc.structured_output;
  return jsonCoz(sonuc.result ?? "");
}

// ─── Gemini ──────────────────────────────────────────────────────────────────

// Ücretsiz katmanda Flash modelleri kullanılabilir; GEMINI_MODEL ile değiştirilebilir
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const GEMINI_YEDEK_MODEL = "gemini-flash-lite-latest"; // ana model yoğunsa (500/503) kullanılır
const GEMINI_PDF_MAKS_BAYT = 20 * 1024 * 1024; // satır içi gönderim sınırı
const DUSUNME_BUTCESI: Record<string, number> = { medium: 4_096, high: -1, xhigh: 24_576 }; // -1 = model karar verir

function geminiIstemci(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiHatasi("GEMINI_API_KEY tanımlı değil. .env dosyasına ekleyin.");
  return new GoogleGenAI({ apiKey });
}

async function geminiForm(istek: FormIstegi): Promise<string> {
  if (istek.pdf && istek.pdf.length > GEMINI_PDF_MAKS_BAYT) {
    throw new AiHatasi("Gemini için PDF 20 MB sınırını aşıyor. Lütfen daha küçük bir dosya yükleyin.");
  }
  const istemci = geminiIstemci();
  const parcalar = [];
  if (istek.pdf) parcalar.push({ inlineData: { mimeType: "application/pdf", data: istek.pdf.toString("base64") } });
  parcalar.push({ text: istek.metin });

  for (const model of [GEMINI_MODEL, GEMINI_YEDEK_MODEL]) {
    try {
      return await geminiAkis(istemci, model, istek, parcalar);
    } catch (e) {
      const yogun = e instanceof GeminiApiError && (e.status === 500 || e.status === 503);
      if (model === GEMINI_YEDEK_MODEL || !yogun) throw geminiHatasi(e);
    }
  }
  throw new AiHatasi("Gemini yanıt vermedi.");
}

/** Gemini API hatalarını kullanıcıya gösterilecek mesaja çevirir. */
function geminiHatasi(e: unknown): unknown {
  if (!(e instanceof GeminiApiError)) return e;
  console.error("Gemini hatası:", e.status, e.message);
  if (e.status === 500 || e.status === 503) return new AiHatasi("Gemini şu anda yoğun. Birkaç dakika sonra tekrar deneyin.");
  if (e.status === 429) return new AiHatasi("Gemini kullanım kotası doldu. Daha sonra tekrar deneyin veya başka bir sağlayıcı seçin.");
  if (e.status === 400 || e.status === 401 || e.status === 403) {
    return new AiHatasi(`Gemini isteği reddetti (${e.status}). GEMINI_API_KEY değerini kontrol edin.`);
  }
  return new AiHatasi(`Gemini hatası (${e.status}).`);
}

async function geminiAkis(
  istemci: GoogleGenAI,
  model: string,
  istek: FormIstegi,
  parcalar: object[]
): Promise<string> {
  let metin = "";
  let bitis: FinishReason | undefined;
  const akis = await istemci.models.generateContentStream({
    model,
    contents: [{ role: "user", parts: parcalar }],
    config: {
      systemInstruction: istek.sistem,
      maxOutputTokens: 65_536,
      responseMimeType: "application/json",
      responseJsonSchema: istek.sema,
      thinkingConfig: { thinkingBudget: DUSUNME_BUTCESI[istek.efor] ?? -1 },
    },
  });
  for await (const parca of akis) {
    if (parca.promptFeedback?.blockReason) {
      throw new AiHatasi("Model isteği engelledi. Kaynak içeriğini kontrol edip tekrar deneyin.");
    }
    if (parca.text) {
      metin += parca.text;
      istek.ilerleme?.(metin.length);
    }
    bitis = parca.candidates?.[0]?.finishReason ?? bitis;
  }
  if (bitis === FinishReason.MAX_TOKENS) {
    throw new AiHatasi("Çıktı token sınırına ulaştı ve yarım kaldı. Kaynakları kısaltıp tekrar deneyin.");
  }
  if (bitis && bitis !== FinishReason.STOP) {
    throw new AiHatasi(`Model yanıtı tamamlayamadı (${bitis}). Tekrar deneyin.`);
  }
  return metin;
}

async function geminiMetin(istek: MetinIstegi): Promise<string> {
  const istemci = geminiIstemci();
  const modeller = istek.hafif ? [GEMINI_YEDEK_MODEL] : [GEMINI_MODEL, GEMINI_YEDEK_MODEL];
  for (const model of modeller) {
    try {
      const yanit = await istemci.models.generateContent({
        model,
        contents: istek.istem,
        config: {
          systemInstruction: istek.sistem || undefined,
          maxOutputTokens: istek.hafif ? 32_000 : 16_000,
          responseMimeType: istek.json ? "application/json" : undefined,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      return (yanit.text ?? "").trim();
    } catch (e) {
      const yogun = e instanceof GeminiApiError && (e.status === 500 || e.status === 503);
      if (model === modeller.at(-1) || !yogun) throw geminiHatasi(e);
    }
  }
  throw new AiHatasi("Gemini yanıt vermedi.");
}

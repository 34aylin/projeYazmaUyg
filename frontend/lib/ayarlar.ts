"use client";

import { useState, useEffect } from "react";

export const SAGLAYICILAR = ["Claude (CLI)", "Gemini", "Claude (API)"] as const;
export const EFOR_SEVIYELERI = [
  { label: "Hızlı", value: "medium" },
  { label: "Standart", value: "high" },
  { label: "Kapsamlı", value: "xhigh" },
] as const;

export type Saglayici = (typeof SAGLAYICILAR)[number];
export type Efor = (typeof EFOR_SEVIYELERI)[number]["value"];

const KEY_SAGLAYICI = "ai_saglayici";
const KEY_EFOR = "ai_efor";

export function useAyarlar() {
  const [saglayici, setSaglayiciState] = useState<Saglayici>("Claude (CLI)");
  const [efor, setEforState] = useState<Efor>("high");

  useEffect(() => {
    const s = localStorage.getItem(KEY_SAGLAYICI) as Saglayici | null;
    const e = localStorage.getItem(KEY_EFOR) as Efor | null;
    if (s && SAGLAYICILAR.includes(s)) setSaglayiciState(s);
    if (e) setEforState(e);
  }, []);

  function setSaglayici(s: Saglayici) {
    setSaglayiciState(s);
    localStorage.setItem(KEY_SAGLAYICI, s);
  }

  function setEfor(e: Efor) {
    setEforState(e);
    localStorage.setItem(KEY_EFOR, e);
  }

  return { saglayici, setSaglayici, efor, setEfor };
}

export function getAyarlar(): { saglayici: Saglayici; efor: Efor } {
  if (typeof window === "undefined") return { saglayici: "Claude (CLI)", efor: "high" };
  const s = localStorage.getItem(KEY_SAGLAYICI) as Saglayici | null;
  const e = localStorage.getItem(KEY_EFOR) as Efor | null;
  return {
    saglayici: s && SAGLAYICILAR.includes(s) ? s : "Claude (CLI)",
    efor: e ?? "high",
  };
}

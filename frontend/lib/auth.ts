import Cookies from "js-cookie";
import { decodeJwt } from "jose";

const COOKIE_NAME = "proje_asistan_v2";

export function getToken(): string | null {
  return Cookies.get(COOKIE_NAME) ?? null;
}

export function setToken(token: string): void {
  Cookies.set(COOKIE_NAME, token, { expires: 30, path: "/" });
}

export function removeToken(): void {
  Cookies.remove(COOKIE_NAME, { path: "/" });
}

export interface UserPayload {
  email: string;
  ad: string;
  rol: string;
}

export function getUser(): UserPayload | null {
  const token = getToken();
  if (!token) return null;
  try {
    // Backend JWT: { sub: email, name: ad, role: rol }
    const payload = decodeJwt(token) as Record<string, unknown>;
    const email = (payload.sub ?? payload.email) as string | undefined;
    if (!email) return null;
    return {
      email,
      ad: (payload.name ?? payload.ad ?? email) as string,
      rol: (payload.role ?? payload.rol ?? "user") as string,
    };
  } catch {
    return null;
  }
}

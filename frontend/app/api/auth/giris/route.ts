import { govde, HttpHata, rota, tokenOlustur } from "@/lib/server/http";
import { kullaniciBul, sifreDogrula } from "@/lib/server/oturum";

export const POST = rota(async (req) => {
  const { email = "", sifre = "" } = (await govde(req)) as { email?: string; sifre?: string };
  if (!(await sifreDogrula(email, sifre))) throw new HttpHata(401, "E-posta veya şifre hatalı");
  const [anahtar, bilgi] = (await kullaniciBul(email))!;
  const oturum = { email: anahtar, ad: bilgi.name || anahtar, rol: bilgi.role || "user" };
  return Response.json({ token: await tokenOlustur(oturum), ...oturum });
});

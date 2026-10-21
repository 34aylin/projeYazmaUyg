import { adminOturum, HttpHata, rota } from "@/lib/server/http";
import { kullaniciSil } from "@/lib/server/oturum";

export const DELETE = rota(async (req, { params }: { params: Promise<{ email: string }> }) => {
  const oturum = await adminOturum(req);
  const { email } = await params;
  if (email === oturum.email) throw new HttpHata(400, "Kendi hesabınızı silemezsiniz");
  if (!(await kullaniciSil(email))) throw new HttpHata(404, "Kullanıcı bulunamadı");
  return Response.json({ ok: true });
});

import { metaGuncelle } from "@/lib/server/gecmis";
import { govde, rota, zorunluOturum } from "@/lib/server/http";

export const PATCH = rota(async (req, { params }: { params: Promise<{ dosya: string }> }) => {
  const { email } = await zorunluOturum(req);
  const g = await govde(req);
  await metaGuncelle((await params).dosya, email, {
    statu: typeof g.statu === "string" ? g.statu : undefined,
    klasor: typeof g.klasor === "string" ? g.klasor : undefined,
  });
  return Response.json({ ok: true });
});

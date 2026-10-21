import { HttpHata, rota, zorunluOturum } from "@/lib/server/http";
import { webSitesiMetni } from "@/lib/server/kaynaklar";

export const GET = rota(async (req) => {
  await zorunluOturum(req);
  const url = new URL(req.url).searchParams.get("url") ?? "";
  if (!url.trim()) throw new HttpHata(400, "url gerekli");
  const [metin] = await webSitesiMetni([url]);
  return Response.json({ metin });
});

import { saglayiciSec } from "@/lib/server/ai";
import { kisalt } from "@/lib/server/doldurucu";
import { govde, HttpHata, rota, zorunluOturum } from "@/lib/server/http";

export const POST = rota(async (req) => {
  await zorunluOturum(req);
  const g = await govde(req);
  const metin = String(g.metin ?? "");
  const limit = Number(g.limit);
  if (!metin || !Number.isInteger(limit) || limit <= 0) throw new HttpHata(400, "metin ve limit gerekli");
  return Response.json({
    ok: true,
    metin: await kisalt(saglayiciSec(g.saglayici), String(g.alan ?? ""), metin, limit),
  });
});

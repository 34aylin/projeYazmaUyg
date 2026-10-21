import { paylasilanListele } from "@/lib/server/gecmis";
import { rota, zorunluOturum } from "@/lib/server/http";

export const GET = rota(async (req) => {
  const { email } = await zorunluOturum(req);
  return Response.json(await paylasilanListele(email));
});

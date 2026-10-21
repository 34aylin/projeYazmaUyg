import { sohbetYukle } from "@/lib/server/gecmis";
import { rota, zorunluOturum } from "@/lib/server/http";

export const GET = rota(async (req, { params }: { params: Promise<{ dosya: string }> }) => {
  const { email } = await zorunluOturum(req);
  return Response.json({ sohbet: await sohbetYukle((await params).dosya, email) });
});

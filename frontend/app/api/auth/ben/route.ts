import { rota, zorunluOturum } from "@/lib/server/http";

export const GET = rota(async (req) => Response.json(await zorunluOturum(req)));

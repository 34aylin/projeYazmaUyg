import { connection } from "next/server";

export async function GET() {
  await connection(); // her istekte çalışsın, derlemede önceden üretilmesin
  return Response.json({ durum: "ok", zaman: new Date().toISOString() });
}

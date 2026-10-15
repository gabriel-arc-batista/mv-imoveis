import { timingSafeEqual } from "node:crypto";
import { runImovelwebSync } from "@/lib/imovelweb/sync";

// Chamada pelo Vercel Cron (vercel.json). A Vercel envia
// "Authorization: Bearer <CRON_SECRET>" quando a variável existe.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Not found", { status: 404 });
  const summary = await runImovelwebSync("cron");
  return Response.json(summary, { status: summary.ok ? 200 : 500 });
}

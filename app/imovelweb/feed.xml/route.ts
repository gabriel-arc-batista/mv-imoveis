import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getFeedConfig } from "@/lib/imovelweb/config";
import { buildImovelwebFeed } from "@/lib/imovelweb/feed";
import type { Property } from "@/lib/types";

// URL cadastrada no Imovelweb: /imovelweb/feed.xml?token=IMOVELWEB_FEED_TOKEN
// Só existe no modo XML; com credenciais da API, a sincronização assume.
export const dynamic = "force-dynamic";

const HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

function hasValidToken(request: NextRequest, expected: string | undefined): boolean {
  if (!expected) return true;
  const received = request.nextUrl.searchParams.get("token") ?? "";
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Para o portal, um arquivo sem anúncios significa "tirar todos do ar".
// Em qualquer falha respondemos erro, e ele mantém os anúncios como estão.
function unavailable(status: number, message: string) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const config = getFeedConfig();
  if (!config || !hasValidToken(request, config.token)) return unavailable(404, "Not found");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase
    .from("properties")
    .select("*, city:cities(*), neighborhood:neighborhoods(*), photos:property_photos(*)")
    .eq("publish_imovelweb", true)
    .eq("status", "disponivel")
    .eq("source", "site");

  if (error) {
    console.error("[imovelweb] falha ao consultar imóveis:", error.message);
    return unavailable(503, "Catálogo indisponível");
  }

  const { xml, included } = buildImovelwebFeed((data ?? []) as Property[], config);
  if (included.length === 0) {
    return unavailable(503, "Nenhum imóvel pronto para o Imovelweb");
  }

  return new Response(xml, { headers: HEADERS });
}

// O portal faz HEAD antes de baixar, para conferir o Content-Type.
export async function HEAD(request: NextRequest) {
  const response = await GET(request);
  return new Response(null, { status: response.status, headers: response.headers });
}

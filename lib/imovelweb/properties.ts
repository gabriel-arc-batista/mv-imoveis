import { createClient } from "@supabase/supabase-js";
import type { Property } from "@/lib/types";

const PAGE_SIZE = 250;
export async function getFeedProperties(): Promise<Property[]> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }),
      },
    },
  );
  const properties: Property[] = [];
  let expectedCount: number | null = null;
  const deadline = Date.now() + 45_000;
  for (let offset = 0; offset < 10000; offset += PAGE_SIZE) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Tempo limite de leitura do catálogo");
    const { data, error, count } = await db
      .from("properties")
      .select(
        "*, city:cities(*), neighborhood:neighborhoods(*), photos:property_photos(*)",
        { count: "exact" },
      )
      .eq("publish_imovelweb", true)
      .eq("status", "disponivel")
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1)
      .abortSignal(AbortSignal.timeout(Math.min(10_000, remaining)));
    if (error || !data || count === null)
      throw new Error("Não foi possível ler o catálogo completo");
    if (expectedCount === null) expectedCount = count;
    if (count !== expectedCount)
      throw new Error("O catálogo mudou durante a leitura");
    properties.push(...(data as Property[]));
    // Detecta limites de página do servidor e exige o total completo antes de gerar o XML.
    if (properties.length === count) return properties;
    if (data.length !== PAGE_SIZE) throw new Error("Catálogo incompleto");
  }
  throw new Error("Catálogo excede o limite desta integração");
}

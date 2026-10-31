import { createClient } from "@supabase/supabase-js";
import type { Property } from "@/lib/types";
import { FeedError } from "./errors";

const PAGE_SIZE = 250;
const MAX_PROPERTIES = 10000;

export async function getFeedProperties(
  options: { includeSold?: boolean } = {},
): Promise<Property[]> {
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
  for (let offset = 0; offset < MAX_PROPERTIES; offset += PAGE_SIZE) {
    const remaining = deadline - Date.now();
    if (remaining <= 0)
      throw new FeedError(
        "catalog_timeout",
        "Tempo limite de leitura do catálogo",
      );
    let query = db
      .from("properties")
      .select(
        "*, city:cities(id,name), neighborhood:neighborhoods(id,city_id,name), photos:property_photos(*)",
        { count: "exact" },
      )
      .eq("publish_imovelweb", true);
    if (!options.includeSold) query = query.eq("status", "disponivel");
    const { data, error, count } = await query
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1)
      .abortSignal(AbortSignal.timeout(Math.min(10_000, remaining)));
    if (error || !data || count === null) {
      const schemaMissing =
        error?.code === "42703" || error?.code === "PGRST204";
      throw new FeedError(
        schemaMissing ? "schema_missing" : "read_failed",
        "Não foi possível ler o catálogo completo",
      );
    }
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_PROPERTIES)
      throw new FeedError(
        "catalog_limit",
        "Catálogo excede o limite desta integração",
      );
    if (expectedCount === null) expectedCount = count;
    if (count !== expectedCount)
      throw new FeedError(
        "catalog_changed",
        "O catálogo mudou durante a leitura",
      );
    properties.push(...(data as Property[]));
    // Detecta limites de página do servidor e exige o total completo antes de gerar o XML.
    if (properties.length === count) return properties;
    if (data.length !== PAGE_SIZE || properties.length > count)
      throw new FeedError("catalog_incomplete", "Catálogo incompleto");
  }
  throw new FeedError(
    "catalog_limit",
    "Catálogo excede o limite desta integração",
  );
}

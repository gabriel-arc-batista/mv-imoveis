import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { makeUniqueSlug } from "@/lib/slug";
import { createServiceClient } from "@/lib/supabase/service";
import type { Property } from "@/lib/types";
import { getApiConfig, type ApiConfig } from "./config";
import {
  createImovelwebClient,
  listingErrors,
  type AvisoResumo,
  type ImovelwebClient,
} from "./client";
import { fromAviso, isPublishable, toAviso, type ImportedListing } from "./mapping";

// Sincronização com o Imovelweb pela API, nos dois sentidos:
//  * site → Imovelweb: imóveis do painel marcados para publicação;
//  * Imovelweb → site: anúncios cadastrados direto no portal.
// Cada anúncio pertence a um lado só (coluna source), então um nunca
// sobrescreve o outro.

const PROPERTY_SELECT =
  "*, city:cities(*), neighborhood:neighborhoods(*), photos:property_photos(*)";
const BUCKET = "property-photos";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
// A função da Vercel tem 60 s; o que não couber fica para a próxima rodada.
const TIME_BUDGET_MS = 45_000;

type Context = { config: ApiConfig; api: ImovelwebClient; db: SupabaseClient };

export type SyncSummary = {
  ok: boolean;
  trigger: "cron" | "manual";
  published: number;
  removed: number;
  imported: number;
  updated: number;
  unchanged: number;
  offline: number;
  pending: number;
  errors: string[];
  warnings: string[];
};

function getContext(): Context | null {
  const config = getApiConfig();
  const db = createServiceClient();
  if (!config || !db) return null;
  const contact = config.contato.email ? ` (${config.contato.email})` : "";
  const api = createImovelwebClient({ ...config, userAgent: `MVImoveisSite/1.0${contact}` });
  return { config, api, db };
}

export function isImovelwebApiEnabled() {
  return getApiConfig() !== null;
}

const describe = (error: unknown) =>
  error instanceof Error ? error.message : "Erro inesperado.";

const sha1 = (value: string) => createHash("sha1").update(value).digest("hex");

function revalidate(path: string, type?: "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Fora de uma requisição (ex.: testes) não há cache para invalidar.
  }
}

// ---------------------------------------------------------------------------
// Site → Imovelweb

type PushResult = "published" | "removed" | "unchanged" | "error";

async function pushProperty(ctx: Context, property: Property): Promise<PushResult> {
  if (property.source === "imovelweb") return "unchanged";
  const save = (fields: Partial<Property>) =>
    ctx.db.from("properties").update(fields).eq("id", property.id);

  try {
    if (isPublishable(property)) {
      const options = {
        codigoImobiliaria: ctx.config.codigoImobiliaria,
        estado: ctx.config.estado,
        contato: ctx.config.contato,
      };
      const hash = sha1(JSON.stringify(toAviso(property, options)));
      if (property.imovelweb_published_at && property.imovelweb_hash === hash && !property.imovelweb_error) {
        return "unchanged";
      }
      const idUbicacion = await ctx.api
        .resolveLocationId(ctx.config.estado, property.city!.name, property.neighborhood?.name)
        .catch(() => undefined);
      const result = await ctx.api.upsertListing(
        property.id,
        toAviso(property, { ...options, idUbicacion })
      );
      const error = listingErrors(result);
      if (error) {
        await save({ imovelweb_error: error });
        return "error";
      }
      await save({
        imovelweb_error: null,
        imovelweb_hash: hash,
        imovelweb_published_at: new Date().toISOString(),
        ...(result?.idAviso ? { imovelweb_id: result.idAviso } : {}),
      });
      return "published";
    }

    if (property.imovelweb_published_at) {
      const error = listingErrors(await ctx.api.removeListing(property.id));
      if (error) {
        await save({ imovelweb_error: error });
        return "error";
      }
      await save({ imovelweb_error: null, imovelweb_hash: null, imovelweb_published_at: null });
      return "removed";
    }

    if (property.imovelweb_error) await save({ imovelweb_error: null });
    return "unchanged";
  } catch (error) {
    await save({ imovelweb_error: describe(error) });
    return "error";
  }
}

// Chamado pelo painel depois de salvar um imóvel ou mexer nas fotos.
export async function pushPropertyToImovelweb(propertyId: string) {
  const ctx = getContext();
  if (!ctx) return;
  const { data } = await ctx.db.from("properties").select(PROPERTY_SELECT).eq("id", propertyId).maybeSingle();
  if (!data) return;
  const result = await pushProperty(ctx, data as Property);
  if (result !== "unchanged") revalidate("/admin/imoveis");
}

// Antes de excluir no painel. Devolve a mensagem de erro, se houver.
export async function prepareDeletion(propertyId: string): Promise<string | null> {
  const ctx = getContext();
  if (!ctx) return null;
  const { data } = await ctx.db
    .from("properties")
    .select("id, source, imovelweb_published_at")
    .eq("id", propertyId)
    .maybeSingle();
  if (!data) return null;
  if (data.source === "imovelweb") {
    return "Este imóvel veio do Imovelweb. Remova o anúncio por lá: ele sai do site na próxima sincronização.";
  }
  if (!data.imovelweb_published_at) return null;
  try {
    const error = listingErrors(await ctx.api.removeListing(propertyId));
    return error ? `O Imovelweb não tirou o anúncio do ar: ${error}` : null;
  } catch (error) {
    return `Não foi possível tirar o anúncio do Imovelweb: ${describe(error)}`;
  }
}

// ---------------------------------------------------------------------------
// Imovelweb → site

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

async function findOrCreate(
  db: SupabaseClient,
  table: "cities" | "neighborhoods",
  name: string,
  cityId?: string
): Promise<string> {
  const query = () => {
    const q = db.from(table).select("id, name");
    return cityId ? q.eq("city_id", cityId) : q;
  };
  const match = async () => {
    const { data, error } = await query();
    if (error) throw error;
    return (data ?? []).find((row) => normalize(row.name) === normalize(name))?.id as string | undefined;
  };
  const existing = await match();
  if (existing) return existing;
  const { data, error } = await db
    .from(table)
    .insert(cityId ? { name, city_id: cityId } : { name })
    .select("id")
    .single();
  if (!error) return data.id;
  // Criada por outra execução ao mesmo tempo.
  const retry = await match();
  if (retry) return retry;
  throw error;
}

async function availableCode(db: SupabaseClient, wanted: string, propertyId: string | null, imovelwebId: number) {
  const { data } = await db.from("properties").select("id").eq("code", wanted).maybeSingle();
  return !data || data.id === propertyId ? wanted : `IW-${imovelwebId}`;
}

async function copyPhoto(db: SupabaseClient, propertyId: string, sourceUrl: string) {
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
  const type = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
  const extension = PHOTO_EXTENSIONS[type];
  if (!response.ok || !extension) throw new Error(`foto recusada (${response.status} ${type})`);
  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_PHOTO_BYTES) throw new Error("foto maior que 10 MB");
  const path = `${propertyId}/iw-${sha1(sourceUrl).slice(0, 20)}.${extension}`;
  const { error } = await db.storage.from(BUCKET).upload(path, body, { contentType: type, upsert: true });
  if (error) throw error;
  return { path, url: db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

// Espelha as fotos do anúncio. Fotos adicionadas no painel (sem source_url)
// são mantidas, depois das importadas.
async function syncPhotos(db: SupabaseClient, propertyId: string, urls: string[], warnings: string[]) {
  type Row = { id: string; storage_path: string; source_url: string | null; position: number; is_cover: boolean };
  const load = async () => {
    const { data, error } = await db
      .from("property_photos")
      .select("id, storage_path, source_url, position, is_cover")
      .eq("property_id", propertyId);
    if (error) throw error;
    return (data ?? []) as Row[];
  };

  const current = await load();
  const stale = current.filter((p) => p.source_url && !urls.includes(p.source_url));
  if (stale.length > 0) {
    await db.storage.from(BUCKET).remove(stale.map((p) => p.storage_path));
    await db.from("property_photos").delete().in("id", stale.map((p) => p.id));
  }

  const present = new Set(current.map((p) => p.source_url));
  for (const [index, sourceUrl] of urls.entries()) {
    if (present.has(sourceUrl)) continue;
    try {
      const copy = await copyPhoto(db, propertyId, sourceUrl);
      await db.from("property_photos").insert({
        property_id: propertyId,
        url: copy.url,
        storage_path: copy.path,
        source_url: sourceUrl,
        position: index,
        is_cover: false,
      });
    } catch (error) {
      warnings.push(`Foto não copiada (${sourceUrl.slice(0, 80)}): ${describe(error)}`);
    }
  }

  const photos = await load();
  const rank = (p: Row) => (p.source_url ? urls.indexOf(p.source_url) : urls.length + p.position);
  const ordered = [...photos].sort((a, b) => rank(a) - rank(b));
  const hasCover = ordered.some((p) => p.is_cover);
  for (const [position, photo] of ordered.entries()) {
    const isCover = hasCover ? photo.is_cover : position === 0;
    if (photo.position !== position || photo.is_cover !== isCover) {
      await db.from("property_photos").update({ position, is_cover: isCover }).eq("id", photo.id);
    }
  }
}

async function saveImported(
  ctx: Context,
  propertyId: string | null,
  imovelwebId: number,
  modifiedAt: string,
  listing: ImportedListing,
  warnings: string[]
) {
  const cityId = await findOrCreate(ctx.db, "cities", listing.cityName);
  const neighborhoodId = await findOrCreate(ctx.db, "neighborhoods", listing.neighborhoodName, cityId);
  const code = await availableCode(ctx.db, listing.reference ?? `IW-${imovelwebId}`, propertyId, imovelwebId);

  const fields = {
    code,
    title: listing.title,
    description: listing.description,
    type: listing.type,
    transaction_type: listing.transaction_type,
    price: listing.price,
    address: listing.address,
    zip_code: listing.zip_code,
    area_m2: listing.area_m2,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    parking_spots: listing.parking_spots,
    city_id: cityId,
    neighborhood_id: neighborhoodId,
    source: "imovelweb",
    imovelweb_id: imovelwebId,
    imovelweb_modified_at: modifiedAt || null,
    imovelweb_offline_at: null,
    publish_imovelweb: false,
  };

  let id = propertyId;
  if (id) {
    // Status e destaque continuam sendo decididos no painel.
    const { error } = await ctx.db.from("properties").update(fields).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await ctx.db
      .from("properties")
      .insert({ ...fields, status: "disponivel", slug: `${makeUniqueSlug(listing.title, code)}-iw${imovelwebId}` })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id as string;
  }
  await syncPhotos(ctx.db, id!, listing.photoUrls, warnings);
}

async function importListings(ctx: Context, summary: SyncSummary, deadline: number) {
  const online = (await ctx.api.listOnlineListings()).filter(
    (item: AvisoResumo) => !item.tipoDeAviso || item.tipoDeAviso === "AVISO_CLASIFICADO"
  );

  const { data, error } = await ctx.db
    .from("properties")
    .select("id, source, imovelweb_id, imovelweb_modified_at, imovelweb_offline_at");
  if (error) throw error;
  type Local = { id: string; source: string; imovelweb_id: number | null; imovelweb_modified_at: string | null; imovelweb_offline_at: string | null };
  const locals = (data ?? []) as Local[];
  const siteIds = new Map(locals.filter((p) => p.source !== "imovelweb").map((p) => [p.id, p]));
  const byImovelwebId = new Map(
    locals.filter((p) => p.imovelweb_id != null).map((p) => [Number(p.imovelweb_id), p])
  );

  for (const item of online) {
    const imovelwebId = Number(item.idAvisoNavplat);
    if (!Number.isFinite(imovelwebId)) continue;

    // Anúncio publicado pelo próprio site: só guarda o vínculo.
    const own = item.codigoAviso ? siteIds.get(item.codigoAviso) : undefined;
    if (own) {
      if (Number(own.imovelweb_id) !== imovelwebId) {
        await ctx.db.from("properties").update({ imovelweb_id: imovelwebId }).eq("id", own.id);
      }
      continue;
    }
    // Código no formato do site, mas sem imóvel aqui: não é nosso para importar.
    if (item.codigoAviso && UUID.test(item.codigoAviso)) continue;

    const existing = byImovelwebId.get(imovelwebId);
    if (existing && existing.source !== "imovelweb") continue;

    const modifiedAt = String(item.dataModificacao ?? item.fechaModificacion ?? "");
    if (existing && modifiedAt && existing.imovelweb_modified_at === modifiedAt && !existing.imovelweb_offline_at) {
      summary.unchanged++;
      continue;
    }
    if (Date.now() > deadline) {
      summary.pending++;
      continue;
    }

    try {
      let codigo = item.codigoAviso;
      if (!codigo) {
        codigo = `iw-${imovelwebId}`;
        await ctx.api.associate(codigo, imovelwebId);
      }
      const aviso = await ctx.api.getListing(codigo);
      if (!aviso) throw new Error("o Imovelweb não devolveu os dados do anúncio");
      await saveImported(ctx, existing?.id ?? null, imovelwebId, modifiedAt, fromAviso(aviso, imovelwebId), summary.warnings);
      if (existing) summary.updated++;
      else summary.imported++;
    } catch (error) {
      summary.errors.push(`Anúncio ${imovelwebId}: ${describe(error)}`);
    }
  }

  // Importados que saíram do ar no portal deixam de aparecer no site.
  const onlineIds = new Set(online.map((item) => Number(item.idAvisoNavplat)));
  const gone = locals.filter(
    (p) => p.source === "imovelweb" && p.imovelweb_id != null && !p.imovelweb_offline_at && !onlineIds.has(Number(p.imovelweb_id))
  );
  if (gone.length === 0) return;
  if (online.length === 0) {
    // Lista vazia pode ser falha do portal; não esconder o catálogo inteiro.
    summary.warnings.push(
      "O Imovelweb não devolveu nenhum anúncio online. Por segurança, nenhum imóvel importado foi tirado do site."
    );
    return;
  }
  const { error: offlineError } = await ctx.db
    .from("properties")
    .update({ imovelweb_offline_at: new Date().toISOString() })
    .in("id", gone.map((p) => p.id));
  if (offlineError) throw offlineError;
  summary.offline = gone.length;
}

// ---------------------------------------------------------------------------

export async function runImovelwebSync(trigger: SyncSummary["trigger"]): Promise<SyncSummary> {
  const summary: SyncSummary = {
    ok: false,
    trigger,
    published: 0,
    removed: 0,
    imported: 0,
    updated: 0,
    unchanged: 0,
    offline: 0,
    pending: 0,
    errors: [],
    warnings: [],
  };
  const ctx = getContext();
  if (!ctx) {
    summary.errors.push("Integração com o Imovelweb não configurada.");
    return summary;
  }

  const deadline = Date.now() + TIME_BUDGET_MS;
  const { data: run } = await ctx.db.from("imovelweb_sync_runs").insert({}).select("id").single();

  try {
    const { data, error } = await ctx.db
      .from("properties")
      .select(PROPERTY_SELECT)
      .eq("source", "site")
      .or("publish_imovelweb.eq.true,imovelweb_published_at.not.is.null");
    if (error) throw error;
    for (const property of (data ?? []) as Property[]) {
      if (Date.now() > deadline) {
        summary.pending++;
        continue;
      }
      const result = await pushProperty(ctx, property);
      if (result === "published") summary.published++;
      if (result === "removed") summary.removed++;
      if (result === "error") summary.errors.push(`${property.code}: recusado pelo Imovelweb (veja o imóvel no painel)`);
    }

    await importListings(ctx, summary, deadline);
    summary.ok = true;
  } catch (error) {
    summary.errors.push(describe(error));
  } finally {
    if (run) {
      await ctx.db
        .from("imovelweb_sync_runs")
        .update({ finished_at: new Date().toISOString(), ok: summary.ok, summary })
        .eq("id", run.id);
    }
    revalidate("/", "layout");
  }
  return summary;
}

// Para a página do painel: a conta da MV aparece entre as imobiliárias
// vinculadas a esta integração?
export async function checkImovelwebConnection(): Promise<
  { linked: boolean; agencies: string[] } | { error: string } | null
> {
  const ctx = getContext();
  if (!ctx) return null;
  try {
    const agencies = await ctx.api.listAgencies();
    return {
      linked: agencies.some((a) => a.codigoInmobiliaria === ctx.config.codigoImobiliaria),
      agencies: agencies.map((a) => a.nombre || a.codigoInmobiliaria || "?"),
    };
  } catch (error) {
    return { error: describe(error) };
  }
}

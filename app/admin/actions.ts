"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { makeUniqueSlug } from "@/lib/slug";
import {
  prepareDeletion,
  pushPropertyToImovelweb,
  runImovelwebSync,
  type SyncSummary,
} from "@/lib/imovelweb/sync";

export type ActionState = { error?: string; success?: boolean } | null;

// Envia a alteração ao Imovelweb depois de responder, sem atrasar o painel.
// Sem a integração configurada, não faz nada.
function syncWithImovelweb(propertyId: string) {
  after(() =>
    pushPropertyToImovelweb(propertyId).catch((error) =>
      console.error("[imovelweb]", error instanceof Error ? error.message : error)
    )
  );
}

export async function signIn(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { error: "O Supabase ainda não foi configurado neste projeto." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: "E-mail ou senha inválidos." };
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!admin) {
    await supabase.auth.signOut();
    return { error: "Esta conta não tem acesso ao painel administrativo." };
  }

  redirect("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

const propertySchema = z.object({
  title: z.string().trim().min(3, "Informe um título com pelo menos 3 caracteres."),
  code: z.string().trim().min(1, "Informe o código do imóvel."),
  description: z.string().trim().default(""),
  type: z.enum(["apartamento", "casa", "terreno", "comercial", "outro"]),
  status: z.enum(["disponivel", "vendido"]),
  transaction_type: z.enum(["venda", "aluguel"]),
  city_id: z.string().uuid("Selecione uma cidade."),
  neighborhood_id: z.string().uuid("Selecione um bairro."),
  address: z.string().trim().optional(),
  zip_code: z.string().trim().optional(),
  area_m2: z.coerce.number().positive().optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().int().min(0).optional(),
  parking_spots: z.coerce.number().int().min(0).optional(),
  features: z.string().trim().default(""),
  is_featured: z.coerce.boolean().default(false),
  price: z.coerce.number().positive("O preço deve ser maior que zero.").nullable(),
  publish_imovelweb: z.boolean().default(false),
});

function parsePropertyForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return propertySchema.safeParse({
    ...raw,
    is_featured: formData.get("is_featured") === "on",
    publish_imovelweb: formData.get("publish_imovelweb") === "on",
    // null (e não undefined) para que apagar o preço também limpe o banco.
    price: raw.price || null,
    area_m2: raw.area_m2 || undefined,
    bedrooms: raw.bedrooms || undefined,
    bathrooms: raw.bathrooms || undefined,
    parking_spots: raw.parking_spots || undefined,
    address: raw.address || undefined,
    zip_code: raw.zip_code || undefined,
  });
}

function isMissingTransactionColumn(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
      (error.code === "42703" ||
        error.code === "PGRST204" ||
        error.message?.includes("transaction_type"))
  );
}

function isMissingImovelwebColumns(error: { message?: string } | null) {
  return Boolean(
    error?.message?.includes("publish_imovelweb") || error?.message?.includes("'price'")
  );
}

const MISSING_IMOVELWEB_COLUMNS =
  "Atualize o banco de dados (migration do Imovelweb) antes de usar preço ou publicar no Imovelweb.";

// Banco ainda sem a migration do Imovelweb: se o imóvel não usa esses campos,
// salva sem eles. Devolve null quando há dados que não podem ser descartados.
function withoutUnusedImovelwebFields<T extends { price: number | null; publish_imovelweb: boolean }>(
  row: T
) {
  const { price, publish_imovelweb, ...legacy } = row;
  return price == null && !publish_imovelweb ? legacy : null;
}

export async function createProperty(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parsePropertyForm(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { features, ...rest } = parsed.data;
  const featuresArray = features
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  const slug = `${makeUniqueSlug(rest.title, rest.code)}-${Date.now().toString(36)}`;

  let { data, error } = await supabase
    .from("properties")
    .insert({ ...rest, features: featuresArray, slug })
    .select("id")
    .single();

  const legacyFields = isMissingImovelwebColumns(error) ? withoutUnusedImovelwebFields(rest) : null;
  if (legacyFields) {
    ({ data, error } = await supabase
      .from("properties")
      .insert({ ...legacyFields, features: featuresArray, slug })
      .select("id")
      .single());
  }

  if (isMissingTransactionColumn(error) && rest.transaction_type === "venda") {
    const { transaction_type: _transactionType, ...legacyRest } = rest;
    void _transactionType;
    const retry = await supabase
      .from("properties")
      .insert({ ...legacyRest, features: featuresArray, slug })
      .select("id")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    return {
      error: isMissingImovelwebColumns(error)
        ? MISSING_IMOVELWEB_COLUMNS
        : isMissingTransactionColumn(error)
        ? "Atualize o banco de dados antes de cadastrar um imóvel para aluguel."
        : error.code === "23505"
          ? "Já existe um imóvel com esse código."
          : "Erro ao salvar o imóvel.",
    };
  }

  if (!data) {
    return { error: "Erro ao salvar o imóvel." };
  }

  revalidatePath("/admin/imoveis");
  revalidatePath("/imoveis");
  syncWithImovelweb(data.id);
  redirect(`/admin/imoveis/${data.id}`);
}

export async function updateProperty(
  propertyId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parsePropertyForm(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { features, ...rest } = parsed.data;
  const featuresArray = features
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  let { error } = await supabase
    .from("properties")
    .update({ ...rest, features: featuresArray })
    .eq("id", propertyId);

  const legacyFields = isMissingImovelwebColumns(error) ? withoutUnusedImovelwebFields(rest) : null;
  if (legacyFields) {
    ({ error } = await supabase
      .from("properties")
      .update({ ...legacyFields, features: featuresArray })
      .eq("id", propertyId));
  }

  if (isMissingTransactionColumn(error) && rest.transaction_type === "venda") {
    const { transaction_type: _transactionType, ...legacyRest } = rest;
    void _transactionType;
    const retry = await supabase
      .from("properties")
      .update({ ...legacyRest, features: featuresArray })
      .eq("id", propertyId);
    error = retry.error;
  }

  if (error) {
    return {
      error: isMissingImovelwebColumns(error)
        ? MISSING_IMOVELWEB_COLUMNS
        : isMissingTransactionColumn(error)
        ? "Atualize o banco de dados antes de marcar um imóvel para aluguel."
        : error.code === "23505"
          ? "Já existe um imóvel com esse código."
          : "Erro ao salvar o imóvel.",
    };
  }

  revalidatePath("/admin/imoveis");
  revalidatePath(`/admin/imoveis/${propertyId}`);
  revalidatePath("/imoveis");
  syncWithImovelweb(propertyId);
  return { success: true };
}

export async function setPropertyStatus(propertyId: string, status: "disponivel" | "vendido") {
  const { supabase } = await requireAdmin();
  await supabase.from("properties").update({ status }).eq("id", propertyId);
  revalidatePath("/admin/imoveis");
  revalidatePath("/imoveis");
  syncWithImovelweb(propertyId);
}

export async function deleteProperty(propertyId: string): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  // Publicado no Imovelweb: sai de lá antes de sumir daqui.
  const blocked = await prepareDeletion(propertyId);
  if (blocked) return { error: blocked };
  await supabase.from("properties").delete().eq("id", propertyId);
  revalidatePath("/admin/imoveis");
  revalidatePath("/imoveis");
  return { success: true };
}

export async function addPhotos(
  propertyId: string,
  photos: { url: string; storage_path: string }[]
) {
  const { supabase } = await requireAdmin();

  const { count } = await supabase
    .from("property_photos")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);

  const startPosition = count ?? 0;

  const rows = photos.map((photo, i) => ({
    property_id: propertyId,
    url: photo.url,
    storage_path: photo.storage_path,
    position: startPosition + i,
    is_cover: startPosition === 0 && i === 0,
  }));

  const { error } = await supabase.from("property_photos").insert(rows);
  if (error) throw new Error("Erro ao salvar as fotos.");

  revalidatePath(`/admin/imoveis/${propertyId}`);
  revalidatePath("/imoveis");
  syncWithImovelweb(propertyId);
}

export async function deletePhoto(propertyId: string, photoId: string, storagePath: string) {
  const { supabase } = await requireAdmin();
  await supabase.storage.from("property-photos").remove([storagePath]);
  await supabase.from("property_photos").delete().eq("id", photoId);
  revalidatePath(`/admin/imoveis/${propertyId}`);
  revalidatePath("/imoveis");
  syncWithImovelweb(propertyId);
}

export async function setCoverPhoto(propertyId: string, photoId: string) {
  const { supabase } = await requireAdmin();
  await supabase
    .from("property_photos")
    .update({ is_cover: false })
    .eq("property_id", propertyId);
  await supabase.from("property_photos").update({ is_cover: true }).eq("id", photoId);
  revalidatePath(`/admin/imoveis/${propertyId}`);
  revalidatePath("/imoveis");
  syncWithImovelweb(propertyId);
}

export async function reorderPhoto(propertyId: string, photoId: string, direction: "up" | "down") {
  const { supabase } = await requireAdmin();
  const { data: photos } = await supabase
    .from("property_photos")
    .select("id, position")
    .eq("property_id", propertyId)
    .order("position", { ascending: true });

  if (!photos) return;

  const index = photos.findIndex((p) => p.id === photoId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= photos.length) return;

  const a = photos[index];
  const b = photos[swapWith];

  await supabase.from("property_photos").update({ position: b.position }).eq("id", a.id);
  await supabase.from("property_photos").update({ position: a.position }).eq("id", b.id);

  revalidatePath(`/admin/imoveis/${propertyId}`);
  syncWithImovelweb(propertyId);
}

const citySchema = z.object({ name: z.string().trim().min(2, "Informe o nome da cidade.") });
const neighborhoodSchema = z.object({
  city_id: z.string().uuid("Selecione uma cidade."),
  name: z.string().trim().min(2, "Informe o nome do bairro."),
});

export async function createCity(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = citySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { error } = await supabase.from("cities").insert(parsed.data);
  if (error) {
    return { error: error.code === "23505" ? "Essa cidade já existe." : "Erro ao salvar." };
  }

  revalidatePath("/admin/cidades");
  return { success: true };
}

export async function createNeighborhood(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = neighborhoodSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { error } = await supabase.from("neighborhoods").insert(parsed.data);
  if (error) {
    return { error: error.code === "23505" ? "Esse bairro já existe nessa cidade." : "Erro ao salvar." };
  }

  revalidatePath("/admin/cidades");
  return { success: true };
}

export type SyncState = { summary: SyncSummary } | null;

export async function syncImovelwebNow(): Promise<SyncState> {
  await requireAdmin();
  const summary = await runImovelwebSync("manual");
  revalidatePath("/admin", "layout");
  return { summary };
}

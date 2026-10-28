"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { makeUniqueSlug } from "@/lib/slug";
import { parsePropertyForm } from "@/lib/property-input";
import { assertSafeDatabaseEnvironment } from "@/lib/supabase/environment-guard";

export type ActionState = { error?: string; success?: boolean } | null;

async function requireWritableAdmin() {
  assertSafeDatabaseEnvironment();
  return requireAdmin();
}

export async function signIn(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { error: "O Supabase ainda não foi configurado neste projeto." };
  }

  try {
    assertSafeDatabaseEnvironment();
  } catch {
    return {
      error:
        "Este ambiente de testes ainda precisa de um banco separado da produção.",
    };
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

function isMissingTransactionColumn(
  error: { code?: string; message?: string } | null,
) {
  return Boolean(
    error?.message?.includes("transaction_type") &&
    (error.code === "42703" || error.code === "PGRST204"),
  );
}

function isMissingXmlColumn(error: { code?: string; message?: string } | null) {
  return Boolean(
    (error?.code === "42703" || error?.code === "PGRST204") &&
    /\b(price|publish_imovelweb|covered_area_m2)\b/.test(error.message ?? ""),
  );
}

export async function createProperty(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireWritableAdmin();
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
      error: isMissingXmlColumn(error)
        ? "A configuração do Imovelweb no banco ainda precisa ser concluída."
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
  redirect(`/admin/imoveis/${data.id}`);
}

export async function updateProperty(
  propertyId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireWritableAdmin();
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
      error: isMissingXmlColumn(error)
        ? "A configuração do Imovelweb no banco ainda precisa ser concluída."
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
  return { success: true };
}

export async function setPropertyStatus(
  propertyId: string,
  status: "disponivel" | "vendido",
) {
  const { supabase } = await requireWritableAdmin();
  await supabase.from("properties").update({ status }).eq("id", propertyId);
  revalidatePath("/admin/imoveis");
  revalidatePath("/imoveis");
}

export async function deleteProperty(propertyId: string) {
  const { supabase } = await requireWritableAdmin();
  await supabase.from("properties").delete().eq("id", propertyId);
  revalidatePath("/admin/imoveis");
  revalidatePath("/imoveis");
}

export async function addPhotos(
  propertyId: string,
  photos: { url: string; storage_path: string }[],
) {
  const { supabase } = await requireWritableAdmin();

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
}

export async function deletePhoto(
  propertyId: string,
  photoId: string,
  storagePath: string,
) {
  const { supabase } = await requireWritableAdmin();
  await supabase.storage.from("property-photos").remove([storagePath]);
  await supabase.from("property_photos").delete().eq("id", photoId);
  revalidatePath(`/admin/imoveis/${propertyId}`);
  revalidatePath("/imoveis");
}

export async function setCoverPhoto(propertyId: string, photoId: string) {
  const { supabase } = await requireWritableAdmin();
  await supabase
    .from("property_photos")
    .update({ is_cover: false })
    .eq("property_id", propertyId);
  await supabase
    .from("property_photos")
    .update({ is_cover: true })
    .eq("id", photoId);
  revalidatePath(`/admin/imoveis/${propertyId}`);
  revalidatePath("/imoveis");
}

export async function reorderPhoto(
  propertyId: string,
  photoId: string,
  direction: "up" | "down",
) {
  const { supabase } = await requireWritableAdmin();
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

  await supabase
    .from("property_photos")
    .update({ position: b.position })
    .eq("id", a.id);
  await supabase
    .from("property_photos")
    .update({ position: a.position })
    .eq("id", b.id);

  revalidatePath(`/admin/imoveis/${propertyId}`);
}

const citySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da cidade."),
});
const neighborhoodSchema = z.object({
  city_id: z.string().uuid("Selecione uma cidade."),
  name: z.string().trim().min(2, "Informe o nome do bairro."),
});

export async function createCity(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireWritableAdmin();
  const parsed = citySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { error } = await supabase.from("cities").insert(parsed.data);
  if (error) {
    return {
      error:
        error.code === "23505" ? "Essa cidade já existe." : "Erro ao salvar.",
    };
  }

  revalidatePath("/admin/cidades");
  return { success: true };
}

export async function createNeighborhood(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireWritableAdmin();
  const parsed = neighborhoodSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { error } = await supabase.from("neighborhoods").insert(parsed.data);
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Esse bairro já existe nessa cidade."
          : "Erro ao salvar.",
    };
  }

  revalidatePath("/admin/cidades");
  return { success: true };
}

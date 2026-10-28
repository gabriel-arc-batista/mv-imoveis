import { assertSafeDatabaseEnvironment } from "@/lib/supabase/environment-guard";
import { xmlLength, xmlText } from "./xml";

export type FeedEnvironment = Record<string, string | undefined>;
export type FeedConfig = {
  codigoImobiliaria: string;
  estado: string;
  contato?: { email?: string; nome?: string; telefone?: string };
};

export function getFeedConfigIssues(config: FeedConfig): string[] {
  const issues: string[] = [];
  for (const [label, value] of [
    ["Identificação da imobiliária", config.codigoImobiliaria],
    ["Estado", config.estado],
  ]) {
    const normalized = label === "Estado" ? value.replace(/,/g, " ") : value;
    if (!normalized.trim() || xmlText(value) !== value)
      issues.push(`${label}: preencha um texto válido.`);
  }
  for (const [label, value] of Object.entries(config.contato ?? {})) {
    if (
      value !== undefined &&
      (!value.trim() || xmlLength(value) > 255 || xmlText(value) !== value)
    )
      issues.push(`Contato (${label}): use entre 1 e 255 caracteres válidos.`);
  }
  return issues;
}

export function getFeedSetup(env: FeedEnvironment) {
  const config: FeedConfig = {
    codigoImobiliaria: env.IMOVELWEB_CODIGO_IMOBILIARIA?.trim() ?? "",
    estado: env.IMOVELWEB_ESTADO?.trim() || "Pernambuco",
    contato: {
      email: env.IMOVELWEB_EMAIL_CONTATO?.trim() || undefined,
      nome: env.IMOVELWEB_NOME_CONTATO?.trim() || undefined,
      telefone: env.IMOVELWEB_TELEFONE_CONTATO?.trim() || undefined,
    },
  };
  const token = env.IMOVELWEB_FEED_TOKEN?.trim() ?? "";
  const enabled = env.IMOVELWEB_XML_ENABLED === "true";
  const issues = getFeedConfigIssues(config);
  let blocked = false;
  if (token.length < 32)
    issues.push(
      "Configure uma chave de integração com pelo menos 32 caracteres.",
    );
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim())
    issues.push("Configure a chave pública do Supabase.");
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("URL inválida");
    try {
      assertSafeDatabaseEnvironment(env);
    } catch {
      blocked = true;
    }
  } catch {
    issues.push("Configure uma URL válida para o Supabase.");
  }
  return {
    config,
    token,
    enabled,
    issues,
    blocked,
    ready: enabled && !issues.length && !blocked,
  };
}

/** Usado somente pelo painel autenticado; nunca retorna domínio de produção em preview. */
export function getFeedUrl(env: FeedEnvironment): string | null {
  const setup = getFeedSetup(env);
  if (!setup.ready) return null;
  const previewHost = env.VERCEL_BRANCH_URL || env.VERCEL_URL;
  const origin =
    env.VERCEL_ENV === "preview"
      ? previewHost
        ? `https://${previewHost}`
        : undefined
      : env.NEXT_PUBLIC_SITE_URL ||
        (env.VERCEL_ENV === "production" ? undefined : "http://localhost:3000");
  try {
    const url = new URL("/imovelweb/feed.xml", origin ?? "");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          local &&
          env.VERCEL_ENV !== "production" &&
          env.VERCEL_ENV !== "preview"
        ))
    )
      return null;
    url.searchParams.set("token", setup.token);
    return url.href;
  } catch {
    return null;
  }
}

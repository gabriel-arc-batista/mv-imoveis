import type { ContactConfig } from "./mapping";

// Variáveis de ambiente da integração (todas só no servidor).

const env = (name: string) => process.env[name]?.trim() || undefined;

export const API_ENV = [
  "IMOVELWEB_CLIENT_ID",
  "IMOVELWEB_CLIENT_SECRET",
  "IMOVELWEB_CODIGO_IMOBILIARIA",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
] as const;

export type ApiConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  codigoImobiliaria: string;
  estado: string;
  integrador?: string;
  contato: ContactConfig;
};

export function missingApiEnv(): string[] {
  return API_ENV.filter((name) => !env(name));
}

function contato(): ContactConfig {
  return {
    email: env("IMOVELWEB_EMAIL_CONTATO"),
    nome: env("IMOVELWEB_NOME_CONTATO"),
    telefone: env("IMOVELWEB_TELEFONE_CONTATO"),
  };
}

export function getApiConfig(): ApiConfig | null {
  if (missingApiEnv().length > 0) return null;
  return {
    baseUrl: env("IMOVELWEB_API_URL") ?? "https://api-br-open.navent.com",
    clientId: env("IMOVELWEB_CLIENT_ID")!,
    clientSecret: env("IMOVELWEB_CLIENT_SECRET")!,
    codigoImobiliaria: env("IMOVELWEB_CODIGO_IMOBILIARIA")!,
    estado: env("IMOVELWEB_ESTADO") ?? "Pernambuco",
    integrador: env("IMOVELWEB_INTEGRADOR"),
    contato: contato(),
  };
}

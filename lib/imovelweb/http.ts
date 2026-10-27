import { timingSafeEqual } from "node:crypto";
import { buildImovelwebFeed, type FeedConfig } from "./feed";
import type { Property } from "@/lib/types";
import { assertSafeDatabaseEnvironment } from "@/lib/supabase/environment-guard";

export type FeedEnvironment = Record<string, string | undefined>;
const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

export function createFeedHandler(options: {
  env: FeedEnvironment;
  loadProperties: () => Promise<Property[]>;
}) {
  return async (request: Request): Promise<Response> => {
    const { env } = options;
    const respond = (body: string, status: number, xml = false) =>
      new Response(request.method === "HEAD" ? null : body, {
        status,
        headers: {
          ...HEADERS,
          "Content-Type": xml
            ? "application/xml; charset=utf-8"
            : "text/plain; charset=utf-8",
        },
      });
    const expected = env.IMOVELWEB_FEED_TOKEN?.trim() ?? "";
    const received = new URL(request.url).searchParams.get("token") ?? "";
    if (env.IMOVELWEB_XML_ENABLED !== "true" || expected.length < 32)
      return respond("Not found", 404);
    const a = Buffer.from(received),
      b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b))
      return respond("Not found", 404);
    const config: FeedConfig = {
      codigoImobiliaria: env.IMOVELWEB_CODIGO_IMOBILIARIA?.trim() ?? "",
      estado: env.IMOVELWEB_ESTADO?.trim() || "Pernambuco",
      contato: {
        email: env.IMOVELWEB_EMAIL_CONTATO?.trim(),
        nome: env.IMOVELWEB_NOME_CONTATO?.trim(),
        telefone: env.IMOVELWEB_TELEFONE_CONTATO?.trim(),
      },
    };
    if (
      !config.codigoImobiliaria ||
      !env.NEXT_PUBLIC_SUPABASE_URL ||
      !env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
      return respond("Configuração do XML incompleta", 503);
    if (
      Object.values(config.contato!).some(
        (value) => value && value.length > 255,
      )
    )
      return respond("Configuração do XML inválida", 503);
    try {
      assertSafeDatabaseEnvironment(env);
      const properties = await options.loadProperties();
      return respond(buildImovelwebFeed(properties, config), 200, true);
    } catch {
      // Uma carga parcial ou vazia pode despublicar anúncios; nunca ocultar falhas como XML válido.
      return respond(
        "XML indisponível. Confira os imóveis selecionados e a conexão com o banco.",
        503,
      );
    }
  };
}

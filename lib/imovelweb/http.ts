import { timingSafeEqual } from "node:crypto";
import { buildImovelwebFeed } from "./feed";
import type { Property } from "@/lib/types";
import { getFeedSetup, type FeedEnvironment } from "./config";
import { FeedError, type FeedFailureReason } from "./errors";

export type { FeedEnvironment } from "./config";
const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export function createFeedHandler(options: {
  env: FeedEnvironment;
  loadProperties: () => Promise<Property[]>;
  reportFailure?: (reason: FeedFailureReason) => void;
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
    const setup = getFeedSetup(env);
    const expected = setup.token;
    const received = new URL(request.url).searchParams.get("token") ?? "";
    if (!setup.enabled || expected.length < 32)
      return respond("Not found", 404);
    const a = Buffer.from(received),
      b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b))
      return respond("Not found", 404);
    try {
      if (setup.blocked)
        throw new FeedError("environment_blocked", "Ambiente bloqueado");
      if (setup.issues.length)
        throw new FeedError("configuration_invalid", "Configuração inválida");
      const properties = await options.loadProperties();
      return respond(buildImovelwebFeed(properties, setup.config), 200, true);
    } catch (error) {
      const reason = error instanceof FeedError ? error.reason : "unexpected";
      // Somente categorias conhecidas: nunca registrar URL, token ou erro bruto do banco.
      const report =
        options.reportFailure ??
        ((reason: FeedFailureReason) =>
          console.error("imovelweb_xml_unavailable", { reason }));
      report(reason);
      // Uma carga parcial ou vazia pode despublicar anúncios; nunca ocultar falhas como XML válido.
      return respond(
        "XML indisponível. Confira os imóveis selecionados e a conexão com o banco.",
        503,
      );
    }
  };
}

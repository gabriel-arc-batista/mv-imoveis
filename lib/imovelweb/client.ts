import type { OpenNaventAviso } from "./mapping";

// Cliente da API OpenNavent (Imovelweb Brasil), conforme o Swagger em
// https://api-br-open.navent.com e a seção "API" da documentação oficial.

export class ImovelwebApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
  }
}

export type AvisoResumo = {
  idAvisoNavplat: number;
  codigoAviso?: string | null;
  tipoDeAviso?: string | null;
  titulo?: string | null;
  dataModificacao?: string | number | null;
  fechaModificacion?: string | number | null;
};

type Page<T> = { content?: T[]; number?: number; size?: number; total?: number };

export type ListingResult = {
  idAviso?: number;
  estado?: string;
  error?: boolean;
  errors?: Array<{ messageText?: string }>;
};

type Ubicacion = { id: string; nombre: string; localidades?: Ubicacion[] | null };

const PAGE_SIZE = 100;

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function createImovelwebClient(options: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  codigoImobiliaria: string;
  userAgent?: string;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const agency = encodeURIComponent(options.codigoImobiliaria);
  const userAgent = options.userAgent ?? "MVImoveisSite/1.0";
  let token: { value: string; expiresAt: number } | null = null;
  const locationCache = new Map<string, Promise<Ubicacion[]>>();

  async function call(path: string, init: RequestInit & { query?: Record<string, string> } = {}) {
    const url = new URL(path, options.baseUrl);
    for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);
    try {
      return await fetchImpl(url, {
        ...init,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      // A mensagem original pode conter a URL com as credenciais do login.
      throw new ImovelwebApiError("Não foi possível conectar à API do Imovelweb.");
    }
  }

  async function login() {
    const response = await call("/v1/application/login", {
      method: "POST",
      headers: { "User-Agent": userAgent, Accept: "application/json" },
      query: {
        grant_type: "client_credentials",
        client_id: options.clientId,
        client_secret: options.clientSecret,
      },
    });
    if (!response.ok) {
      throw new ImovelwebApiError(
        `Login no Imovelweb recusado (HTTP ${response.status}). Confira IMOVELWEB_CLIENT_ID e IMOVELWEB_CLIENT_SECRET.`,
        response.status
      );
    }
    const body = (await response.json()) as Record<string, unknown>;
    // A documentação mostra access_token/expires_in; o modelo do Swagger, value/expiresIn.
    const value = body.access_token ?? body.value;
    const expiresIn = Number(body.expires_in ?? body.expiresIn ?? 3600);
    if (typeof value !== "string" || !value) {
      throw new ImovelwebApiError("O login no Imovelweb não devolveu um token.");
    }
    const ttl = Math.min(Number.isFinite(expiresIn) ? expiresIn : 3600, 6 * 3600);
    token = { value, expiresAt: Date.now() + (ttl - 60) * 1000 };
  }

  async function request<T>(
    method: string,
    path: string,
    { query, body }: { query?: Record<string, string>; body?: unknown } = {},
    retried = false
  ): Promise<T | null> {
    if (!token || token.expiresAt < Date.now()) await login();
    const response = await call(path, {
      method,
      query,
      headers: {
        Authorization: `Bearer ${token!.value}`,
        Accept: "application/json",
        "User-Agent": userAgent,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 401 && !retried) {
      token = null;
      return request<T>(method, path, { query, body }, true);
    }
    if (response.status === 204) return null;
    if (!response.ok) {
      throw new ImovelwebApiError(
        `Imovelweb respondeu HTTP ${response.status} em ${method} ${path.replace(agency, "{imobiliaria}")}.`,
        response.status
      );
    }
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : null;
  }

  async function children(id?: string): Promise<Ubicacion[]> {
    const key = id ?? "";
    if (!locationCache.has(key)) {
      const promise = id
        ? request<Ubicacion>("GET", `/v1/locais/${encodeURIComponent(id)}`).then((u) => u?.localidades ?? [])
        : request<Ubicacion[]>("GET", "/v1/locais").then((list) => list ?? []);
      locationCache.set(key, promise);
    }
    return locationCache.get(key)!;
  }

  return {
    async listAgencies() {
      const page = await request<Page<{ codigoInmobiliaria?: string; nombre?: string }>>(
        "GET",
        "/v1/imobiliarias",
        { query: { "pageable.size": String(PAGE_SIZE), "pageable.page": "0" } }
      );
      return page?.content ?? [];
    },

    // Todos os anúncios online da imobiliária, página a página.
    async listOnlineListings(): Promise<AvisoResumo[]> {
      const all: AvisoResumo[] = [];
      for (let page = 0; page < 100; page++) {
        const result = await request<Page<AvisoResumo>>(
          "GET",
          `/v1/imobiliarias/${agency}/anuncios/online/resumo`,
          { query: { "pageable.size": String(PAGE_SIZE), "pageable.page": String(page) } }
        );
        const content = result?.content ?? [];
        all.push(...content);
        const total = result?.total ?? 0;
        if (content.length < PAGE_SIZE || all.length >= total) break;
      }
      return all;
    },

    getListing(codigoAnuncio: string) {
      return request<OpenNaventAviso>(
        "GET",
        `/v1/imobiliarias/${agency}/anuncios/${encodeURIComponent(codigoAnuncio)}`
      );
    },

    // Dá um código nosso a um anúncio criado direto no portal.
    associate(codigoAnuncio: string, idAvisoNavplat: number) {
      return request<unknown>(
        "PUT",
        `/v1/imobiliarias/${agency}/anuncios/${encodeURIComponent(codigoAnuncio)}/asociar/${idAvisoNavplat}`
      );
    },

    upsertListing(codigoAnuncio: string, aviso: unknown) {
      return request<ListingResult>(
        "PUT",
        `/v1/imobiliarias/${agency}/anuncios/${encodeURIComponent(codigoAnuncio)}`,
        { body: aviso }
      );
    },

    async removeListing(codigoAnuncio: string) {
      try {
        const result = await request<ListingResult | ListingResult[]>(
          "DELETE",
          `/v1/imobiliarias/${agency}/anuncios/${encodeURIComponent(codigoAnuncio)}`
        );
        return Array.isArray(result) ? result[0] ?? null : result;
      } catch (error) {
        // Anúncio que já não existe no portal: nada a remover.
        if (error instanceof ImovelwebApiError && error.status === 404) return null;
        throw error;
      }
    },

    // Estado → cidade → bairro, pelo nome. Devolve o nível mais fundo
    // encontrado, desde que seja pelo menos a cidade (o portal não publica
    // com localização no nível do estado).
    async resolveLocationId(estado: string, cidade: string, bairro?: string) {
      const find = (list: Ubicacion[], name: string) =>
        list.find((item) => normalize(item.nombre) === normalize(name));
      const state = find(await children(), estado);
      if (!state) return undefined;
      const city = find(await children(state.id), cidade);
      if (!city) return undefined;
      if (!bairro) return city.id;
      return find(await children(city.id), bairro)?.id ?? city.id;
    },
  };
}

export type ImovelwebClient = ReturnType<typeof createImovelwebClient>;

export function listingErrors(result: ListingResult | null): string | null {
  if (!result?.error) return null;
  const messages = (result.errors ?? []).map((e) => e.messageText).filter(Boolean);
  return messages.join(" | ") || "O Imovelweb recusou o anúncio.";
}

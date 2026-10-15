import type { Property, PropertyTransaction, PropertyType } from "@/lib/types";

// Conversão entre o imóvel do site e o anúncio da API OpenNavent do
// Imovelweb. Documentação: https://open-classifieds.notion.site/bra
// Os IDs abaixo aparecem no exemplo oficial de anúncio da API
// ("2.5 Gestão de anúncios") e no catálogo /v1/tipopropriedade.

export const PROPERTY_TYPES: Record<
  Exclude<PropertyType, "outro">,
  { idTipo: string; idSubTipo: string; tipo: string }
> = {
  casa: { idTipo: "1", idSubTipo: "5", tipo: "Casa" },
  apartamento: { idTipo: "2", idSubTipo: "1", tipo: "Apartamento" },
  terreno: { idTipo: "1003", idSubTipo: "8", tipo: "Terreno" },
  comercial: { idTipo: "1005", idSubTipo: "16", tipo: "Comercial" },
};

export const FEATURE_IDS = {
  quartos: "CFT2",
  banheiros: "CFT3",
  vagas: "CFT7",
  areaTotal: "CFT100",
  areaUtil: "CFT101",
} as const;

export const OPERATION: Record<PropertyTransaction, "VENTA" | "ALQUILER"> = {
  venda: "VENTA",
  aluguel: "ALQUILER",
};

// O site aceita até 20 fotos por imóvel; o Imovelweb, até 50.
export const MAX_IMPORTED_PHOTOS = 20;

export type ContactConfig = { email?: string; nome?: string; telefone?: string };

export function getImovelwebIssues(property: Property): string[] {
  const issues: string[] = [];
  if (property.source === "imovelweb") issues.push("Importado do Imovelweb");
  if (!property.publish_imovelweb) issues.push("Não marcado para o Imovelweb");
  if (property.status !== "disponivel") issues.push("Imóvel vendido");
  if (property.type === "outro") issues.push("Tipo \"Outro\" não existe no Imovelweb");
  if (!property.price || property.price <= 0) issues.push("Sem preço");
  if (!property.photos?.length) issues.push("Sem fotos");
  if (!property.description.trim()) issues.push("Sem descrição");
  if (!property.city?.name) issues.push("Sem cidade");
  return issues;
}

export function isPublishable(property: Property): boolean {
  return getImovelwebIssues(property).length === 0;
}

// Fora de 10 a 100 caracteres o portal recusa o título; sem título, ele monta um.
export function listingTitle(title: string): string | undefined {
  const trimmed = title.trim();
  return trimmed.length >= 10 ? trimmed.slice(0, 100) : undefined;
}

export function listingFeatures(property: Property): Array<{ id: string; valor: string }> {
  const features: Array<{ id: string; valor: string }> = [];
  const add = (id: string, value: number | null) => {
    if (value != null) features.push({ id, valor: String(Math.round(Number(value))) });
  };
  add(FEATURE_IDS.quartos, property.bedrooms);
  add(FEATURE_IDS.banheiros, property.bathrooms);
  add(FEATURE_IDS.vagas, property.parking_spots);
  add(FEATURE_IDS.areaTotal, property.area_m2);
  if (property.type !== "terreno") add(FEATURE_IDS.areaUtil, property.area_m2);
  return features;
}

// Capa primeiro, depois a ordem definida no painel.
export function orderedPhotoUrls(property: Property): string[] {
  return [...(property.photos ?? [])]
    .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.position - b.position)
    .map((photo) => photo.url);
}

export function locationParts(property: Property, estado: string): string[] {
  return [property.neighborhood?.name, property.city?.name, estado, "Brasil"]
    .filter((part): part is string => Boolean(part?.trim()))
    // A vírgula separa os níveis da localidade, então não pode aparecer nos nomes.
    .map((part) => part.replace(/,/g, " ").trim());
}

// Corpo do PUT /v1/imobiliarias/{codigo}/anuncios/{codigoAnuncio}.
export function toAviso(
  property: Property,
  options: { codigoImobiliaria: string; estado: string; idUbicacion?: string; contato?: ContactConfig }
) {
  const type = PROPERTY_TYPES[property.type as Exclude<PropertyType, "outro">];
  const zipCode = property.zip_code?.replace(/\D/g, "");
  return {
    // O id não muda quando o código é editado no painel; um codigoAviso novo
    // faria o portal criar outro anúncio.
    codigoAviso: property.id,
    claveReferencia: property.code,
    titulo: listingTitle(property.title),
    descripcion: property.description.trim(),
    tipoDePropiedad: { idTipo: type.idTipo, idSubTipo: type.idSubTipo },
    caracteristicas: listingFeatures(property),
    precios: [
      {
        monto: String(Math.round(Number(property.price))),
        moneda: "BRL",
        operacion: OPERATION[property.transaction_type ?? "venda"],
      },
    ],
    multimedia: {
      imagenes: orderedPhotoUrls(property)
        .slice(0, 50)
        .map((url) => ({ urlImagenOriginal: url })),
    },
    localizacion: {
      idUbicacion: options.idUbicacion,
      ubicacion: locationParts(property, options.estado).join(", "),
      direccion: property.address?.trim() || undefined,
      codigoPostal: zipCode || undefined,
      muestraMapa: "APROXIMADO",
    },
    publicador: {
      codigoInmobiliaria: options.codigoImobiliaria,
      emailDeContacto: options.contato?.email || undefined,
      nombreDeContacto: options.contato?.nome || undefined,
      telefonoDeContacto: options.contato?.telefone || undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Imovelweb → site

export type OpenNaventAviso = {
  codigoAviso?: string | null;
  claveReferencia?: string | null;
  titulo?: string | null;
  descripcion?: string | null;
  tipoDePropiedad?: { idTipo?: string | null; tipo?: string | null } | null;
  caracteristicas?: Array<{ id?: string | null; nombre?: string | null; valor?: string | null }> | null;
  precios?: Array<{ monto?: string | number | null; moneda?: string | null; operacion?: string | null }> | null;
  multimedia?: {
    imagenes?: Array<{ urlImagenPortal?: string | null; urlImagenOriginal?: string | null }> | null;
  } | null;
  localizacion?: {
    ubicacion?: string | null;
    direccion?: string | null;
    codigoPostal?: string | null;
  } | null;
};

export type ImportedListing = {
  title: string;
  description: string;
  type: PropertyType;
  transaction_type: PropertyTransaction;
  price: number | null;
  reference: string | null;
  address: string | null;
  zip_code: string | null;
  area_m2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  cityName: string;
  neighborhoodName: string;
  photoUrls: string[];
};

export const UNKNOWN_NEIGHBORHOOD = "Não informado";

const TYPE_BY_ID: Record<string, PropertyType> = Object.fromEntries(
  Object.entries(PROPERTY_TYPES).map(([type, { idTipo }]) => [idTipo, type as PropertyType])
);

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function fromAviso(aviso: OpenNaventAviso, idAviso: number): ImportedListing {
  const features = new Map(
    (aviso.caracteristicas ?? []).map((c) => [c.id ?? "", toNumber(c.valor)])
  );
  const integer = (id: string) => {
    const value = features.get(id);
    return value == null || value < 0 ? null : Math.round(value);
  };
  const area = features.get(FEATURE_IDS.areaUtil) ?? features.get(FEATURE_IDS.areaTotal) ?? null;

  const prices = aviso.precios ?? [];
  const sale = prices.find((p) => p.operacion?.toUpperCase() === "VENTA");
  const rent = prices.find((p) => p.operacion?.toUpperCase() === "ALQUILER");
  const chosen = sale ?? rent;
  const price = toNumber(chosen?.monto);

  // "Bairro, Cidade, Estado, Brasil" ou "Cidade, Estado, Brasil".
  const location = (aviso.localizacion?.ubicacion ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const [neighborhoodName, cityName] =
    location.length >= 4
      ? [location[0], location[1]]
      : [UNKNOWN_NEIGHBORHOOD, location[0] ?? "Não informado"];

  const photoUrls = (aviso.multimedia?.imagenes ?? [])
    .map((image) => image.urlImagenPortal || image.urlImagenOriginal || "")
    .filter((url) => /^https:\/\//.test(url))
    .slice(0, MAX_IMPORTED_PHOTOS);

  return {
    title: aviso.titulo?.trim() || `Imóvel ${idAviso}`,
    description: aviso.descripcion?.trim() ?? "",
    type: TYPE_BY_ID[aviso.tipoDePropiedad?.idTipo ?? ""] ?? "outro",
    transaction_type: sale || !rent ? "venda" : "aluguel",
    price: price != null && price > 0 ? price : null,
    reference: aviso.claveReferencia?.trim() || null,
    address: aviso.localizacion?.direccion?.trim() || null,
    zip_code: aviso.localizacion?.codigoPostal?.trim() || null,
    area_m2: area != null && area > 0 ? area : null,
    bedrooms: integer(FEATURE_IDS.quartos),
    bathrooms: integer(FEATURE_IDS.banheiros),
    parking_spots: integer(FEATURE_IDS.vagas),
    cityName,
    neighborhoodName,
    photoUrls,
  };
}

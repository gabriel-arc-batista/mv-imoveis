import type { Property } from "@/lib/types";
import { getFeedConfigIssues, type FeedConfig } from "./config";
import { FeedError } from "./errors";
import { xmlText, xmlLength, xmlTag as tag } from "./xml";
export type { FeedConfig } from "./config";

// Open BR: tipos/subtipos devem ser conferidos no catálogo do portal na homologação.
const TYPES = {
  apartamento: { id: "2", subtype: "1", name: "Apartamento" },
  casa: { id: "1", subtype: "5", name: "Casa" },
  terreno: { id: "1003", subtype: "8", name: "Terreno" },
  comercial: { id: "1005", subtype: "16", name: "Comercial" },
} as const;

const validNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

function publicPhoto(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
    return (
      url === url.trim() &&
      xmlText(url) === url &&
      !Array.from(url).some(
        (char) => char.codePointAt(0)! <= 32 || char.codePointAt(0) === 127,
      ) &&
      parsed.protocol === "https:" &&
      !url.includes("#") &&
      !parsed.username &&
      !parsed.password &&
      !host.includes(":") &&
      !/^\d+(?:\.\d+){3}$/.test(host) &&
      host.includes(".") &&
      !host.endsWith(".localhost") &&
      !host.endsWith(".local") &&
      !host.endsWith(".internal")
    );
  } catch {
    return false;
  }
}

export function getImovelwebIssues(property: Property): string[] {
  const issues: string[] = [];
  const title = xmlText(property.title).trim();
  const description = xmlText(property.description).trim();
  if (
    !property.id?.trim() ||
    xmlLength(property.id) > 100 ||
    xmlText(property.id) !== property.id
  )
    issues.push("Identificador inválido");
  if (
    !property.code.trim() ||
    xmlLength(property.code) > 99 ||
    xmlText(property.code) !== property.code
  )
    issues.push("Código deve ter até 99 caracteres");
  if (xmlLength(title) < 10 || xmlLength(title) > 80)
    issues.push("Título deve ter entre 10 e 80 caracteres");
  if (xmlLength(description) < 50 || xmlLength(description) > 10000)
    issues.push("Descrição deve ter entre 50 e 10.000 caracteres");
  if (!Object.hasOwn(TYPES, property.type))
    issues.push("Tipo de imóvel não suportado no XML");
  if (
    !Number.isSafeInteger(property.price) ||
    Number(property.price) <= 0 ||
    Number(property.price) > 999999999999
  ) {
    issues.push("Informe um preço positivo em reais inteiros");
  }
  if (!["venda", "aluguel"].includes(property.transaction_type ?? "venda"))
    issues.push("Finalidade inválida");
  if (property.status !== "disponivel") issues.push("Imóvel vendido");
  if (
    !xmlText(property.city?.name ?? "")
      .replace(/,/g, " ")
      .trim() ||
    property.city?.id !== property.city_id
  )
    issues.push("Cidade inválida");
  if (
    !xmlText(property.neighborhood?.name ?? "")
      .replace(/,/g, " ")
      .trim() ||
    property.neighborhood?.id !== property.neighborhood_id ||
    property.neighborhood?.city_id !== property.city_id
  )
    issues.push("Bairro não corresponde à cidade");
  const address = xmlText(property.address ?? "").trim();
  if (!address || xmlLength(address) > 200)
    issues.push("Informe endereço com até 200 caracteres");
  if (!/^\d{8}$/.test(property.zip_code?.replace(/\D/g, "") ?? ""))
    issues.push("Informe CEP com 8 dígitos");
  if (!validNumber(property.area_m2) || Number(property.area_m2) <= 0)
    issues.push("Informe área total maior que zero");
  if (property.type !== "terreno") {
    if (
      !validNumber(property.covered_area_m2) ||
      Number(property.covered_area_m2) <= 0
    )
      issues.push(
        "Informe a área construída/coberta confirmada, maior que zero",
      );
  }
  for (const [name, value] of [
    ["Quartos", property.bedrooms],
    ["Banheiros", property.bathrooms],
    ["Vagas", property.parking_spots],
  ] as const) {
    if (
      value !== null &&
      value !== undefined &&
      (!validNumber(value) || !Number.isInteger(value))
    )
      issues.push(`${name}: informe um número inteiro não negativo`);
  }
  const photos = property.photos ?? [];
  if (photos.length < 5 || photos.length > 50)
    issues.push("Envie entre 5 e 50 fotos");
  if (
    photos.some((photo) => !publicPhoto(photo.url)) ||
    new Set(photos.map((p) => new URL(p.url).href)).size !== photos.length
  )
    issues.push("Fotos precisam de URLs públicas HTTPS distintas");
  return issues;
}

function renderProperty(property: Property, config: FeedConfig): string {
  const type = TYPES[property.type as keyof typeof TYPES];
  const characteristics: [string, number | null][] = [
    ["CFT2", property.bedrooms],
    ["CFT3", property.bathrooms],
    ["CFT7", property.parking_spots],
    ["CFT100", property.area_m2],
  ];
  if (property.type !== "terreno")
    characteristics.push(["CFT101", property.covered_area_m2!]);
  const features = characteristics
    .filter(([, value]) => value != null)
    .map(
      ([id, value]) =>
        `<caracteristica>${tag("id", id)}${tag("valor", value!)}</caracteristica>`,
    )
    .join("");
  const photos = [...property.photos!].sort(
    (a, b) =>
      Number(b.is_cover) - Number(a.is_cover) ||
      a.position - b.position ||
      a.id.localeCompare(b.id),
  );
  const location = [
    property.neighborhood!.name,
    property.city!.name,
    config.estado,
    "Brasil",
  ]
    .map((part) => part.replace(/,/g, " ").trim())
    .join(",");
  const contact = config.contato;
  return `<Imovel>
${tag("codigoAnuncio", property.id)}${tag("codigoReferencia", property.code)}
${tag("titulo", property.title.trim())}${tag("descricao", property.description.trim())}
<tipoPropriedade>${tag("idTipo", type.id)}${tag("idSubTipo", type.subtype)}${tag("tipo", type.name)}</tipoPropriedade>
<caracteristicas>${features}</caracteristicas>
<precos><preco>${tag("quantidade", property.price!)}${tag("moeda", "BRL")}${tag("operacao", property.transaction_type === "aluguel" ? "ALQUILER" : "VENTA")}</preco></precos>
<multimidia><imagens>${photos.map((photo) => `<imagem>${tag("urlImagem", photo.url)}</imagem>`).join("")}</imagens></multimidia>
<localizacao>${tag("endereco", property.address!.trim())}${tag("localidade", location)}${tag("codigoPostal", property.zip_code!.replace(/\D/g, ""))}${tag("mostrarMapa", "APROXIMADO")}</localizacao>
<publicacao>${tag("tipoPublicacao", "SIMPLE")}</publicacao>
<publicador>${tag("codigoImobiliaria", config.codigoImobiliaria)}${contact?.email ? tag("emailContato", contact.email) : ""}${contact?.nome ? tag("nomeContato", contact.nome) : ""}${contact?.telefone ? tag("telefoneContato", contact.telefone) : ""}</publicador>
</Imovel>`;
}

export function buildImovelwebFeed(
  properties: Property[],
  config: FeedConfig,
  generatedAt = Date.now(),
): string {
  if (
    getFeedConfigIssues(config).length ||
    !Number.isSafeInteger(generatedAt) ||
    generatedAt <= 0
  )
    throw new FeedError("configuration_invalid", "Configuração inválida");
  const selected = properties.filter(
    (p) => p.publish_imovelweb && p.status === "disponivel",
  );
  if (!selected.length)
    throw new FeedError(
      "catalog_empty",
      "Nenhum imóvel: carga vazia bloqueada",
    );
  if (new Set(selected.map((p) => p.id)).size !== selected.length)
    throw new FeedError("identifier_duplicate", "Identificador duplicado");
  for (const property of selected) {
    const issues = getImovelwebIssues(property);
    if (issues.length)
      throw new FeedError(
        "property_invalid",
        `Imóvel incompleto: ${issues.join("; ")}`,
      );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<OpenNavent>\n${tag("dataModificacao", generatedAt)}\n<Imoveis>\n${selected
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => renderProperty(p, config))
    .join("\n")}\n</Imoveis>\n</OpenNavent>\n`;
}

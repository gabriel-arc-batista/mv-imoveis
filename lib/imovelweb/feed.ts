import type { Property, PropertyType } from "@/lib/types";
import {
  OPERATION,
  PROPERTY_TYPES,
  isPublishable,
  listingFeatures,
  listingTitle,
  locationParts,
  orderedPhotoUrls,
  type ContactConfig,
} from "./mapping";

// Feed XML no formato OpenNavent, alternativa à API para quem só publica do
// site para o Imovelweb. O portal cria e atualiza os anúncios presentes no
// arquivo e tira do ar os que deixarem de aparecer nele.

export type FeedConfig = {
  codigoImobiliaria: string;
  estado: string;
  contato?: ContactConfig;
};

function cdata(value: string | number): string {
  const text = String(value)
    // Caracteres de controle são inválidos em XML 1.0.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/]]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[${text}]]>`;
}

function tag(name: string, value: string | number, indent: string): string {
  return `${indent}<${name}>${cdata(value)}</${name}>`;
}

function buildImovel(property: Property, config: FeedConfig): string {
  const type = PROPERTY_TYPES[property.type as Exclude<PropertyType, "outro">];
  const i3 = "      ";
  const i4 = "        ";
  const i5 = "          ";
  const lines: string[] = ["    <Imovel>"];

  lines.push(tag("codigoAnuncio", property.id, i3));
  lines.push(tag("codigoReferencia", property.code, i3));

  lines.push(`${i3}<tipoPropriedade>`);
  lines.push(tag("idTipo", type.idTipo, i4));
  lines.push(tag("idSubTipo", type.idSubTipo, i4));
  lines.push(tag("tipo", type.tipo, i4));
  lines.push(`${i3}</tipoPropriedade>`);

  const title = listingTitle(property.title);
  if (title) lines.push(tag("titulo", title, i3));
  lines.push(tag("descricao", property.description.trim(), i3));

  lines.push(`${i3}<precos>`);
  lines.push(`${i4}<preco>`);
  lines.push(tag("quantidade", Math.round(Number(property.price)), i5));
  lines.push(tag("moeda", "BRL", i5));
  lines.push(tag("operacao", OPERATION[property.transaction_type ?? "venda"], i5));
  lines.push(`${i4}</preco>`);
  lines.push(`${i3}</precos>`);

  const features = listingFeatures(property);
  if (features.length > 0) {
    lines.push(`${i3}<caracteristicas>`);
    for (const feature of features) {
      lines.push(`${i4}<caracteristica>`);
      lines.push(tag("id", feature.id, i5));
      lines.push(tag("valor", feature.valor, i5));
      lines.push(`${i4}</caracteristica>`);
    }
    lines.push(`${i3}</caracteristicas>`);
  }

  lines.push(`${i3}<multimidia>`);
  lines.push(`${i4}<imagens>`);
  for (const url of orderedPhotoUrls(property).slice(0, 50)) {
    lines.push(`${i5}<imagem>${tag("urlImagem", url, "")}</imagem>`);
  }
  lines.push(`${i4}</imagens>`);
  lines.push(`${i3}</multimidia>`);

  const zipCode = property.zip_code?.replace(/\D/g, "");
  lines.push(`${i3}<localizacao>`);
  if (property.address?.trim()) lines.push(tag("endereco", property.address.trim(), i4));
  lines.push(tag("localidade", locationParts(property, config.estado).join(","), i4));
  if (zipCode) lines.push(tag("codigoPostal", zipCode, i4));
  lines.push(tag("mostrarMapa", "APROXIMADO", i4));
  lines.push(`${i3}</localizacao>`);

  lines.push(`${i3}<publicador>`);
  lines.push(tag("codigoImobiliaria", config.codigoImobiliaria, i4));
  if (config.contato?.email) lines.push(tag("emailContato", config.contato.email, i4));
  if (config.contato?.nome) lines.push(tag("nomeContato", config.contato.nome, i4));
  if (config.contato?.telefone) lines.push(tag("telefoneContato", config.contato.telefone, i4));
  lines.push(`${i3}</publicador>`);

  lines.push("    </Imovel>");
  return lines.join("\n");
}

export function buildImovelwebFeed(
  properties: Property[],
  config: FeedConfig,
  generatedAt: number = Date.now()
): { xml: string; included: Property[] } {
  const included = properties.filter(isPublishable);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<OpenNavent>",
    // Data de geração em ms: o portal ignora o arquivo para anúncios
    // alterados pela API depois desse momento.
    tag("dataModificacao", generatedAt, "  "),
    "  <Imoveis>",
    ...included.map((p) => buildImovel(p, config)),
    "  </Imoveis>",
    "</OpenNavent>",
    "",
  ].join("\n");
  return { xml, included };
}

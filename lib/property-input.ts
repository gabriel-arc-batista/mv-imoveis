import { z } from "zod";

const propertySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Informe um título com pelo menos 3 caracteres."),
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
    covered_area_m2: z.coerce
      .number()
      .positive("Informe uma área construída maior que zero.")
      .nullable(),
    bedrooms: z.coerce.number().int().min(0).optional(),
    bathrooms: z.coerce.number().int().min(0).optional(),
    parking_spots: z.coerce.number().int().min(0).optional(),
    features: z.string().trim().default(""),
    is_featured: z.boolean(),
    price: z.coerce
      .number()
      .int("O preço para o Imovelweb deve estar em reais inteiros.")
      .positive("Informe um preço maior que zero.")
      .max(999999999999)
      .nullable(),
    publish_imovelweb: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.publish_imovelweb && data.price === null)
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "Informe o preço para incluir o imóvel no XML.",
      });
    if (
      data.publish_imovelweb &&
      !/^\d{5}-?\d{3}$/.test(data.zip_code ?? "")
    )
      ctx.addIssue({
        code: "custom",
        path: ["zip_code"],
        message: "Informe CEP válido com 8 dígitos para publicar no Imovelweb.",
      });
    if (!data.publish_imovelweb) return;
    if (data.type === "outro")
      ctx.addIssue({
        code: "custom",
        path: ["type"],
        message: "Selecione um tipo de imóvel aceito pelo Imovelweb.",
      });
    if (Array.from(data.title).length > 80)
      ctx.addIssue({
        code: "custom",
        path: ["title"],
        message: "O título do Imovelweb deve ter até 80 caracteres.",
      });
    if (Array.from(data.code).length > 99)
      ctx.addIssue({
        code: "custom",
        path: ["code"],
        message: "O código de referência deve ter até 99 caracteres.",
      });
    if (Array.from(data.description).length < 50 || Array.from(data.description).length > 10000)
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: "A descrição do Imovelweb deve ter entre 50 e 10.000 caracteres.",
      });
    if (!data.address || Array.from(data.address).length > 200)
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "Informe o endereço com até 200 caracteres para o Imovelweb.",
      });
    if (data.area_m2 === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["area_m2"],
        message: "Informe a área total do imóvel para o Imovelweb.",
      });
  });

export function parsePropertyForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return propertySchema.safeParse({
    ...raw,
    is_featured: formData.get("is_featured") === "on",
    publish_imovelweb: formData.get("publish_imovelweb") === "on",
    price: raw.price || null,
    area_m2: raw.area_m2 || undefined,
    covered_area_m2: raw.covered_area_m2 || null,
    bedrooms: raw.bedrooms || undefined,
    bathrooms: raw.bathrooms || undefined,
    parking_spots: raw.parking_spots || undefined,
    address: raw.address || undefined,
    zip_code: raw.zip_code || undefined,
  });
}

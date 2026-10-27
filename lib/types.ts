export type PropertyType =
  "apartamento" | "casa" | "terreno" | "comercial" | "outro";

export type PropertyStatus = "disponivel" | "vendido";
export type PropertyTransaction = "venda" | "aluguel";

export type City = {
  id: string;
  name: string;
};

export type Neighborhood = {
  id: string;
  city_id: string;
  name: string;
};

export type PropertyPhoto = {
  id: string;
  property_id: string;
  url: string;
  storage_path: string;
  position: number;
  is_cover: boolean;
};

export type Property = {
  id: string;
  code: string;
  slug: string;
  title: string;
  description: string;
  type: PropertyType;
  status: PropertyStatus;
  transaction_type?: PropertyTransaction;
  city_id: string;
  neighborhood_id: string;
  address: string | null;
  zip_code: string | null;
  area_m2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  features: string[];
  is_featured: boolean;
  price?: number | null;
  publish_imovelweb?: boolean;
  created_at: string;
  updated_at: string;
  city?: City;
  neighborhood?: Neighborhood;
  photos?: PropertyPhoto[];
};

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  terreno: "Terreno",
  comercial: "Comercial",
  outro: "Outro",
};

export const PROPERTY_TRANSACTION_LABEL: Record<PropertyTransaction, string> = {
  venda: "À venda",
  aluguel: "Para alugar",
};

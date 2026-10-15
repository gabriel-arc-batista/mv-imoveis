export type PropertyType =
  | "apartamento"
  | "casa"
  | "terreno"
  | "comercial"
  | "outro";

export type PropertyStatus = "disponivel" | "vendido";
export type PropertyTransaction = "venda" | "aluguel";
export type PropertySource = "site" | "imovelweb";

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
  source_url?: string | null;
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
  source?: PropertySource;
  imovelweb_id?: number | null;
  imovelweb_modified_at?: string | null;
  imovelweb_published_at?: string | null;
  imovelweb_hash?: string | null;
  imovelweb_offline_at?: string | null;
  imovelweb_error?: string | null;
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

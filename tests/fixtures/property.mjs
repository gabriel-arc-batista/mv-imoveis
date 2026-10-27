export const property = (overrides = {}) => ({
  id: "3d36e7b9-a741-4d3b-b11c-9e3e0d29b082",
  code: "MV-TESTE",
  slug: "imovel-teste",
  title: "Apartamento com varanda em Piedade",
  description:
    "Apartamento bem localizado, com varanda, ventilação natural e acesso próximo à praia.",
  type: "apartamento",
  status: "disponivel",
  transaction_type: "venda",
  city_id: "city-1",
  neighborhood_id: "neighborhood-1",
  address: "Rua de Teste, 123",
  zip_code: "54400-000",
  area_m2: 85.6,
  bedrooms: 3,
  bathrooms: 2,
  parking_spots: 0,
  features: ["Varanda"],
  is_featured: true,
  price: 3500,
  publish_imovelweb: true,
  created_at: "2026-10-27T12:00:00.000Z",
  updated_at: "2026-10-27T12:00:00.000Z",
  city: { id: "city-1", name: "Jaboatão dos Guararapes" },
  neighborhood: { id: "neighborhood-1", city_id: "city-1", name: "Piedade" },
  photos: Array.from({ length: 5 }, (_, position) => ({
    id: `photo-${position}`,
    property_id: "3d36e7b9-a741-4d3b-b11c-9e3e0d29b082",
    url: `https://example.supabase.co/storage/v1/object/public/property-photos/test/${position}.jpg`,
    storage_path: `test/${position}.jpg`,
    position,
    is_cover: position === 2,
  })),
  ...overrides,
});

export const feedConfig = {
  codigoImobiliaria: "mv-test",
  estado: "Pernambuco",
};
export const feedEnv = {
  IMOVELWEB_XML_ENABLED: "true",
  IMOVELWEB_FEED_TOKEN: "a".repeat(48),
  IMOVELWEB_CODIGO_IMOBILIARIA: "mv-test",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key",
};

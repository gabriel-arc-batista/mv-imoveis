-- XML é opt-in: anúncios existentes permanecem fora da carga.
-- Não aplicar na produção durante o desenvolvimento; testar em banco isolado.
alter table public.properties
  add column price numeric,
  add column publish_imovelweb boolean not null default false,
  add constraint properties_imovelweb_price_check
    check (price is null or (price > 0 and price <= 999999999999 and price = trunc(price))),
  add constraint properties_imovelweb_selected_price_check
    check (not publish_imovelweb or price is not null);

comment on column public.properties.price is
  'Preço em BRL inteiro para XML Imovelweb; não é exibido na vitrine.';
comment on column public.properties.publish_imovelweb is
  'Inclusão explícita no feed XML. Somente imóveis disponíveis e completos são exportados.';

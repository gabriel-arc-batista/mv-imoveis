-- MV Imóveis — schema inicial
-- Rodar no SQL Editor do projeto Supabase (Project > SQL Editor > New query).

create extension if not exists "pgcrypto";

create type public.property_type as enum ('apartamento','casa','terreno','comercial','outro');
create type public.property_status as enum ('disponivel','vendido');
create type public.property_transaction as enum ('venda','aluguel');

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.neighborhoods (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (city_id, name)
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  slug text not null unique,
  title text not null,
  description text not null default '',
  type public.property_type not null,
  status public.property_status not null default 'disponivel',
  transaction_type public.property_transaction not null default 'venda',
  city_id uuid not null references public.cities(id),
  neighborhood_id uuid not null references public.neighborhoods(id),
  address text,
  zip_code text,
  area_m2 numeric,
  bedrooms int,
  bathrooms int,
  parking_spots int,
  features text[] not null default '{}',
  is_featured boolean not null default false,
  price numeric,
  publish_imovelweb boolean not null default false,
  constraint properties_imovelweb_price_check
    check (price is null or (price > 0 and price <= 999999999999 and price = trunc(price))),
  constraint properties_imovelweb_selected_price_check
    check (not publish_imovelweb or price is not null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  url text not null,
  storage_path text not null,
  position int not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

-- Um administrador só existe aqui depois de criado em Authentication > Users
-- e inserido manualmente nesta tabela (ver README, seção "Criando o admin").
create table public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$ language sql stable security definer set search_path = public;

alter table public.cities enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.properties enable row level security;
alter table public.property_photos enable row level security;
alter table public.admins enable row level security;

create policy "cities_public_read" on public.cities for select using (true);
create policy "cities_admin_write" on public.cities for all
  using (public.is_admin()) with check (public.is_admin());

create policy "neighborhoods_public_read" on public.neighborhoods for select using (true);
create policy "neighborhoods_admin_write" on public.neighborhoods for all
  using (public.is_admin()) with check (public.is_admin());

create policy "properties_public_read" on public.properties for select using (true);
create policy "properties_admin_write" on public.properties for all
  using (public.is_admin()) with check (public.is_admin());

create policy "photos_public_read" on public.property_photos for select using (true);
create policy "photos_admin_write" on public.property_photos for all
  using (public.is_admin()) with check (public.is_admin());

create policy "admins_self_read" on public.admins for select using (auth.uid() = id);

-- Storage: bucket público para fotos dos imóveis (upload restrito a admin).
insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', true)
on conflict (id) do nothing;

create policy "property_photos_public_read" on storage.objects
  for select using (bucket_id = 'property-photos');

create policy "property_photos_admin_write" on storage.objects
  for insert with check (bucket_id = 'property-photos' and public.is_admin());

create policy "property_photos_admin_update" on storage.objects
  for update using (bucket_id = 'property-photos' and public.is_admin());

create policy "property_photos_admin_delete" on storage.objects
  for delete using (bucket_id = 'property-photos' and public.is_admin());

create index properties_city_id_idx on public.properties(city_id);
create index properties_neighborhood_id_idx on public.properties(neighborhood_id);
create index properties_status_idx on public.properties(status);
create index properties_transaction_type_idx on public.properties(transaction_type);
create index property_photos_property_id_idx on public.property_photos(property_id);

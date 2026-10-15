-- Integração com o Imovelweb (API OpenNavent), nos dois sentidos:
--  * imóveis cadastrados no site podem ser publicados no Imovelweb;
--  * anúncios cadastrados no Imovelweb são importados para o site.
-- O preço não aparece no site: o Imovelweb exige valor maior que zero.

alter table public.properties
  add column if not exists price numeric check (price is null or price > 0),
  add column if not exists publish_imovelweb boolean not null default false,
  -- 'site': cadastrado no painel; 'imovelweb': importado do portal.
  add column if not exists source text not null default 'site'
    check (source in ('site', 'imovelweb')),
  -- ID do anúncio no Imovelweb (idAvisoNavplat).
  add column if not exists imovelweb_id bigint unique,
  -- dataModificacao do anúncio na última importação (evita baixar de novo).
  add column if not exists imovelweb_modified_at text,
  -- Quando o site publicou o anúncio no Imovelweb pela última vez.
  add column if not exists imovelweb_published_at timestamptz,
  -- Hash do último conteúdo enviado: só reenvia quando algo mudou.
  add column if not exists imovelweb_hash text,
  -- Anúncio importado que saiu do ar no Imovelweb: some do site.
  add column if not exists imovelweb_offline_at timestamptz,
  -- Última recusa do Imovelweb (ex.: plano sem anúncios disponíveis).
  add column if not exists imovelweb_error text;

-- URL de origem das fotos importadas, para não baixar a mesma foto duas vezes.
alter table public.property_photos
  add column if not exists source_url text;

create table if not exists public.imovelweb_sync_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  summary jsonb not null default '{}'
);

alter table public.imovelweb_sync_runs enable row level security;

drop policy if exists "imovelweb_sync_runs_admin_read" on public.imovelweb_sync_runs;
create policy "imovelweb_sync_runs_admin_read" on public.imovelweb_sync_runs
  for select using (public.is_admin());

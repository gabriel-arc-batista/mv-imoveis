import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const name = `mv-xml-migration-${process.pid}`;
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
const sql = (database, text) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      name,
      "psql",
      "-U",
      "postgres",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: text, encoding: "utf8" },
  );
try {
  docker(
    "run",
    "--rm",
    "-d",
    "--name",
    name,
    "-e",
    `POSTGRES_PASSWORD=${randomBytes(24).toString("hex")}`,
    "postgres:17.6",
  );
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      docker("exec", name, "pg_isready", "-U", "postgres");
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!ready) throw new Error("PostgreSQL de teste não iniciou");
  sql(
    "postgres",
    `create database upgrade_test; create database fresh_test; create role anon; create role authenticated;`,
  );
  sql(
    "upgrade_test",
    `
    create table public.properties(id uuid primary key default gen_random_uuid(), title text not null);
    alter table public.properties enable row level security;
    create policy public_read on public.properties for select using(true);
    insert into public.properties(id,title) values('e5cfef7e-ae76-4a4e-a94e-60990daf05d4','Imóvel existente');
  `,
  );
  sql(
    "upgrade_test",
    readFileSync(
      new URL(
        "../supabase/migrations/20261027163039_add_imovelweb_xml_fields.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  sql(
    "upgrade_test",
    `
    do $$ begin
      if not exists(select 1 from public.properties where id='e5cfef7e-ae76-4a4e-a94e-60990daf05d4' and title='Imóvel existente' and price is null and publish_imovelweb=false) then raise exception 'Dados existentes alterados'; end if;
      if not exists(select 1 from pg_policies where tablename='properties' and policyname='public_read') then raise exception 'Política perdida'; end if;
      if not (select relrowsecurity from pg_class where oid='public.properties'::regclass) then raise exception 'RLS desativado'; end if;
    end $$;
    insert into public.properties(title,price,publish_imovelweb) values('Selecionado',3500,true);
    do $$ declare invalid numeric; begin
      foreach invalid in array array[0,-1,3500.4,3500.001,1000000000000,'NaN'::numeric,'Infinity'::numeric] loop
        begin
          insert into public.properties(title,price) values('Inválido',invalid);
          raise exception 'Preço inválido aceito: %',invalid;
        exception when check_violation then null; end;
      end loop;
      begin
        insert into public.properties(title,publish_imovelweb) values('Sem preço',true);
        raise exception 'Selecionado sem preço aceito';
      exception when check_violation then null; end;
    end $$;
  `,
  );
  sql(
    "fresh_test",
    `
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as 'select null::uuid';
    create table storage.buckets(id text primary key,name text,public boolean);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text);
  `,
  );
  sql(
    "fresh_test",
    readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  );
  console.log(
    "Migration aprovada em PostgreSQL 17: preservação dos dados/RLS, restrições de preço e schema novo.",
  );
} finally {
  try {
    docker("rm", "-f", name);
  } catch {
    /* O contêiner já pode ter sido removido por --rm. */
  }
}

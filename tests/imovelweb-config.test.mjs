import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getFeedSetup,
  getFeedUrl,
  getFeedConfigIssues,
} from "../lib/imovelweb/config.ts";
import { feedEnv, feedConfig } from "./fixtures/property.mjs";

test("shared production database blocks preview readiness and hides its feed URL", () => {
  const env = {
    ...feedEnv,
    VERCEL_ENV: "preview",
    VERCEL_BRANCH_URL: "preview.example.com",
    NEXT_PUBLIC_SUPABASE_URL: "https://aynqlhfzysscqnzkvbug.supabase.co",
  };
  assert.equal(getFeedSetup(env).blocked, true);
  assert.equal(getFeedSetup(env).ready, false);
  assert.equal(getFeedUrl(env), null);
});

test("preview never falls back to the production URL or shares a token with an insecure origin", () => {
  const env = {
    ...feedEnv,
    VERCEL_ENV: "preview",
    NEXT_PUBLIC_SITE_URL: "https://production.example.com",
  };
  assert.equal(getFeedUrl(env), null);
  const url = new URL(
    getFeedUrl({ ...env, VERCEL_BRANCH_URL: "branch.example.com" }),
  );
  assert.equal(url.origin, "https://branch.example.com");
  assert.equal(url.searchParams.get("token"), feedEnv.IMOVELWEB_FEED_TOKEN);
  for (const origin of [
    "http://production.example.com",
    "https://user:password@example.com",
    "javascript:alert(1)",
    "",
  ])
    assert.equal(
      getFeedUrl({
        ...feedEnv,
        VERCEL_ENV: "production",
        NEXT_PUBLIC_SITE_URL: origin,
      }),
      null,
    );
});

test("production requires its configured URL, while local development can use loopback HTTP", () => {
  const origin = "https://mv.example.com";
  assert.equal(
    new URL(
      getFeedUrl({
        ...feedEnv,
        VERCEL_ENV: "production",
        NEXT_PUBLIC_SITE_URL: origin,
      }),
    ).origin,
    origin,
  );
  assert.equal(
    new URL(getFeedUrl({ ...feedEnv, VERCEL_ENV: "development" })).origin,
    "http://localhost:3000",
  );
  assert.equal(
    getFeedUrl({ ...feedEnv, IMOVELWEB_XML_ENABLED: "false" }),
    null,
  );
});

test("configuration rejects malformed database URLs and XML-invalid contact fields", () => {
  for (const patch of [
    { NEXT_PUBLIC_SUPABASE_URL: "not-a-url" },
    { NEXT_PUBLIC_SUPABASE_URL: "ftp://example.com" },
    { NEXT_PUBLIC_SUPABASE_ANON_KEY: " " },
    { IMOVELWEB_CODIGO_IMOBILIARIA: "\u0000" },
    { IMOVELWEB_ESTADO: ",,," },
    { IMOVELWEB_NOME_CONTATO: "\u0000" },
    { IMOVELWEB_NOME_CONTATO: "a".repeat(256) },
  ]) {
    const result = getFeedSetup({ ...feedEnv, ...patch });
    assert.equal(result.ready, false);
    assert.ok(result.issues.length);
  }
  assert.deepEqual(
    getFeedConfigIssues({ ...feedConfig, contato: { nome: "😀".repeat(255) } }),
    [],
  );
});

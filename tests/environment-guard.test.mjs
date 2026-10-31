import { test } from "node:test";
import assert from "node:assert/strict";
import { assertSafeDatabaseEnvironment } from "../lib/supabase/environment-guard.ts";

test("preview/local cannot use the known production database", () => {
  for (const VERCEL_ENV of ["preview", "development", undefined])
    assert.throws(
      () =>
        assertSafeDatabaseEnvironment({
          VERCEL_ENV,
          NEXT_PUBLIC_SUPABASE_URL: "https://aynqlhfzysscqnzkvbug.supabase.co",
        }),
      /desenvolvimento|produção|isolado/i,
    );
});
test("equivalent production hostnames with a final DNS dot remain blocked", () => {
  assert.throws(() =>
    assertSafeDatabaseEnvironment({
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_SUPABASE_URL: "https://AYNQLHFZYSSCQNZKVBUG.supabase.co./",
    }),
  );
});
test("production and isolated development databases are allowed", () => {
  assert.doesNotThrow(() =>
    assertSafeDatabaseEnvironment({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://aynqlhfzysscqnzkvbug.supabase.co",
    }),
  );
  assert.doesNotThrow(() =>
    assertSafeDatabaseEnvironment({
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_SUPABASE_URL: "https://development.supabase.co",
    }),
  );
  assert.doesNotThrow(() =>
    assertSafeDatabaseEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    }),
  );
});

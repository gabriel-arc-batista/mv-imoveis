import { test } from "node:test";
import assert from "node:assert/strict";
import { createFeedHandler } from "../lib/imovelweb/http.ts";
import { property, feedEnv } from "./fixtures/property.mjs";

const request = (token = feedEnv.IMOVELWEB_FEED_TOKEN, method = "GET") =>
  new Request("https://site.example/imovelweb/feed.xml?token=" + token, {
    method,
  });

test("disabled, missing or incorrect token never reaches persistence", async () => {
  let reads = 0;
  const load = async () => {
    reads++;
    return [property()];
  };
  for (const env of [
    { ...feedEnv, IMOVELWEB_XML_ENABLED: "false" },
    { ...feedEnv, IMOVELWEB_FEED_TOKEN: "" },
  ])
    assert.equal(
      (await createFeedHandler({ env, loadProperties: load })(request()))
        .status,
      404,
    );
  const handler = createFeedHandler({ env: feedEnv, loadProperties: load });
  assert.equal((await handler(request(""))).status, 404);
  assert.equal((await handler(request("wrong"))).status, 404);
  assert.equal(reads, 0);
});

test("valid request returns fresh XML with no cache or indexing", async () => {
  const response = await createFeedHandler({
    env: feedEnv,
    loadProperties: async () => [property()],
  })(request());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/xml/);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.match(response.headers.get("x-robots-tag"), /noindex/);
  assert.match(await response.text(), /<OpenNavent>/);
});

test("preview sharing the real database cannot export a feed", async () => {
  let reads = 0;
  const response = await createFeedHandler({
    env: { ...feedEnv, VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: "https://aynqlhfzysscqnzkvbug.supabase.co" },
    loadProperties: async () => { reads++; return [property()]; },
  })(request());
  assert.equal(response.status, 503);
  assert.equal(reads, 0);
});

test("HEAD validates the same data and returns headers without a body", async () => {
  const response = await createFeedHandler({
    env: feedEnv,
    loadProperties: async () => [property()],
  })(request(undefined, "HEAD"));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  assert.match(response.headers.get("content-type"), /xml/);
});

test("missing config, failed query, empty/invalid and partial results never return a valid XML load", async () => {
  const cases = [
    {
      env: { ...feedEnv, IMOVELWEB_CODIGO_IMOBILIARIA: "" },
      loadProperties: async () => [property()],
    },
    {
      env: feedEnv,
      loadProperties: async () => {
        throw new Error("secret database URL");
      },
    },
    { env: feedEnv, loadProperties: async () => [] },
    {
      env: feedEnv,
      loadProperties: async () => [
        property(),
        property({ id: "invalid", photos: [] }),
      ],
    },
  ];
  for (const options of cases) {
    const response = await createFeedHandler(options)(request());
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /secret database|<OpenNavent>/);
  }
});

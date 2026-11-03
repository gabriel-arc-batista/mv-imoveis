import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { getFeedProperties } from "../lib/imovelweb/properties.ts";
import { property } from "./fixtures/property.mjs";

async function withDatabase(respond, check) {
  const server = createServer(respond);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anonymous-test-key";
  try {
    await check();
  } finally {
    for (const [name, value] of [
      ["NEXT_PUBLIC_SUPABASE_URL", previous.url],
      ["NEXT_PUBLIC_SUPABASE_ANON_KEY", previous.key],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await new Promise((resolve) => server.close(resolve));
  }
}

test("reads every page with public credentials and deterministic ordering", async () => {
  const offsets = [];
  await withDatabase(
    (req, res) => {
      const url = new URL(req.url, "http://localhost");
      const offset = Number(url.searchParams.get("offset"));
      offsets.push(offset);
      assert.equal(req.headers.apikey, "anonymous-test-key");
      assert.equal(url.searchParams.get("publish_imovelweb"), "eq.true");
      assert.equal(url.searchParams.get("status"), "eq.disponivel");
      assert.equal(url.searchParams.get("order"), "id.asc");
      const count = 251,
        items = Array.from({ length: offset === 0 ? 250 : 1 }, (_, index) =>
          property({ id: String(offset + index) }),
        );
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Range": `${offset}-${offset + items.length - 1}/${count}`,
      });
      res.end(JSON.stringify(items));
    },
    async () => assert.equal((await getFeedProperties()).length, 251),
  );
  assert.deepEqual(offsets, [0, 250]);
});

test("pagination failure, truncated data or changing counts rejects the whole load", async () => {
  for (const scenario of ["failure", "truncated", "changed"]) {
    await withDatabase(
      (req, res) => {
        const offset = Number(
          new URL(req.url, "http://localhost").searchParams.get("offset"),
        );
        if (offset && scenario === "failure") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ code: "42703", message: "missing column" }));
          return;
        }
        const size = scenario === "truncated" ? 100 : offset ? 1 : 250,
          total = offset && scenario === "changed" ? 252 : 251;
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Content-Range": `${offset}-${offset + size - 1}/${total}`,
        });
        res.end(
          JSON.stringify(
            Array.from({ length: size }, (_, i) =>
              property({ id: String(offset + i) }),
            ),
          ),
        );
      },
      async () => assert.rejects(getFeedProperties()),
    );
  }
});

test("oversized or missing counts fail immediately instead of reading a partial catalog", async () => {
  for (const total of [10001, null]) {
    let reads = 0;
    await withDatabase(
      (_req, res) => {
        reads++;
        res.writeHead(200, {
          "Content-Type": "application/json",
          ...(total === null ? {} : { "Content-Range": `0-0/${total}` }),
        });
        res.end(JSON.stringify([property()]));
      },
      async () =>
        assert.rejects(
          getFeedProperties(),
          (error) =>
            error.reason === (total === null ? "read_failed" : "catalog_limit"),
        ),
    );
    assert.equal(reads, 1);
  }
});

test("admin overview reads all opted-in statuses, with the same complete pagination", async () => {
  await withDatabase(
    (req, res) => {
      const url = new URL(req.url, "http://localhost");
      assert.equal(url.searchParams.get("publish_imovelweb"), "eq.true");
      assert.equal(url.searchParams.has("status"), false);
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Range": "0-0/1",
      });
      res.end(JSON.stringify([property({ status: "vendido" })]));
    },
    async () =>
      assert.equal(
        (await getFeedProperties({ includeSold: true }))[0].status,
        "vendido",
      ),
  );
});

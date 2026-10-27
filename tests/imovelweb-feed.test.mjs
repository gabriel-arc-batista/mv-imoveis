import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  buildImovelwebFeed,
  getImovelwebIssues,
} from "../lib/imovelweb/feed.ts";
import { property, feedConfig } from "./fixtures/property.mjs";

function parse(xml) {
  return JSON.parse(
    execFileSync(
      "python3",
      [
        "-c",
        `
import sys,json,xml.etree.ElementTree as ET
r=ET.fromstring(sys.stdin.read())
def node(e):
 return {'tag':e.tag,'text':e.text or '', 'children':[node(c) for c in e]}
print(json.dumps(node(r)))
`,
      ],
      { input: xml, encoding: "utf8" },
    ),
  );
}
const children = (node, name) => node.children.filter((c) => c.tag === name);
const child = (node, name) => children(node, name)[0];

test("OpenNavent XML has required BR structure, stable identity and correct operation", () => {
  const root = parse(
    buildImovelwebFeed(
      [property({ transaction_type: "aluguel" })],
      feedConfig,
      1793100000000,
    ),
  );
  assert.equal(root.tag, "OpenNavent");
  assert.equal(child(root, "dataModificacao").text, "1793100000000");
  const item = child(child(root, "Imoveis"), "Imovel");
  assert.equal(child(item, "codigoAnuncio").text, property().id);
  assert.equal(child(item, "codigoReferencia").text, "MV-TESTE");
  const price = child(child(item, "precos"), "preco");
  assert.equal(child(price, "quantidade").text, "3500");
  assert.equal(child(price, "moeda").text, "BRL");
  assert.equal(child(price, "operacao").text, "ALQUILER");
  assert.equal(
    child(child(item, "publicacao"), "tipoPublicacao").text,
    "SIMPLE",
  );
  assert.equal(
    child(child(item, "publicador"), "codigoImobiliaria").text,
    "mv-test",
  );
});

test("preserves decimal areas, zero parking and puts the cover first", () => {
  const root = parse(buildImovelwebFeed([property()], feedConfig));
  const item = child(child(root, "Imoveis"), "Imovel");
  const features = children(child(item, "caracteristicas"), "caracteristica");
  assert.equal(
    child(
      features.find((f) => child(f, "id").text === "CFT101"),
      "valor",
    ).text,
    "85.6",
  );
  assert.equal(
    child(
      features.find((f) => child(f, "id").text === "CFT7"),
      "valor",
    ).text,
    "0",
  );
  const photos = children(
    child(child(item, "multimidia"), "imagens"),
    "imagem",
  );
  assert.equal(photos.length, 5);
  assert.equal(child(photos[0], "urlImagem").text, property().photos[2].url);
});

test("CDATA, accents, control characters and surrogate characters produce valid XML", () => {
  const description =
    "Descrição com & <tags> e ]]> literal. ".repeat(3) + "\u0000\ud800😀";
  const root = parse(
    buildImovelwebFeed([property({ description })], feedConfig),
  );
  assert.equal(
    child(child(child(root, "Imoveis"), "Imovel"), "descricao").text,
    description.replace(/[\u0000\ud800]/g, ""),
  );
});

test("only opted-in available properties are exported", () => {
  const root = parse(
    buildImovelwebFeed(
      [
        property(),
        property({ id: "unselected", publish_imovelweb: false }),
        property({ id: "sold", status: "vendido" }),
      ],
      feedConfig,
    ),
  );
  assert.equal(children(child(root, "Imoveis"), "Imovel").length, 1);
});

test("invalid selected property blocks the whole feed instead of disappearing silently", () => {
  assert.throws(
    () =>
      buildImovelwebFeed(
        [property(), property({ id: "invalid", price: null })],
        feedConfig,
      ),
    /incomplet|preço/i,
  );
  assert.throws(
    () => buildImovelwebFeed([property(), property()], feedConfig),
    /duplicad/i,
  );
  assert.throws(() => buildImovelwebFeed([], feedConfig), /vazi|nenhum/i);
});

test("BR requirements: five photos, description length, postal code and supported type", () => {
  for (const patch of [
    { photos: property().photos.slice(0, 4) },
    { description: "Curta" },
    { zip_code: "123" },
    { type: "outro" },
    { address: "" },
    { area_m2: 0 },
    { title: "a".repeat(81) },
    { neighborhood: { id: "x", city_id: "other", name: "Bairro" } },
  ]) {
    assert.ok(
      getImovelwebIssues(property(patch)).length,
      JSON.stringify(patch),
    );
  }
  assert.deepEqual(getImovelwebIssues(property()), []);
});

test("rejects fractional/invalid prices without rounding or changing the submitted value", () => {
  for (const price of [0, -1, 3500.4, NaN, Infinity, null])
    assert.ok(getImovelwebIssues(property({ price })).length);
  assert.throws(() =>
    buildImovelwebFeed([property({ price: 3500.4 })], feedConfig),
  );
});

test("photo URLs must be usable, unique, public HTTPS URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://localhost/test.jpg",
    "https://localhost/test.jpg",
    "https://127.0.0.1/test.jpg",
    "https://user:password@example.com/a.jpg",
  ]) {
    const photos = property().photos.map((p) => ({ ...p, url }));
    assert.ok(getImovelwebIssues(property({ photos })).length);
  }
});

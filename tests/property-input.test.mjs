import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePropertyForm } from "../lib/property-input.ts";

function form(overrides = {}) {
  const f = new FormData();
  for (const [key, value] of Object.entries({
    title: "Apartamento teste",
    code: "MV-T",
    type: "apartamento",
    status: "disponivel",
    transaction_type: "venda",
    city_id: "8a70a0d1-e358-4ef0-9b0f-c24497e646ad",
    neighborhood_id: "37db7a3b-21b2-4efa-a1e9-1c70ac4d18ff",
    ...overrides,
  }))
    f.set(key, value);
  return f;
}

test("ordinary showcase listing needs neither price nor XML opt-in", () => {
  const result = parsePropertyForm(form());
  assert.ok(result.success);
  assert.equal(result.data.price, null);
  assert.equal(result.data.publish_imovelweb, false);
});
test("covered area is explicit, can be cleared and is independently validated", () => {
  const result = parsePropertyForm(
    form({ area_m2: "85.6", covered_area_m2: "70.25" }),
  );
  assert.ok(result.success);
  assert.equal(result.data.covered_area_m2, 70.25);
  assert.ok(
    parsePropertyForm(
      form({ type: "casa", area_m2: "85.6", covered_area_m2: "150" }),
    ).success,
  );
  assert.equal(
    parsePropertyForm(form({ covered_area_m2: "" })).data.covered_area_m2,
    null,
  );
  for (const covered_area_m2 of ["0", "-1", "Infinity"])
    assert.equal(
      parsePropertyForm(form({ area_m2: "85.6", covered_area_m2 })).success,
      false,
    );
});
test("XML opt-in requires whole-real positive price", () => {
  for (const price of ["", "0", "-10", "3500.4", "Infinity", "not-a-number"])
    assert.equal(
      parsePropertyForm(form({ publish_imovelweb: "on", price })).success,
      false,
    );
  const result = parsePropertyForm(
    form({ publish_imovelweb: "on", price: "3500" }),
  );
  assert.ok(result.success);
  assert.equal(result.data.price, 3500);
  assert.equal(result.data.publish_imovelweb, true);
});
test("unchecking export and clearing price explicitly clears stored values", () => {
  const result = parsePropertyForm(
    form({ price: "", publish_imovelweb: "false" }),
  );
  assert.ok(result.success);
  assert.equal(result.data.price, null);
  assert.equal(result.data.publish_imovelweb, false);
});

import { expect, test } from "@playwright/test";

test("server rejection preserves fields and export selection; city changes clear neighborhood", async ({
  page,
  context,
}) => {
  await context.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/");
  await page
    .getByLabel("Título", { exact: true })
    .fill("Título preservado depois de erro");
  await page.getByLabel("Código", { exact: true }).fill("MV-DUPLICADO");
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Descrição mantida após erro do servidor.");
  await page
    .getByLabel("Cidade", { exact: true })
    .selectOption({ label: "Cidade 1" });
  await page
    .getByLabel("Bairro", { exact: true })
    .selectOption({ label: "Bairro 1" });
  await page
    .getByLabel("Preço para o Imovelweb (R$)", { exact: true })
    .fill("3500");
  await page
    .getByRole("checkbox", { name: "Incluir este imóvel no XML do Imovelweb" })
    .check();
  await page
    .getByRole("checkbox", { name: "Exibir em destaque na página inicial" })
    .check();
  await page.getByRole("button", { name: "Salvar teste" }).click();

  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Preço recebido: 3500; XML: on",
  );
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
    "Título preservado depois de erro",
  );
  await expect(page.getByLabel("Código", { exact: true })).toHaveValue(
    "MV-DUPLICADO",
  );
  await expect(page.getByLabel("Descrição", { exact: true })).toHaveValue(
    "Descrição mantida após erro do servidor.",
  );
  await expect(page.getByLabel("Cidade", { exact: true })).toHaveValue(
    "11111111-1111-4111-8111-111111111111",
  );
  await expect(page.getByLabel("Bairro", { exact: true })).toHaveValue(
    "33333333-3333-4333-8333-333333333333",
  );
  await expect(
    page.getByLabel("Preço para o Imovelweb (R$)", { exact: true }),
  ).toHaveValue("3500");
  await expect(
    page.getByRole("checkbox", {
      name: "Incluir este imóvel no XML do Imovelweb",
    }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", {
      name: "Exibir em destaque na página inicial",
    }),
  ).toBeChecked();

  await page
    .getByLabel("Cidade", { exact: true })
    .selectOption({ label: "Cidade 2" });
  await expect(page.getByLabel("Bairro", { exact: true })).toHaveValue("");
  await page
    .getByLabel("Preço para o Imovelweb (R$)", { exact: true })
    .fill("3500.4");
  expect(
    await page
      .locator("#price")
      .evaluate((input: HTMLInputElement) => input.checkValidity()),
  ).toBe(false);
});

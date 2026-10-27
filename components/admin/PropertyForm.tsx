"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import type {
  City,
  Neighborhood,
  Property,
  PropertyTransaction,
  PropertyType,
} from "@/lib/types";
import { PROPERTY_TRANSACTION_LABEL, PROPERTY_TYPE_LABEL } from "@/lib/types";
import type { ActionState } from "@/app/admin/actions";
import {
  button,
  input as inputClass,
  label as labelClass,
} from "@/components/admin/ui";

export function PropertyForm({
  action,
  cities,
  neighborhoods,
  property,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  cities: City[];
  neighborhoods: Neighborhood[];
  property?: Property;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    null,
  );
  const [cityId, setCityId] = useState(property?.city_id ?? "");
  const [featured, setFeatured] = useState(property?.is_featured ?? false);
  const [exporting, setExporting] = useState(
    property?.publish_imovelweb ?? false,
  );
  const [values, setValues] = useState({
    title: property?.title ?? "",
    code: property?.code ?? "",
    type: property?.type ?? "apartamento",
    status: property?.status ?? "disponivel",
    transaction_type: property?.transaction_type ?? "venda",
    neighborhood_id: property?.neighborhood_id ?? "",
    address: property?.address ?? "",
    zip_code: property?.zip_code ?? "",
    area_m2: String(property?.area_m2 ?? ""),
    bedrooms: String(property?.bedrooms ?? ""),
    bathrooms: String(property?.bathrooms ?? ""),
    parking_spots: String(property?.parking_spots ?? ""),
    description: property?.description ?? "",
    features: property?.features?.join(", ") ?? "",
    price: String(property?.price ?? ""),
  });
  function field(name: keyof typeof values) {
    return {
      value: values[name],
      onChange: (
        event: ChangeEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
      ) => {
        const value = event.target.value;
        setValues((current) => ({ ...current, [name]: value }));
      },
    };
  }

  const filteredNeighborhoods = cityId
    ? neighborhoods.filter((n) => n.city_id === cityId)
    : [];

  return (
    <form
      action={formAction}
      // Actions também disparam reset ao devolver erros de validação.
      // Impedir o reset nativo mantém selects e checkboxes alinhados ao estado.
      onReset={(event) => event.preventDefault()}
      className="flex flex-col gap-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Título" htmlFor="title">
          <input
            id="title"
            name="title"
            required
            {...field("title")}
            className={inputClass}
          />
        </Field>

        <Field label="Código" htmlFor="code">
          <input
            id="code"
            name="code"
            required
            {...field("code")}
            className={inputClass}
          />
        </Field>

        <Field label="Tipo" htmlFor="type">
          <select
            id="type"
            name="type"
            required
            {...field("type")}
            className={inputClass}
          >
            {Object.entries(PROPERTY_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value as PropertyType}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status" htmlFor="status">
          <select
            id="status"
            name="status"
            required
            {...field("status")}
            className={inputClass}
          >
            <option value="disponivel">Disponível</option>
            <option value="vendido">Vendido</option>
          </select>
        </Field>

        <Field label="Finalidade" htmlFor="transaction_type">
          <select
            id="transaction_type"
            name="transaction_type"
            required
            {...field("transaction_type")}
            className={inputClass}
          >
            {Object.entries(PROPERTY_TRANSACTION_LABEL).map(
              ([value, label]) => (
                <option key={value} value={value as PropertyTransaction}>
                  {label}
                </option>
              ),
            )}
          </select>
        </Field>

        <Field label="Cidade" htmlFor="city_id">
          <select
            id="city_id"
            name="city_id"
            required
            value={cityId}
            onChange={(e) => {
              setCityId(e.target.value);
              setValues((current) => ({ ...current, neighborhood_id: "" }));
            }}
            className={inputClass}
          >
            <option value="" disabled>
              Selecione
            </option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Bairro" htmlFor="neighborhood_id">
          <select
            id="neighborhood_id"
            name="neighborhood_id"
            required
            {...field("neighborhood_id")}
            disabled={!cityId}
            className={inputClass}
          >
            <option value="" disabled>
              {cityId ? "Selecione" : "Escolha a cidade primeiro"}
            </option>
            {filteredNeighborhoods.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Endereço (opcional)" htmlFor="address">
          <input
            id="address"
            name="address"
            {...field("address")}
            className={inputClass}
          />
        </Field>

        <Field label="CEP (opcional)" htmlFor="zip_code">
          <input
            id="zip_code"
            name="zip_code"
            {...field("zip_code")}
            className={inputClass}
          />
        </Field>

        <Field label="Área (m²)" htmlFor="area_m2">
          <input
            id="area_m2"
            name="area_m2"
            type="number"
            step="0.01"
            min="0"
            {...field("area_m2")}
            className={inputClass}
          />
        </Field>

        <Field label="Quartos" htmlFor="bedrooms">
          <input
            id="bedrooms"
            name="bedrooms"
            type="number"
            min="0"
            {...field("bedrooms")}
            className={inputClass}
          />
        </Field>

        <Field label="Banheiros" htmlFor="bathrooms">
          <input
            id="bathrooms"
            name="bathrooms"
            type="number"
            min="0"
            {...field("bathrooms")}
            className={inputClass}
          />
        </Field>

        <Field label="Vagas" htmlFor="parking_spots">
          <input
            id="parking_spots"
            name="parking_spots"
            type="number"
            min="0"
            {...field("parking_spots")}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Descrição" htmlFor="description">
        <textarea
          id="description"
          name="description"
          rows={5}
          {...field("description")}
          className={inputClass}
        />
      </Field>

      <Field
        label="Características e diferenciais (separados por vírgula)"
        htmlFor="features"
      >
        <input
          id="features"
          name="features"
          placeholder="Piscina, Varanda gourmet, Portaria 24h"
          {...field("features")}
          className={inputClass}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-admin-ink-soft">
        <input
          type="checkbox"
          name="is_featured"
          checked={featured}
          onChange={(event) => setFeatured(event.target.checked)}
          className="focus-ring h-4 w-4 accent-(--color-admin-accent)"
        />
        Exibir em destaque na página inicial
      </label>

      <fieldset className="rounded-xl border border-admin-border p-5">
        <legend className="px-2 text-sm font-semibold text-admin-ink">
          Publicação no Imovelweb
        </legend>
        <p className="mb-4 text-sm text-admin-ink-soft">
          O XML envia os imóveis selecionados ao portal. O atendimento dos
          interessados continua como está.
        </p>
        <Field label="Preço para o Imovelweb (R$)" htmlFor="price">
          <input
            id="price"
            name="price"
            type="number"
            min="1"
            step="1"
            max="999999999999"
            required={exporting}
            {...field("price")}
            className={inputClass}
            aria-describedby="price-help"
          />
        </Field>
        <p id="price-help" className="mt-2 text-xs text-admin-ink-soft">
          Use reais inteiros, sem centavos. Este preço não é exibido na vitrine
          do site.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm text-admin-ink">
          <input
            type="checkbox"
            name="publish_imovelweb"
            checked={exporting}
            onChange={(event) => setExporting(event.target.checked)}
            className="focus-ring h-4 w-4 accent-(--color-admin-accent)"
          />
          Incluir este imóvel no XML do Imovelweb
        </label>
        <p className="mt-2 text-xs text-admin-ink-soft">
          Para entrar na carga: imóvel disponível, título de 10 a 80 caracteres,
          descrição de pelo menos 50 caracteres, endereço, CEP, área e pelo
          menos 5 fotos. Salve o imóvel para adicionar as fotos.
        </p>
      </fieldset>

      {state?.error && (
        <p
          role="alert"
          className="rounded-lg bg-admin-danger-soft px-3 py-2 text-sm text-admin-danger"
        >
          {state.error}
        </p>
      )}
      {state?.success && (
        <p
          role="status"
          className="rounded-lg bg-admin-success-soft px-3 py-2 text-sm text-admin-success"
        >
          Alterações salvas.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`${button.primary} self-start`}
      >
        {pending ? "Salvando…" : submitLabel}
      </button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

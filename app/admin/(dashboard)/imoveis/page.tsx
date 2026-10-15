import Link from "next/link";
import { getProperties } from "@/lib/queries";
import { PROPERTY_TYPE_LABEL } from "@/lib/types";
import { setPropertyStatus } from "@/app/admin/actions";
import { DeletePropertyButton } from "@/components/admin/DeletePropertyButton";
import { AdminPhotoCarousel } from "@/components/admin/AdminPhotoCarousel";
import { badge, button, card } from "@/components/admin/ui";
import { ImovelwebStatus } from "@/components/admin/ImovelwebStatus";

export default async function AdminImoveisPage() {
  const properties = await getProperties({ includeSold: true, includeOffline: true });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-ink">Imóveis</h1>
          <p className="mt-1 text-sm text-admin-ink-soft">
            {properties.length} imóvel{properties.length === 1 ? "" : "eis"}{" "}
            cadastrado{properties.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/admin/imoveis/novo" className={button.primary}>
          + Cadastrar imóvel
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className={`mt-8 p-10 text-center ${card}`}>
          <p className="text-sm text-admin-ink-soft">
            Nenhum imóvel cadastrado ainda.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => {
            const nextStatus =
              property.status === "disponivel" ? "vendido" : "disponivel";
            return (
              <div key={property.id} className={`overflow-hidden ${card}`}>
                <AdminPhotoCarousel
                  photos={property.photos ?? []}
                  title={property.title}
                />

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/imoveis/${property.id}`}
                        className="focus-ring truncate text-base font-semibold text-admin-ink hover:text-admin-accent"
                      >
                        {property.title}
                      </Link>
                      <p className="text-xs text-admin-ink-soft">
                        {property.code} · {PROPERTY_TYPE_LABEL[property.type]}
                      </p>
                    </div>
                    <form
                      action={setPropertyStatus.bind(
                        null,
                        property.id,
                        nextStatus
                      )}
                      className="shrink-0"
                    >
                      <button
                        type="submit"
                        className={`focus-ring transition-opacity hover:opacity-80 ${badge(
                          property.status === "disponivel"
                            ? "success"
                            : "accent"
                        )}`}
                        title={`Marcar como ${nextStatus === "vendido" ? "vendido" : "disponível"}`}
                      >
                        {property.status === "disponivel"
                          ? "Disponível"
                          : "Vendido"}
                      </button>
                    </form>
                  </div>

                  <p className="mt-2 text-sm text-admin-ink-soft">
                    {[property.neighborhood?.name, property.city?.name]
                      .filter(Boolean)
                      .join(", ") || "Local não definido"}
                  </p>

                  <div className="mt-3 empty:hidden">
                    <ImovelwebStatus property={property} />
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-admin-border pt-4">
                    <span className="text-xs text-admin-ink-soft">
                      {property.photos?.length ?? 0} foto
                      {(property.photos?.length ?? 0) === 1 ? "" : "s"}
                    </span>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/admin/imoveis/${property.id}`}
                        className={button.ghost}
                      >
                        Editar
                      </Link>
                      <DeletePropertyButton
                        propertyId={property.id}
                        title={property.title}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

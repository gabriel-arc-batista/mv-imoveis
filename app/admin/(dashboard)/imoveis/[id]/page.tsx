import { notFound } from "next/navigation";
import { getCities, getNeighborhoods, getPropertyById } from "@/lib/queries";
import { updateProperty } from "@/app/admin/actions";
import { PropertyForm } from "@/components/admin/PropertyForm";
import { PhotoManager } from "@/components/admin/PhotoManager";
import { ImovelwebStatus } from "@/components/admin/ImovelwebStatus";
import { isSafeDatabaseEnvironment } from "@/lib/supabase/environment-guard";
import { card } from "@/components/admin/ui";

export default async function EditarImovelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [property, cities, neighborhoods] = await Promise.all([
    getPropertyById(id),
    getCities(),
    getNeighborhoods(),
  ]);

  if (!property) notFound();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-ink">
        {property.title}
      </h1>
      <p className="mt-1 text-sm text-admin-ink-soft">Código {property.code}</p>
      <ImovelwebStatus property={property} />

      <div className={`mt-8 max-w-2xl p-6 sm:p-8 ${card}`}>
        <PropertyForm
          action={updateProperty.bind(null, property.id)}
          cities={cities}
          neighborhoods={neighborhoods}
          property={property}
          submitLabel="Salvar alterações"
        />
      </div>

      <div className={`mt-8 max-w-3xl p-6 sm:p-8 ${card}`}>
        <h2 className="text-lg font-semibold text-admin-ink">Fotos</h2>
        <p className="mt-1 text-sm text-admin-ink-soft">
          A primeira foto marcada como capa aparece nos cards do site.
        </p>
        <div className="mt-5">
          <PhotoManager
            propertyId={property.id}
            photos={property.photos ?? []}
            databaseWritesAllowed={isSafeDatabaseEnvironment()}
          />
        </div>
      </div>
    </div>
  );
}

import { getImovelwebIssues } from "@/lib/imovelweb/mapping";
import type { Property } from "@/lib/types";
import { badge } from "@/components/admin/ui";

// Situação do imóvel em relação ao Imovelweb, para o painel.
export function ImovelwebStatus({ property }: { property: Property }) {
  if (property.source === "imovelweb") {
    return property.imovelweb_offline_at ? (
      <p className={badge("neutral")}>Fora do ar no Imovelweb (oculto no site)</p>
    ) : (
      <p className={badge("accent")}>Importado do Imovelweb</p>
    );
  }

  if (property.imovelweb_error) {
    return (
      <p className="text-xs text-admin-danger">
        Imovelweb recusou: {property.imovelweb_error}
      </p>
    );
  }

  if (!property.publish_imovelweb) {
    return property.imovelweb_published_at ? (
      <p className={badge("neutral")}>Saindo do Imovelweb…</p>
    ) : null;
  }

  const issues = getImovelwebIssues(property);
  if (issues.length > 0) {
    return (
      <p className="text-xs text-admin-danger">
        Fora do Imovelweb: {issues.join(", ").toLowerCase()}
      </p>
    );
  }

  return property.imovelweb_published_at ? (
    <p className={badge("success")}>Publicado no Imovelweb</p>
  ) : (
    <p className={badge("neutral")}>Aguardando envio ao Imovelweb</p>
  );
}

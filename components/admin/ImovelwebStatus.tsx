import type { Property } from "@/lib/types";
import { getImovelwebIssues } from "@/lib/imovelweb/feed";
import { badge } from "./ui";

export function ImovelwebStatus({ property }: { property: Property }) {
  if (!property.publish_imovelweb)
    return (
      <p className="mt-3 text-xs text-admin-ink-soft">Imovelweb: fora do XML</p>
    );
  if (property.status !== "disponivel")
    return (
      <p className="mt-3 text-xs text-admin-ink-soft">
        Imovelweb: vendido, fora do XML
      </p>
    );
  const issues = getImovelwebIssues(property);
  if (!issues.length)
    return (
      <p className="mt-3">
        <span className={badge("success")}>Pronto para o XML</span>
      </p>
    );
  return (
    <details className="mt-3 text-xs text-admin-ink-soft">
      <summary className="cursor-pointer text-admin-danger">
        Pendências para o XML ({issues.length})
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </details>
  );
}

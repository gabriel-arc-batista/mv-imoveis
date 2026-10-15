"use client";

import { useActionState } from "react";
import { syncImovelwebNow, type SyncState } from "@/app/admin/actions";
import { button } from "@/components/admin/ui";

export function ImovelwebSyncButton({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState<SyncState>(syncImovelwebNow, null);
  const summary = state?.summary;

  return (
    <form action={action} className="flex flex-col gap-3">
      <button type="submit" disabled={disabled || pending} className={`${button.primary} self-start`}>
        {pending ? "Sincronizando…" : "Sincronizar agora"}
      </button>

      {summary && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${
            summary.ok ? "bg-admin-success-soft text-admin-success" : "bg-admin-danger-soft text-admin-danger"
          }`}
        >
          <p className="font-semibold">
            {summary.ok ? "Sincronização concluída." : "A sincronização teve problemas."}
          </p>
          <p className="mt-1">
            Publicados: {summary.published} · Retirados: {summary.removed} · Importados:{" "}
            {summary.imported} · Atualizados: {summary.updated} · Sem mudança: {summary.unchanged} ·
            Ocultados: {summary.offline}
            {summary.pending > 0 && ` · Ficaram para a próxima rodada: ${summary.pending}`}
          </p>
          {[...summary.errors, ...summary.warnings].length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {[...summary.errors, ...summary.warnings].slice(0, 10).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}

import Script from "next/script";
import { createClient } from "@/lib/supabase/server";
import { getApiConfig, getFeedConfig, missingApiEnv } from "@/lib/imovelweb/config";
import { checkImovelwebConnection, type SyncSummary } from "@/lib/imovelweb/sync";
import { ImovelwebSyncButton } from "@/components/admin/ImovelwebSyncButton";
import { badge, card } from "@/components/admin/ui";

// A sincronização manual roda numa Server Action desta página.
export const maxDuration = 60;

type Run = { id: number; started_at: string; finished_at: string | null; ok: boolean | null; summary: SyncSummary };

const dateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", { timeZone: "America/Recife", dateStyle: "short", timeStyle: "short" });

export default async function ImovelwebPage() {
  const config = getApiConfig();
  const feed = getFeedConfig();
  const missing = missingApiEnv();
  const connection = await checkImovelwebConnection();

  const supabase = await createClient();
  const { data: runs } = await supabase
    .from("imovelweb_sync_runs")
    .select("id, started_at, finished_at, ok, summary")
    .order("started_at", { ascending: false })
    .limit(10);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-ink">Imovelweb</h1>
      <p className="mt-1 max-w-2xl text-sm text-admin-ink-soft">
        Imóveis cadastrados aqui e marcados para publicação vão para o Imovelweb.
        Anúncios cadastrados direto no Imovelweb aparecem no site. A sincronização
        roda todo dia às 6h e sempre que você salva um imóvel.
      </p>

      <section className={`mt-8 max-w-3xl p-6 ${card}`}>
        <h2 className="text-lg font-semibold text-admin-ink">Situação</h2>
        {config ? (
          <div className="mt-3 flex flex-col gap-2 text-sm text-admin-ink-soft">
            <p>
              <span className={badge("success")}>Integração pela API ativa</span>
            </p>
            {connection && "error" in connection && (
              <p className="text-admin-danger">Falha ao falar com o Imovelweb: {connection.error}</p>
            )}
            {connection && "linked" in connection && (
              <p>
                {connection.linked
                  ? "A conta da MV Imóveis está vinculada a esta integração."
                  : "A conta da MV Imóveis ainda não está vinculada. Use o botão abaixo com o usuário administrador do Imovelweb."}
              </p>
            )}
          </div>
        ) : feed ? (
          <p className="mt-3 text-sm text-admin-ink-soft">
            <span className={badge("accent")}>Somente feed XML</span> O site publica no
            Imovelweb pelo feed, mas não importa anúncios de lá. Para importar,
            configure as credenciais da API.
          </p>
        ) : (
          <div className="mt-3 text-sm text-admin-ink-soft">
            <p>
              <span className={badge("neutral")}>Não configurada</span>
            </p>
            <p className="mt-2">
              Faltam estas variáveis de ambiente na Vercel: {missing.join(", ")}. As
              credenciais da API são fornecidas pela equipe de integração do Imovelweb.
            </p>
          </div>
        )}
      </section>

      {config?.integrador && (
        <section className={`mt-6 max-w-3xl p-6 ${card}`}>
          <h2 className="text-lg font-semibold text-admin-ink">Vincular a conta do Imovelweb</h2>
          <p className="mt-1 text-sm text-admin-ink-soft">
            Entre com o usuário administrador ou supervisor da MV Imóveis no Imovelweb
            e autorize a integração. Só precisa ser feito uma vez.
          </p>
          <div id="opennavent" className="mt-4" />
          <Script
            src={`https://loginbr-open.navent.com/${encodeURIComponent(config.integrador)}/${encodeURIComponent(config.codigoImobiliaria)}.js`}
            strategy="afterInteractive"
          />
        </section>
      )}

      <section className={`mt-6 max-w-3xl p-6 ${card}`}>
        <h2 className="text-lg font-semibold text-admin-ink">Sincronizar</h2>
        <p className="mt-1 mb-4 text-sm text-admin-ink-soft">
          Envia ao Imovelweb o que mudou no site e traz os anúncios novos ou alterados de lá.
        </p>
        <ImovelwebSyncButton disabled={!config} />
      </section>

      {runs && runs.length > 0 && (
        <section className={`mt-6 max-w-3xl p-6 ${card}`}>
          <h2 className="text-lg font-semibold text-admin-ink">Últimas sincronizações</h2>
          <ul className="mt-3 flex flex-col divide-y divide-admin-border text-sm">
            {(runs as Run[]).map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-admin-ink">
                  {dateTime(run.started_at)} · {run.summary?.trigger === "cron" ? "automática" : "manual"}
                </span>
                <span className="text-admin-ink-soft">
                  {run.ok === null
                    ? "em andamento"
                    : `${run.summary.published ?? 0} publicados · ${run.summary.imported ?? 0} importados · ${run.summary.updated ?? 0} atualizados${
                        run.summary.errors?.length ? ` · ${run.summary.errors.length} erro(s)` : ""
                      }`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

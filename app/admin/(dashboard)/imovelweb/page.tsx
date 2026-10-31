import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin";
import { getFeedProperties } from "@/lib/imovelweb/properties";
import { getFeedSetup, getFeedUrl } from "@/lib/imovelweb/config";
import { FeedError } from "@/lib/imovelweb/errors";
import type { Property } from "@/lib/types";
import { getImovelwebIssues } from "@/lib/imovelweb/feed";
import { ImovelwebStatus } from "@/components/admin/ImovelwebStatus";
import { card, button } from "@/components/admin/ui";

export default async function ImovelwebPage() {
  // O endereço contém uma chave; autorizar aqui também, antes de renderizar os dados da página.
  await requireAdmin();
  let properties: Property[] = [];
  let catalogError: string | null = null;
  try {
    properties = await getFeedProperties({ includeSold: true });
  } catch (error) {
    catalogError =
      error instanceof FeedError && error.reason === "schema_missing"
        ? "A configuração do Imovelweb no banco ainda precisa ser concluída pelo responsável pelo site."
        : "Não foi possível conferir o catálogo completo. Tente novamente antes de configurar o portal.";
    console.error("imovelweb_admin_catalog_unavailable", {
      reason: error instanceof FeedError ? error.reason : "unexpected",
    });
  }
  const selected = properties.filter((p) => p.status === "disponivel");
  const pending = selected.filter((p) => getImovelwebIssues(p).length);
  const setup = getFeedSetup(process.env);
  const url = getFeedUrl(process.env);
  const catalogReady =
    !catalogError && selected.length > 0 && pending.length === 0;
  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-ink">Imovelweb</h1>
      <p className="mt-2 max-w-2xl text-sm text-admin-ink-soft">
        Selecione os imóveis no cadastro para disponibilizá-los no XML. O portal
        consulta o arquivo para atualizar os anúncios.
      </p>
      <section className={`mt-8 max-w-3xl p-6 ${card}`}>
        <h2 className="font-semibold">Situação do XML</h2>
        <p className="mt-3 text-sm text-admin-ink-soft">
          {!setup.enabled
            ? "XML desativado."
            : setup.ready && catalogReady && url
              ? "XML preparado para consulta. A ativação no portal deve ser confirmada separadamente."
              : "XML indisponível. Confira as pendências abaixo."}
        </p>
        {setup.blocked && (
          <p className="mt-3 text-sm text-admin-danger">
            Este ambiente de testes ainda usa o banco de produção. A integração
            está bloqueada até configurar um Supabase separado.
          </p>
        )}
        {setup.issues.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-admin-ink-soft">
            {setup.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
        {setup.ready && !url && (
          <p className="mt-3 text-sm text-admin-danger">
            O endereço público deste ambiente precisa ser configurado
            corretamente pelo responsável pelo site antes de compartilhar a URL.
          </p>
        )}
        {catalogError ? (
          <p className="mt-3 text-sm text-admin-danger" role="alert">
            {catalogError}
          </p>
        ) : (
          <p className="mt-3 text-sm">
            {selected.length} selecionados e disponíveis · {pending.length} com
            pendências
          </p>
        )}
        {!catalogError && (!selected.length || pending.length > 0) && (
          <p className="mt-3 text-sm text-admin-ink-soft">
            A carga fica indisponível enquanto estiver vazia ou houver imóveis
            selecionados com pendências. Isso evita enviar uma lista incompleta.
          </p>
        )}
        {setup.ready && catalogReady && url && (
          <div className="mt-5">
            <label htmlFor="feed-url" className="text-sm font-medium">
              {process.env.VERCEL_ENV === "production"
                ? "URL para cadastrar no Imovelweb"
                : "URL de testes do XML"}
            </label>
            <input
              id="feed-url"
              readOnly
              value={url}
              className="mt-2 w-full rounded-lg border border-admin-border bg-admin-surface-alt p-3 text-xs"
            />
            <p className="mt-2 text-xs text-admin-ink-soft">
              Este endereço contém a chave da integração. Compartilhe apenas com
              o portal.
            </p>
            {process.env.VERCEL_ENV !== "production" && (
              <p className="mt-2 text-xs text-admin-ink-soft">
                Este é um ambiente de testes. Não cadastre esta URL como fonte
                dos anúncios de produção.
              </p>
            )}
          </div>
        )}
        <p className="mt-4 text-sm text-admin-ink-soft">
          Antes de ativar no portal, confirme com o atendimento como ficam os
          anúncios já cadastrados manualmente. O recebimento de leads é
          configurado separadamente no portal.
        </p>
      </section>
      <section className={`mt-6 max-w-3xl p-6 ${card}`}>
        <h2 className="font-semibold">Imóveis selecionados</h2>
        {properties
          .filter((p) => p.publish_imovelweb)
          .map((property) => (
            <div
              key={property.id}
              className="mt-4 border-t border-admin-border pt-4"
            >
              <Link
                href={`/admin/imoveis/${property.id}`}
                className={button.ghost}
              >
                {property.code} · {property.title}
              </Link>
              <ImovelwebStatus property={property} />
            </div>
          ))}
        {!catalogError && properties.length === 0 && (
          <p className="mt-3 text-sm text-admin-ink-soft">
            Nenhum imóvel selecionado. Abra um cadastro para informar o preço e
            escolher sua inclusão.
          </p>
        )}
      </section>
    </div>
  );
}

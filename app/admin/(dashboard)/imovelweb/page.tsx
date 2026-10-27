import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin";
import { getProperties } from "@/lib/queries";
import { getImovelwebIssues } from "@/lib/imovelweb/feed";
import { ImovelwebStatus } from "@/components/admin/ImovelwebStatus";
import { card, button } from "@/components/admin/ui";

export default async function ImovelwebPage() {
  // O endereço contém uma chave; autorizar aqui também, antes de renderizar os dados da página.
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("properties")
    .select("price,publish_imovelweb")
    .limit(1);
  const properties = error ? [] : await getProperties({ includeSold: true });
  const selected = properties.filter(
    (p) => p.publish_imovelweb && p.status === "disponivel",
  );
  const pending = selected.filter((p) => getImovelwebIssues(p).length);
  const token = process.env.IMOVELWEB_FEED_TOKEN?.trim() ?? "";
  const configured =
    process.env.IMOVELWEB_XML_ENABLED === "true" &&
    token.length >= 32 &&
    Boolean(process.env.IMOVELWEB_CODIGO_IMOBILIARIA?.trim());
  const previewHost = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  const origin =
    process.env.VERCEL_ENV === "preview" && previewHost
      ? `https://${previewHost}`
      : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  let url: string | null = null;
  try {
    const value = new URL("/imovelweb/feed.xml", origin);
    value.searchParams.set("token", token);
    url = value.href;
  } catch {
    /* Configuração do domínio ainda pendente. */
  }
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
          {configured
            ? "Feed habilitado."
            : "Feed desativado. A configuração ainda precisa ser concluída."}
        </p>
        {error && (
          <p className="mt-3 text-sm text-admin-danger">
            A configuração do Imovelweb no banco ainda precisa ser concluída
            pelo responsável pelo site.
          </p>
        )}
        <p className="mt-3 text-sm">
          {selected.length} selecionados e disponíveis · {pending.length} com
          pendências
        </p>
        {(!selected.length || pending.length > 0) && (
          <p className="mt-3 text-sm text-admin-ink-soft">
            A carga fica indisponível enquanto estiver vazia ou houver imóveis
            selecionados com pendências. Isso evita enviar uma lista incompleta.
          </p>
        )}
        {configured && url && (
          <div className="mt-5">
            <label htmlFor="feed-url" className="text-sm font-medium">
              URL para cadastrar no Imovelweb
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
          </div>
        )}
        <p className="mt-4 text-sm text-admin-ink-soft">
          Antes de ativar no portal, confirme com o atendimento como ficam os
          anúncios já cadastrados manualmente. O XML não altera o destino dos
          contatos.
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
        {!properties.some((p) => p.publish_imovelweb) && (
          <p className="mt-3 text-sm text-admin-ink-soft">
            Nenhum imóvel selecionado. Abra um cadastro para informar o preço e
            escolher sua inclusão.
          </p>
        )}
      </section>
    </div>
  );
}

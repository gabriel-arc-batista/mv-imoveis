import Link from "next/link";
import { getProperties, getCities } from "@/lib/queries";
import { button, card } from "@/components/admin/ui";

export default async function AdminHomePage() {
  const [all, cities] = await Promise.all([
    getProperties({ includeSold: true, includeOffline: true }),
    getCities(),
  ]);

  const available = all.filter((p) => p.status === "disponivel").length;
  const sold = all.filter((p) => p.status === "vendido").length;
  const featured = all.filter((p) => p.is_featured).length;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-ink">Visão geral</h1>
      <p className="mt-1 text-sm text-admin-ink-soft">
        Resumo do catálogo publicado no site.
      </p>

      <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Imóveis cadastrados", value: all.length },
          { label: "Disponíveis", value: available },
          { label: "Vendidos", value: sold },
          { label: "Em destaque", value: featured },
        ].map((stat) => (
          <div key={stat.label} className={`${card} p-5`}>
            <p className="text-3xl font-semibold text-admin-accent">
              {stat.value}
            </p>
            <p className="mt-1 text-xs font-medium text-admin-ink-soft">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/admin/imoveis/novo" className={button.primary}>
          + Cadastrar imóvel
        </Link>
        <Link href="/admin/cidades" className={button.secondary}>
          Gerenciar cidades e bairros
        </Link>
      </div>

      {cities.length === 0 && (
        <p className="mt-6 max-w-md rounded-lg bg-admin-accent-soft px-4 py-3 text-sm text-admin-accent">
          Nenhuma cidade cadastrada ainda. Cadastre pelo menos uma cidade e um
          bairro em &quot;Cidades e bairros&quot; antes de criar o primeiro imóvel.
        </p>
      )}
    </div>
  );
}

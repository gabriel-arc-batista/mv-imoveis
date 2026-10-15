"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/admin/actions";

const NAV = [
  { href: "/admin", label: "Visão geral", icon: OverviewIcon },
  { href: "/admin/imoveis", label: "Imóveis", icon: BuildingIcon },
  { href: "/admin/cidades", label: "Cidades e bairros", icon: MapIcon },
  { href: "/admin/imovelweb", label: "Imovelweb", icon: SyncIcon },
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:bg-black">
        <div className="flex h-20 items-center gap-3 px-6">
          <Image
            src="/images/logo.jpeg"
            alt="MV Imóveis"
            width={36}
            height={36}
            className="rounded-full"
          />
          <div>
            <p className="text-sm font-semibold text-cream">MV Imóveis</p>
            <p className="text-xs text-cream-soft/70">Painel administrativo</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-4">
          {NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-gold"
                    : "text-cream-soft hover:bg-white/5 hover:text-cream"
                }`}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </Link>
            );
          })}

          <Link
            href="/"
            target="_blank"
            className="focus-ring mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-cream-soft/70 transition-colors hover:bg-white/5 hover:text-gold"
          >
            <ExternalIcon className="h-[18px] w-[18px] shrink-0" />
            Ver site
          </Link>
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <p className="truncate px-3 text-xs text-cream-soft/60">{email}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="focus-ring mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-cream-soft transition-colors hover:bg-white/5 hover:text-cream"
            >
              <LogoutIcon className="h-[18px] w-[18px] shrink-0" />
              Sair
            </button>
          </form>
        </div>
      </aside>

      <header className="flex items-center justify-between gap-4 bg-black px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5">
          <Image
            src="/images/logo.jpeg"
            alt="MV Imóveis"
            width={30}
            height={30}
            className="rounded-full"
          />
          <span className="text-sm font-semibold text-cream">
            Painel MV Imóveis
          </span>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="focus-ring rounded-lg px-3 py-1.5 text-xs font-medium text-cream-soft hover:bg-white/5 hover:text-cream"
          >
            Sair
          </button>
        </form>
      </header>
      <nav className="flex gap-1 overflow-x-auto bg-black px-4 pb-3 lg:hidden">
        {NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`focus-ring shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-white/10 text-gold" : "text-cream-soft"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/"
          target="_blank"
          className="focus-ring shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-cream-soft/70"
        >
          Ver site →
        </Link>
      </nav>
    </>
  );
}

function OverviewIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function BuildingIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" strokeLinecap="round" />
      <path d="M10 21v-3h4v3" />
    </svg>
  );
}

function MapIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M9 20 3.5 18V5L9 7m0 13 6-2m-6 2V7m6 11 5.5 2V7L15 5m0 13V5m0 0L9 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SyncIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M4 9a8 8 0 0 1 14.5-3.5L20 7M20 3v4h-4M20 15a8 8 0 0 1-14.5 3.5L4 17m0 4v-4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExternalIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LogoutIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

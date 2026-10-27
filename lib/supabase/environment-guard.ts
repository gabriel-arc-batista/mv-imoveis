type Environment = Record<string, string | undefined>;

// Identificador público do projeto real da MV. Bloqueio adicional ao isolamento por variáveis.
const PRODUCTION_DATABASE_HOST = "aynqlhfzysscqnzkvbug.supabase.co";

export function assertSafeDatabaseEnvironment(env: Environment = process.env) {
  if (env.VERCEL_ENV === "production") return;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return;
  if (new URL(url).hostname.toLowerCase() === PRODUCTION_DATABASE_HOST) {
    throw new Error(
      "Este ambiente de desenvolvimento usa o banco de produção. Configure um Supabase isolado para continuar.",
    );
  }
}

export function isSafeDatabaseEnvironment(
  env: Environment = process.env,
): boolean {
  try {
    assertSafeDatabaseEnvironment(env);
    return true;
  } catch {
    return false;
  }
}

import { createClient } from "@supabase/supabase-js";

// Cliente com a service role: ignora o RLS. Usar só no servidor, em tarefas
// sem usuário logado (sincronização com o Imovelweb) ou depois de
// requireAdmin(). A chave nunca pode ir para o navegador.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

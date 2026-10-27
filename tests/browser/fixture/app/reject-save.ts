"use server";

// Action exclusiva da fixture: exercita o transporte real sem acessar banco/Auth/Storage.
export async function rejectSave(_previous: unknown, form: FormData) {
  return {
    error: `Erro simulado. Preço recebido: ${form.get("price")}; XML: ${form.get("publish_imovelweb")}.`,
  };
}

"use client";

import { useTransition } from "react";
import { deleteProperty } from "@/app/admin/actions";
import { button } from "@/components/admin/ui";

export function DeletePropertyButton({
  propertyId,
  title,
}: {
  propertyId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmed = window.confirm(
      `Remover definitivamente o imóvel "${title}"? Esta ação não pode ser desfeita.`
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result = await deleteProperty(propertyId);
      if (result?.error) window.alert(result.error);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={button.danger}
    >
      {pending ? "Removendo…" : "Remover"}
    </button>
  );
}

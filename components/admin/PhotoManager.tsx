"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addPhotos,
  deletePhoto,
  reorderPhoto,
  setCoverPhoto,
} from "@/app/admin/actions";
import type { PropertyPhoto } from "@/lib/types";
import { button } from "@/components/admin/ui";

const MAX_PHOTOS = 20;
const MAX_SIZE_MB = 8;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function PhotoManager({
  propertyId,
  photos,
  databaseWritesAllowed,
}: {
  propertyId: string;
  photos: PropertyPhoto[];
  databaseWritesAllowed: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!databaseWritesAllowed) {
      setError(
        "O envio de fotos está bloqueado até configurar um banco separado para este ambiente de testes.",
      );
      return;
    }
    if (!files || files.length === 0) return;
    setError(null);

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setError(`Este imóvel já tem o máximo de ${MAX_PHOTOS} fotos.`);
      return;
    }

    const selected = Array.from(files).slice(0, remaining);
    for (const file of selected) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Envie apenas imagens JPG, PNG ou WebP.");
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`Cada foto deve ter no máximo ${MAX_SIZE_MB}MB.`);
        return;
      }
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const uploaded: { url: string; storage_path: string }[] = [];

      for (const file of selected) {
        const ext = file.name.split(".").pop();
        const path = `${propertyId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("property-photos")
          .upload(path, file, { upsert: false });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("property-photos")
          .getPublicUrl(path);

        uploaded.push({ url: data.publicUrl, storage_path: path });
      }

      await addPhotos(propertyId, uploaded);
    } catch {
      setError("Não foi possível enviar as fotos. Tente novamente.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-admin-ink-soft">
          {photos.length} / {MAX_PHOTOS} fotos
        </p>
        <label className={`${button.secondary} cursor-pointer`}>
          {uploading ? "Enviando…" : "Adicionar fotos"}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            disabled={
              uploading || photos.length >= MAX_PHOTOS || !databaseWritesAllowed
            }
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </div>

      {!databaseWritesAllowed && (
        <p className="mt-2 text-sm text-admin-ink-soft">
          O envio de fotos está bloqueado até configurar um banco separado para
          este ambiente de testes.
        </p>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-admin-danger-soft px-3 py-2 text-sm text-admin-danger">
          {error}
        </p>
      )}

      {photos.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className="overflow-hidden rounded-xl border border-admin-border bg-admin-surface-alt"
            >
              <div className="relative aspect-[4/3]">
                <Image
                  src={photo.url}
                  alt=""
                  fill
                  sizes="200px"
                  className="object-cover"
                />
                {photo.is_cover && (
                  <span className="absolute left-2 top-2 rounded-full bg-admin-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                    Capa
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 px-2 py-2">
                <div className="flex gap-1">
                  <IconButton
                    label="Mover para cima"
                    disabled={i === 0 || pending}
                    onClick={() =>
                      startTransition(() =>
                        reorderPhoto(propertyId, photo.id, "up"),
                      )
                    }
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    label="Mover para baixo"
                    disabled={i === photos.length - 1 || pending}
                    onClick={() =>
                      startTransition(() =>
                        reorderPhoto(propertyId, photo.id, "down"),
                      )
                    }
                  >
                    ↓
                  </IconButton>
                </div>
                <div className="flex gap-1">
                  {!photo.is_cover && (
                    <IconButton
                      label="Definir como capa"
                      disabled={pending}
                      onClick={() =>
                        startTransition(() =>
                          setCoverPhoto(propertyId, photo.id),
                        )
                      }
                    >
                      ★
                    </IconButton>
                  )}
                  <IconButton
                    label="Remover foto"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm("Remover esta foto?")) {
                        startTransition(() =>
                          deletePhoto(propertyId, photo.id, photo.storage_path),
                        );
                      }
                    }}
                  >
                    ✕
                  </IconButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="focus-ring flex h-7 w-7 items-center justify-center rounded-md text-xs text-admin-ink-soft hover:bg-admin-border hover:text-admin-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

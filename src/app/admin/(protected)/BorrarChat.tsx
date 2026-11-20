"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ENLACE, ETIQUETA } from "../ui";

import { deleteRegistrationChatAction, deleteUnlinkedContactAction } from "./mensajes/actions";

type Objetivo = { tipo: "registro"; id: string } | { tipo: "contacto"; id: string };

const TEXT_ACTION = `${ENLACE} text-[13px]`;

function errorMessage(error: string): string {
  if (error === "rate_limited") return "Demasiados cambios, espera un momento.";
  if (error === "conflict") return "Ya está vinculado a un registro.";
  return "No se pudo borrar.";
}

export function BorrarChat({ objetivo }: { objetivo: Objetivo }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result =
        objetivo.tipo === "registro"
          ? await deleteRegistrationChatAction({ registrationId: objetivo.id })
          : await deleteUnlinkedContactAction({ contactId: objetivo.id });
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  const pregunta =
    objetivo.tipo === "registro"
      ? "¿Borrar el historial? Solo en drmr, no en Instagram."
      : "¿Borrar este chat y el contacto? Solo en drmr, no en Instagram.";

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {!confirming ? (
        <button type="button" disabled={isPending} onClick={() => setConfirming(true)} className={TEXT_ACTION}>
          Borrar chat
        </button>
      ) : (
        <>
          <span className={ETIQUETA}>{pregunta}</span>
          <button type="button" disabled={isPending} onClick={handleDelete} className={TEXT_ACTION}>
            {isPending ? "Borrando…" : "Borrar"}
          </button>
          <button type="button" disabled={isPending} onClick={() => setConfirming(false)} className={TEXT_ACTION}>
            Cancelar
          </button>
        </>
      )}
      <span aria-live="polite" className={ETIQUETA}>
        {error}
      </span>
    </div>
  );
}

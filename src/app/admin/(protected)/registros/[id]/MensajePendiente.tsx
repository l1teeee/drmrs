"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ENLACE, ETIQUETA } from "../../../ui";
import { EnviarPorInstagram } from "../../EnviarPorInstagram";
import { markSentManuallyAction } from "../../mensajes/actions";

function errorMessage(error: string): string {
  if (error === "invalid_state") return "Ya cambió de estado.";
  if (error === "rate_limited") return "Demasiados cambios, espera un momento.";
  return "No se pudo guardar.";
}

export function MensajePendiente({
  messageId,
  username,
  text,
}: {
  messageId: string;
  username: string;
  text: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleMarkSent() {
    setError(null);
    startTransition(async () => {
      const result = await markSentManuallyAction({ messageId });
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      <EnviarPorInstagram username={username} text={text} />
      <button
        type="button"
        disabled={isPending}
        onClick={handleMarkSent}
        className={`${ENLACE} text-[14px]`}
      >
        {isPending ? "Marcando…" : "Ya lo envié"}
      </button>
      {error && (
        <p aria-live="polite" className={ETIQUETA}>
          {error}
        </p>
      )}
    </div>
  );
}

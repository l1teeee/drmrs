"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ENLACE, ETIQUETA } from "../ui";

import { recordActivationSentAction } from "./mensajes/actions";

type Feedback = "copied" | "failed" | null;

interface ActivarPorInstagramProps {
  registrationId: string;
  fullName: string;
  username: string;
  text: string;
  activationSentAt: string | null;
  compact?: boolean;
}

const LINK_CLASSES =
  "group relative inline-flex items-center justify-center overflow-hidden border border-azul px-6 py-4 text-[16px] font-medium text-azul transition-colors duration-300 hover:text-white focus-visible:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-azul motion-reduce:transition-none";
const SWEEP_CLASSES =
  "absolute inset-0 origin-left scale-x-0 bg-azul transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none";
const TEXT_ACTION = `${ENLACE} text-[14px]`;

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

export function ActivarPorInstagram({
  registrationId,
  fullName,
  username,
  text,
  activationSentAt,
  compact = false,
}: ActivarPorInstagramProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [error, setError] = useState<string | null>(null);

  const cleanUsername = username.replace(/^@/, "");

  async function handleClick() {
    let result: Feedback = "copied";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      result = "failed";
    }
    setFeedback(result);
    setTimeout(() => {
      setFeedback(null);
    }, 2000);
  }

  function handleMarkSent() {
    setError(null);
    startTransition(async () => {
      const result = await recordActivationSentAction({ registrationId });
      if (!result.ok) {
        setError(
          result.error === "rate_limited"
            ? "Demasiados cambios, espera un momento."
            : "No se pudo guardar.",
        );
        return;
      }
      router.refresh();
    });
  }

  const label =
    feedback === "copied"
      ? "Copiado"
      : feedback === "failed"
        ? "No se pudo copiar"
        : "Activar por Instagram";

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <a
        href={`https://ig.me/m/${encodeURIComponent(cleanUsername)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        aria-live="polite"
        className={compact ? `${ENLACE} text-[14px]` : LINK_CLASSES}
      >
        {compact ? (
          label
        ) : (
          <>
            <span aria-hidden="true" className={SWEEP_CLASSES} />
            <span className="relative">{label}</span>
          </>
        )}
      </a>
      <button
        type="button"
        disabled={isPending}
        onClick={handleMarkSent}
        aria-label={`Ya envié la activación a ${fullName}`}
        className={TEXT_ACTION}
      >
        {isPending ? "Marcando…" : "Ya lo envié"}
      </button>
      {activationSentAt !== null && (
        <span className={ETIQUETA}>
          activación enviada {dateFormatter.format(new Date(activationSentAt))}
        </span>
      )}
      <div aria-live="polite">{error && <span className={ETIQUETA}>{error}</span>}</div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { urlPerfilInstagram } from "@/lib/instagram/enlace-chat";
import { useEsMovil } from "@/lib/instagram/use-es-movil";

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
  "group relative inline-flex items-center justify-center overflow-hidden border border-azul px-4 py-2 text-[14px] font-medium text-azul transition-colors duration-300 hover:text-white focus-visible:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-azul motion-reduce:transition-none";
const SWEEP_CLASSES =
  "absolute inset-0 origin-left scale-x-0 bg-azul transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none";
const TEXT_ACTION = `${ENLACE} text-[13px]`;

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
  const movil = useEsMovil();

  const cleanUsername = username.replace(/^@/, "");

  async function handleClick() {
    let result: Feedback;
    try {
      await navigator.clipboard.writeText(text);
      result = "copied";
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

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="relative inline-flex">
        <a
          href={urlPerfilInstagram(cleanUsername)}
          target={movil ? undefined : "_blank"}
          rel="noopener noreferrer"
          onClick={handleClick}
          className={compact ? `${ENLACE} text-[13px]` : LINK_CLASSES}
        >
          {compact ? (
            "Activar por Instagram"
          ) : (
            <>
              <span aria-hidden="true" className={SWEEP_CLASSES} />
              <span className="relative">Activar por Instagram</span>
            </>
          )}
        </a>
        {feedback !== null && (
          <span
            role="status"
            className="pointer-events-none absolute bottom-full left-0 mb-2 whitespace-nowrap bg-tinta px-2 py-1 font-mono text-[11px] text-white"
          >
            {feedback === "copied" ? "Mensaje copiado" : "No se pudo copiar"}
          </span>
        )}
      </span>
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

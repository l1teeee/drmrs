"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatRegistrationNumber } from "@/domain/registration/expediente-link";

import { ENLACE, ETIQUETA, FILA, NUMERO } from "../../ui";
import { ActivarPorInstagram } from "../ActivarPorInstagram";
import type { EstadoInstagram } from "../estado-instagram";

import { discardMessageAction } from "./actions";

export interface FilaSinEnviarProps {
  id: string;
  registrationId: string;
  registrationNumber: number;
  fullName: string;
  instagramHandle: string;
  status: "QUEUED" | "WAITING_CONTACT" | "WAITING_WINDOW" | "FAILED";
  body: string;
  attempts: number;
  createdAt: string;
  conversacionHref: string;
  estado: EstadoInstagram;
  activacion: { text: string; sentAt: string | null } | null;
}

const TEXT_ACTION = `${ENLACE} text-[14px]`;

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

function statusLabel(status: FilaSinEnviarProps["status"], attempts: number): string {
  if (status === "WAITING_CONTACT") return "Esperando que nos escriba";
  if (status === "WAITING_WINDOW") return "Fuera de la ventana de 24 h";
  if (status === "FAILED") return "Falló";
  return attempts === 0 ? "En cola" : `Reintentando (${attempts})`;
}

function errorMessage(error: string): string {
  if (error === "invalid_state") return "Ya cambió de estado.";
  if (error === "rate_limited") return "Demasiados cambios, espera un momento.";
  return "No se pudo guardar.";
}

export function FilaSinEnviar({
  id,
  registrationId,
  registrationNumber,
  fullName,
  instagramHandle,
  status,
  body,
  attempts,
  createdAt,
  conversacionHref,
  estado,
  activacion,
}: FilaSinEnviarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanHandle = instagramHandle.replace(/^@/, "");

  function handleDiscard() {
    setError(null);
    startTransition(async () => {
      const result = await discardMessageAction({ messageId: id });
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <li className={`grid grid-cols-[auto_1fr] gap-x-4 border-b ${FILA} py-5 sm:gap-x-6`}>
      <span className={`${NUMERO} text-[28px] leading-none`}>
        {formatRegistrationNumber(registrationNumber)}
      </span>
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <Link
            href={conversacionHref}
            className={`text-[18px] font-medium ${ENLACE}`}
          >
            {fullName}
          </Link>
          <span className={ETIQUETA}>@{cleanHandle}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className={ETIQUETA}>{estado.etiqueta}</span>
          <span className={ETIQUETA}>{statusLabel(status, attempts)}</span>
          <span className={ETIQUETA}>{dateFormatter.format(new Date(createdAt))}</span>
        </div>
        <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-[16px] text-tinta/80">{body}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          {activacion !== null && (
            <ActivarPorInstagram
              registrationId={registrationId}
              fullName={fullName}
              username={instagramHandle}
              text={activacion.text}
              activationSentAt={activacion.sentAt}
            />
          )}
          {activacion === null && status !== "FAILED" && (
            <span className={ETIQUETA}>Se envía solo por Instagram.</span>
          )}
          {!confirming ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirming(true)}
              aria-label={`Descartar mensaje de ${fullName}`}
              className={TEXT_ACTION}
            >
              Descartar
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className={ETIQUETA}>¿Descartar este mensaje?</span>
              <button type="button" disabled={isPending} onClick={handleDiscard} className={TEXT_ACTION}>
                Confirmar
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirming(false)}
                className={TEXT_ACTION}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
        <div aria-live="polite">
          {error && <p className={`${ETIQUETA} mt-3`}>{error}</p>}
        </div>
      </div>
    </li>
  );
}

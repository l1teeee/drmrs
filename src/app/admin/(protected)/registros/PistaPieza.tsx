"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Subrayado } from "@/components/Maquina";
import { PIECE_STATUS_LABELS } from "@/domain/registration/piece-status";
import { PIECE_STATUSES, type PieceStatus } from "@/domain/registration/registration";

import { ETIQUETA } from "../../ui";
import { changePieceStatusAction } from "./actions";

interface PistaPiezaProps {
  registrationId: string;
  current: PieceStatus;
  activo: boolean;
}

const LISTO_MS = 4000;
const ACCION =
  "underline underline-offset-4 hover:text-azul focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-azul disabled:cursor-not-allowed disabled:opacity-40";

export function PistaPieza({ registrationId, current, activo }: PistaPiezaProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [asking, setAsking] = useState<PieceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  const listoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showListo(message: string) {
    if (listoTimer.current) clearTimeout(listoTimer.current);
    setListo(message);
    listoTimer.current = setTimeout(() => setListo(null), LISTO_MS);
  }

  function handleAsk(status: PieceStatus) {
    setError(null);
    setListo(null);
    setAsking(status);
  }

  function handleConfirm(newStatus: PieceStatus) {
    setError(null);
    startTransition(async () => {
      const result = await changePieceStatusAction({
        registrationId,
        expectedStatus: current,
        newStatus,
      });
      if (result.ok) {
        setAsking(null);
        showListo(
          activo
            ? "Estado cambiado. Mensaje enviado."
            : "Estado cambiado. El mensaje quedó en cola hasta que conteste.",
        );
        router.refresh();
        return;
      }
      setAsking(null);
      if (result.error === "conflict") {
        setError("Alguien lo cambió antes.");
        router.refresh();
        return;
      }
      if (result.error === "rate_limited") {
        setError("Demasiados cambios, espera un momento.");
        return;
      }
      setError("No se pudo guardar.");
    });
  }

  return (
    <div className="grid gap-2">
      <div className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 ${isPending ? "opacity-60" : ""}`}>
        <span className={ETIQUETA}>estado</span>
        <span className="font-mono text-[14px] text-azul">
          <Subrayado>{PIECE_STATUS_LABELS[current]}</Subrayado>
        </span>
        <select
          aria-label="Cambiar estado"
          value=""
          disabled={isPending}
          onChange={(event) => handleAsk(event.target.value as PieceStatus)}
          className="border-b border-tinta/20 bg-transparent py-1 font-mono text-[13px] text-tinta outline-none focus:border-tinta"
        >
          <option value="" disabled>
            Cambiar estado…
          </option>
          {PIECE_STATUSES.filter((status) => status !== current).map((status) => (
            <option key={status} value={status}>
              {PIECE_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div aria-live="polite" className="font-mono text-[13px] text-tinta/80">
        {asking && (
          <div className="grid gap-1">
            <p>
              ¿Pasar a {PIECE_STATUS_LABELS[asking]}? Se le enviará el mensaje de cambio de estado.
              {!activo && " Está inactiva: el mensaje quedará en cola hasta que conteste."}
            </p>
            <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleConfirm(asking)}
                className={ACCION}
              >
                Sí
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setAsking(null)}
                className={ACCION}
              >
                No
              </button>
            </p>
          </div>
        )}
        {error && <p>{error}</p>}
        {listo && <p>{listo}</p>}
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";

import { Subrayado } from "@/components/Maquina";
import { PIECE_STATUS_LABELS } from "@/domain/registration/piece-status";
import { PIECE_STATUSES, type PieceStatus } from "@/domain/registration/registration";

import { changePieceStatusAction } from "./actions";

interface PistaPiezaProps {
  registrationId: string;
  current: PieceStatus;
}

const ESTADO =
  "font-mono text-[14px] transition-colors duration-300 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-azul disabled:cursor-default motion-reduce:transition-none";
const ACCION =
  "underline underline-offset-4 hover:text-azul focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-azul disabled:cursor-not-allowed disabled:opacity-40";

function estadoClase(position: number, currentPosition: number) {
  if (position < currentPosition) {
    return "text-tinta/80 hover:text-azul";
  }
  if (position === currentPosition) {
    return "text-azul";
  }
  return "text-tinta/35 hover:text-azul";
}

export function PistaPieza({ registrationId, current }: PistaPiezaProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [asking, setAsking] = useState<PieceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentPosition = PIECE_STATUSES.indexOf(current);

  function handleAsk(status: PieceStatus) {
    setError(null);
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
      <div className={`flex flex-wrap items-baseline ${isPending ? "opacity-60" : ""}`}>
        {PIECE_STATUSES.map((status, position) => (
          <Fragment key={status}>
            {position > 0 && (
              <span aria-hidden="true" className="whitespace-pre font-mono text-[14px] text-tinta/35">
                {" · "}
              </span>
            )}
            <button
              type="button"
              disabled={isPending || status === current}
              aria-current={status === current ? "step" : undefined}
              onClick={() => handleAsk(status)}
              className={`${ESTADO} ${estadoClase(position, currentPosition)}`}
            >
              {status === current ? (
                <Subrayado>{PIECE_STATUS_LABELS[status]}</Subrayado>
              ) : (
                PIECE_STATUS_LABELS[status]
              )}
            </button>
          </Fragment>
        ))}
      </div>

      <div aria-live="polite" className="font-mono text-[13px] text-tinta/80">
        {asking && (
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span>¿Pasar a {PIECE_STATUS_LABELS[asking]}?</span>
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
        )}
        {error && <p>{error}</p>}
      </div>
    </div>
  );
}

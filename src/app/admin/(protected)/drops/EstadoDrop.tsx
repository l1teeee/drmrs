"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DROP_STATUSES, type DropStatus } from "@/domain/drop/drop";
import { ENLACE, ETIQUETA } from "../../ui";
import { cambiarEstadoDropAction } from "./actions";

const LABELS: Record<DropStatus, string> = { REGISTRO: "Abrir registro", CERRADO: "Cerrar registro", PREPARACION: "Pasar a preparación" };
export function EstadoDrop({ id, status, otro }: { id: string; status: DropStatus; otro?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  function change(next: DropStatus) {
    if (next === "REGISTRO" && otro && !confirming) { setConfirming(true); return; }
    setError("");
    startTransition(async () => {
      const result = await cambiarEstadoDropAction({ dropId: id, expectedStatus: status, newStatus: next });
      if (result.kind === "updated") { setConfirming(false); router.refresh(); return; }
      setConfirming(false);
      setError(result.kind === "stale" ? "Alguien cambió este drop; recarga." : result.kind === "needs_duration" ? "Pon la duración del pre-registro antes de abrirlo." : "No se pudo guardar.");
    });
  }
  return <span className="flex flex-wrap items-baseline gap-3 text-[13px]">
    {confirming ? <><span className={ETIQUETA}>Se cerrará el registro de {otro}. ¿Abrir?</span><button className={ENLACE} disabled={pending} onClick={() => change("REGISTRO")}>Sí</button><button className={ENLACE} disabled={pending} onClick={() => setConfirming(false)}>No</button></> : DROP_STATUSES.filter((next) => next !== status).map((next) => <button key={next} className={ENLACE} disabled={pending} onClick={() => change(next)}>{LABELS[next]}</button>)}
    {error && <span role="alert" className={ETIQUETA}>{error}</span>}
  </span>;
}

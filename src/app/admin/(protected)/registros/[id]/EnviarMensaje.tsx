"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { TemplateKey } from "@/domain/messaging/message-template";

import { queueInstagramMessageAction } from "../../mensajes/actions";
import { BotonArchivo, CAMPO, CAMPO_AREA, ETIQUETA } from "../../../ui";

const SELECT = `${CAMPO} max-w-md disabled:cursor-not-allowed disabled:opacity-40`;
const TEXTAREA = `${CAMPO_AREA} disabled:cursor-not-allowed disabled:opacity-40`;
const OPTION = "bg-papel text-tinta";

type Choice = Exclude<TemplateKey, "ACTIVACION"> | "LIBRE";

const CHOICE_PREVIEWS: Record<Choice, string> = {
  BIENVENIDA: "Se enviará la plantilla Bienvenida con los datos de este registro.",
  CAMBIO_ESTADO: "Se enviará la plantilla Cambio de estado con los datos de este registro.",
  RECORDATORIO_DROP: "Se enviará la plantilla Recordatorio del drop con los datos de este registro.",
  LIBRE: "Se enviará el texto que escribas, tal cual.",
};

export function EnviarMensaje({ registrationId }: { registrationId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [choice, setChoice] = useState<Choice>("BIENVENIDA");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const isFree = choice === "LIBRE";
  const emptyFreeText = isFree && body.trim() === "";

  function handleSend() {
    setResult(null);
    startTransition(async () => {
      const response = await queueInstagramMessageAction(
        isFree ? { registrationId, body } : { registrationId, templateKey: choice },
      );
      if (!response.ok) {
        setResult(
          response.error === "rate_limited"
            ? "Demasiados envíos, espera un momento."
            : "No se pudo enviar.",
        );
        return;
      }
      if (response.status === "QUEUED") {
        setResult("En camino.");
      } else {
        setResult(
          "Quedó en la conversación. Como aún no nos escribe, mándalo tú con Enviar por Instagram.",
        );
      }
      if (isFree) setBody("");
      router.refresh();
    });
  }

  return (
    <section className="grid gap-5">
      <h2 className={ETIQUETA}>Responder</h2>
      <select
        aria-label="Mensaje"
        value={choice}
        disabled={isPending}
        onChange={(event) => {
          setResult(null);
          setChoice(event.target.value as Choice);
        }}
        className={SELECT}
      >
        <option value="BIENVENIDA" className={OPTION}>
          Bienvenida
        </option>
        <option value="CAMBIO_ESTADO" className={OPTION}>
          Cambio de estado
        </option>
        <option value="RECORDATORIO_DROP" className={OPTION}>
          Recordatorio del drop
        </option>
        <option value="LIBRE" className={OPTION}>
          Mensaje libre
        </option>
      </select>
      <p className={ETIQUETA}>{CHOICE_PREVIEWS[choice]}</p>
      {isFree && (
        <textarea
          aria-label="Mensaje libre"
          rows={4}
          maxLength={1000}
          value={body}
          disabled={isPending}
          onChange={(event) => setBody(event.target.value)}
          className={TEXTAREA}
        />
      )}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <BotonArchivo disabled={isPending || emptyFreeText} onClick={handleSend}>
          {isPending ? "Enviando…" : "Enviar por Instagram"}
        </BotonArchivo>
        <p aria-live="polite" className={ETIQUETA}>
          {result}
        </p>
      </div>
    </section>
  );
}

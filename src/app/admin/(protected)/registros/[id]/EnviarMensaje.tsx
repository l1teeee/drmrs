"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import type { TemplateKey } from "@/domain/messaging/message-template";

import { queueInstagramMessageAction } from "../../mensajes/actions";
import { BotonArchivo, CAMPO_AREA, ENLACE, ETIQUETA } from "../../../ui";

const MAX_LENGTH = 1000;
const RESULTADO_MS = 4000;

interface EnviarMensajeProps {
  registrationId: string;
  activo: boolean;
  plantillas: Array<{ key: TemplateKey; label: string; texto: string }>;
}

export function EnviarMensaje({ registrationId, activo, plantillas }: EnviarMensajeProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [texto, setTexto] = useState("");
  const [plantilla, setPlantilla] = useState<{ key: TemplateKey; texto: string } | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const resultadoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const vacio = texto.trim() === "";

  function showResultado(message: string) {
    if (resultadoTimer.current) clearTimeout(resultadoTimer.current);
    setResultado(message);
    resultadoTimer.current = setTimeout(() => setResultado(null), RESULTADO_MS);
  }

  function handlePlantilla(key: TemplateKey, textoPlantilla: string) {
    setResultado(null);
    setConfirmando(false);
    setTexto(textoPlantilla);
    setPlantilla({ key, texto: textoPlantilla });
    textareaRef.current?.focus();
  }

  function enviar() {
    setResultado(null);
    startTransition(async () => {
      const response = await queueInstagramMessageAction(
        plantilla && plantilla.texto === texto
          ? { registrationId, templateKey: plantilla.key }
          : { registrationId, body: texto },
      );
      if (!response.ok) {
        setConfirmando(false);
        setResultado(
          response.error === "rate_limited"
            ? "Demasiados cambios, espera un momento."
            : "No se pudo enviar.",
        );
        return;
      }
      setTexto("");
      setPlantilla(null);
      setConfirmando(false);
      showResultado(response.status === "QUEUED" ? "Enviado." : "En cola: se enviará cuando conteste.");
      router.refresh();
    });
  }

  function handleSend() {
    if (vacio || isPending) return;
    if (!activo && !confirmando) {
      setConfirmando(true);
      return;
    }
    enviar();
  }

  return (
    <section className="grid gap-3">
      {plantillas.length > 0 && (
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className={ETIQUETA}>Plantillas:</span>
          {plantillas.map((entry) => (
            <button
              key={entry.key}
              type="button"
              disabled={isPending}
              onClick={() => handlePlantilla(entry.key, entry.texto)}
              className={`${ENLACE} text-[14px]`}
            >
              {entry.label}
            </button>
          ))}
        </p>
      )}
      <textarea
        ref={textareaRef}
        rows={3}
        maxLength={MAX_LENGTH}
        placeholder="Escribe un mensaje…"
        aria-label="Mensaje"
        value={texto}
        disabled={isPending}
        onChange={(event) => {
          setConfirmando(false);
          setTexto(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            handleSend();
          }
        }}
        className={CAMPO_AREA}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <span className={`${ETIQUETA} tabular-nums`}>
          {texto.length}/{MAX_LENGTH}
        </span>
        <BotonArchivo disabled={vacio || isPending} onClick={handleSend}>
          Enviar
        </BotonArchivo>
      </div>
      {confirmando && (
        <div className="grid gap-2">
          <p className={ETIQUETA}>
            Está inactiva: pasaron más de 24 h desde su último mensaje. Primero envíale la activación;
            este mensaje quedará en cola y se enviará cuando conteste.
          </p>
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <button type="button" disabled={isPending} onClick={enviar} className={`${ENLACE} text-[14px]`}>
              Sí, dejar en cola
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmando(false)}
              className={`${ENLACE} text-[14px]`}
            >
              No
            </button>
          </p>
        </div>
      )}
      <p aria-live="polite" className={ETIQUETA}>
        {resultado}
      </p>
    </section>
  );
}

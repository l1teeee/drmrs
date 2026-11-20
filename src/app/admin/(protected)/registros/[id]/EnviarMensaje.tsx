"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import type { TemplateKey } from "@/domain/messaging/message-template";

import { queueInstagramMessageAction } from "../../mensajes/actions";
import { CAMPO_AREA, ENLACE, ETIQUETA, REGLA } from "../../../ui";

const MAX_LENGTH = 1000;
const RESULTADO_MS = 4000;

interface EnviarMensajeProps {
  registrationId: string;
  activo: boolean;
  plantillas: Array<{ key: TemplateKey; label: string; texto: string }>;
  todasPlantillas: Array<{ key: TemplateKey; label: string; texto: string }>;
}

export function EnviarMensaje({
  registrationId,
  activo,
  plantillas,
  todasPlantillas,
}: EnviarMensajeProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [texto, setTexto] = useState("");
  const [plantilla, setPlantilla] = useState<{ key: TemplateKey; texto: string } | null>(null);
  const [verTodas, setVerTodas] = useState(false);
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
    setPlantilla(key === "ACTIVACION" ? null : { key, texto: textoPlantilla });
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
    <section className="grid gap-2">
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className={ETIQUETA}>Plantillas:</span>
        {plantillas.map((entry) => (
          <button
            key={entry.key}
            type="button"
            disabled={isPending}
            onClick={() => handlePlantilla(entry.key, entry.texto)}
            className={`${ENLACE} text-[13px]`}
          >
            {entry.label}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={verTodas}
          aria-controls="todas-las-plantillas"
          onClick={() => setVerTodas(!verTodas)}
          className={`${ENLACE} text-[13px]`}
        >
          {verTodas ? "Ocultar plantillas" : "Todas las plantillas"}
        </button>
      </p>
      {verTodas && (
        <ul id="todas-las-plantillas" className={`grid gap-1 border ${REGLA} p-2`}>
          {todasPlantillas.map((entry) => (
            <li key={entry.key}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  handlePlantilla(entry.key, entry.texto);
                  setVerTodas(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setVerTodas(false);
                }}
                className="grid w-full gap-1 px-2.5 py-1.5 text-left hover:bg-papel focus-visible:outline focus-visible:outline-1 focus-visible:outline-azul"
              >
                <span className="text-[13px] font-medium">{entry.label}</span>
                <span className={`${ETIQUETA} line-clamp-2 [overflow-wrap:anywhere]`}>{entry.texto}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={textareaRef}
        rows={2}
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
        className={`${CAMPO_AREA} py-2`}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <span className={`${ETIQUETA} tabular-nums`}>
          {texto.length}/{MAX_LENGTH}
        </span>
        <button
          type="button"
          disabled={vacio || isPending}
          onClick={handleSend}
          className="border border-azul px-4 py-2 text-[14px] font-medium text-azul transition-colors duration-300 hover:bg-azul hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-azul disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
        >
          Enviar
        </button>
      </div>
      {confirmando && (
        <div className="grid gap-2">
          <p className={ETIQUETA}>
            Está inactiva: pasaron más de 24 h desde su último mensaje. Primero envíale la activación;
            este mensaje quedará en cola y se enviará cuando conteste.
          </p>
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <button type="button" disabled={isPending} onClick={enviar} className={`${ENLACE} text-[13px]`}>
              Sí, dejar en cola
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmando(false)}
              className={`${ENLACE} text-[13px]`}
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

"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  DROP_DATE_LABEL,
  renderMessageTemplate,
  TEMPLATE_VARIABLES,
  type TemplateKey,
} from "@/domain/messaging/message-template";

import { BotonArchivo, CAMPO_AREA, ENLACE, ETIQUETA, REGLA } from "../../ui";
import { updateTemplateAction } from "../registros/actions";

export interface EditorPlantillaProps {
  templateKey: TemplateKey;
  title: string;
  initialBody: string;
  updatedAtLabel: string;
}

interface Feedback {
  message: string;
  failed: boolean;
}

const MAX_LENGTH = 1000;
const SAMPLE_VALUES: Record<string, string> = {
  nombre: "Julián",
  numero: "0023",
  talla: "M",
  estado: "apartado",
  link: "drmr.com.mx/expediente/0023-…",
  fecha_drop: DROP_DATE_LABEL,
};

export function EditorPlantilla({
  templateKey,
  title,
  initialBody,
  updatedAtLabel,
}: EditorPlantillaProps) {
  const router = useRouter();
  const [body, setBody] = useState(initialBody);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCursorRef = useRef<number | null>(null);

  useEffect(() => {
    if (abierta) {
      textareaRef.current?.focus();
    }
  }, [abierta]);

  useLayoutEffect(() => {
    const cursor = pendingCursorRef.current;
    const textarea = textareaRef.current;
    if (cursor === null || textarea === null) {
      return;
    }
    pendingCursorRef.current = null;
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
  }, [body]);

  function handleInsertVariable(variable: string) {
    const textarea = textareaRef.current;
    if (textarea === null) {
      return;
    }
    const token = `{${variable}}`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = body.slice(0, start) + token + body.slice(end);
    if (next.length > MAX_LENGTH) {
      setFeedback({
        message: "Llegaste al límite de 1000 caracteres.",
        failed: true,
      });
      return;
    }
    pendingCursorRef.current = start + token.length;
    setBody(next);
    setFeedback(null);
  }

  function handleSave() {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateTemplateAction({
        key: templateKey,
        body,
      });
      if (result.ok) {
        setFeedback({ message: "Guardado.", failed: false });
        setAbierta(false);
        router.refresh();
        return;
      }
      if (result.error === "unknown_variables") {
        setFeedback({
          message: `Variables desconocidas: ${result.variables.join(", ")}.`,
          failed: true,
        });
        return;
      }
      if (result.error === "rate_limited") {
        setFeedback({
          message: "Demasiados cambios, espera un momento.",
          failed: true,
        });
        return;
      }
      setFeedback({ message: "No se pudo guardar.", failed: true });
    });
  }

  return (
    <section
      className={`grid content-start gap-4 border-t ${REGLA} pt-6 ${abierta ? "md:col-span-2 xl:col-span-3" : ""}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[20px] font-medium tracking-[-0.02em]">{title}</h2>
        <span className={ETIQUETA}>editada {updatedAtLabel}</span>
      </div>
      {!abierta ? (
        <>
          <p className="line-clamp-4 whitespace-pre-wrap break-words text-[15px] text-tinta/70">
            {renderMessageTemplate(body, SAMPLE_VALUES)}
          </p>
          {feedback !== null && !feedback.failed ? (
            <span aria-live="polite" className={ETIQUETA}>
              {feedback.message}
            </span>
          ) : null}
          <button
            type="button"
            aria-expanded={false}
            aria-controls={`editor-${templateKey}`}
            onClick={() => setAbierta(true)}
            className={`${ENLACE} justify-self-start text-[14px]`}
          >
            Editar
          </button>
        </>
      ) : (
      <div id={`editor-${templateKey}`} className="grid gap-4">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[13px] text-tinta/60">
        <span>Variables:</span>
        {TEMPLATE_VARIABLES.map((variable) => (
          <button
            key={variable}
            type="button"
            onClick={() => handleInsertVariable(variable)}
            className={`${ENLACE} text-tinta`}
          >
            {`{${variable}}`}
          </button>
        ))}
      </p>
      <div className="grid gap-1">
        <textarea
          ref={textareaRef}
          rows={5}
          maxLength={MAX_LENGTH}
          aria-label={title}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            setFeedback(null);
          }}
          className={CAMPO_AREA}
        />
        <span className={`${ETIQUETA} justify-self-end tabular-nums`}>
          {body.length}/{MAX_LENGTH}
        </span>
      </div>
      <div className="grid gap-1">
        <span className={ETIQUETA}>vista previa</span>
        <p className="whitespace-pre-wrap break-words text-[16px] text-tinta/80">
          {renderMessageTemplate(body, SAMPLE_VALUES)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <BotonArchivo
          disabled={isPending || body === initialBody}
          onClick={handleSave}
        >
          Guardar
        </BotonArchivo>
        {feedback !== null && feedback.failed ? (
          <span role="alert" className="text-[14px] text-tinta">
            {feedback.message}
          </span>
        ) : (
          <span aria-live="polite" className={ETIQUETA}>
            {feedback?.message}
          </span>
        )}
        <button
          type="button"
          disabled={isPending}
          aria-expanded={true}
          aria-controls={`editor-${templateKey}`}
          onClick={() => {
            setBody(initialBody);
            setFeedback(null);
            setAbierta(false);
          }}
          className={`${ENLACE} text-[14px]`}
        >
          {body === initialBody ? "Cerrar" : "Cancelar"}
        </button>
      </div>
      </div>
      )}
    </section>
  );
}

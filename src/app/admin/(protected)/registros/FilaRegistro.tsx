"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { formatRegistrationNumber } from "@/domain/registration/expediente-link";
import { SIZE_LABELS } from "@/domain/registration/piece-status";
import type { PieceStatus, Size } from "@/domain/registration/registration";

import { ENLACE, ETIQUETA, FILA, NUMERO } from "../../ui";
import { regenerateExpedienteLinkAction } from "./actions";
import { PistaPieza } from "./PistaPieza";

export interface FilaRegistroProps {
  id: string;
  conversacionHref: string;
  registrationNumber: number;
  fullName: string;
  instagramHandle: string;
  size: Size;
  pieceStatus: PieceStatus;
  expedienteUrl: string;
}

const ACCION = `${ENLACE} text-[14px]`;

export function FilaRegistro({
  id,
  conversacionHref,
  registrationNumber,
  fullName,
  instagramHandle,
  size,
  pieceStatus,
  expedienteUrl,
}: FilaRegistroProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [confirmingNewLink, setConfirmingNewLink] = useState(false);
  const newLinkTriggerRef = useRef<HTMLButtonElement>(null);
  const confirmNewLinkRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingNewLink = useRef(false);

  useEffect(() => {
    if (confirmingNewLink) {
      confirmNewLinkRef.current?.focus();
    } else if (wasConfirmingNewLink.current) {
      newLinkTriggerRef.current?.focus();
    }
    wasConfirmingNewLink.current = confirmingNewLink;
  }, [confirmingNewLink]);

  const cleanHandle = instagramHandle.replace(/^@/, "");
  const formattedNumber = formatRegistrationNumber(registrationNumber);

  async function handleCopyLink() {
    setActionError(null);
    try {
      await navigator.clipboard.writeText(expedienteUrl);
    } catch {
      setActionError("No se pudo copiar.");
      return;
    }
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  function handleConfirmNewLink() {
    setActionError(null);
    startTransition(async () => {
      const result = await regenerateExpedienteLinkAction({
        registrationId: id,
      });
      if (!result.ok) {
        if (result.error === "rate_limited") {
          setActionError("Demasiados cambios, espera un momento.");
        } else {
          setActionError("No se pudo guardar.");
        }
        return;
      }
      setConfirmingNewLink(false);
      router.refresh();
    });
  }

  return (
    <li
      className={`grid gap-x-8 gap-y-4 border-b ${FILA} py-6 md:grid-cols-[minmax(0,1fr)_auto]`}
    >
      <div className="flex items-start gap-4 md:gap-6">
        <span className={`${NUMERO} text-[32px] leading-none md:text-[40px]`}>
          {formattedNumber}
        </span>
        <div className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-[18px]">{fullName}</span>
            <a
              href={`https://instagram.com/${cleanHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${ENLACE} break-all text-[16px]`}
            >
              @{cleanHandle}
            </a>
            <span className={ETIQUETA}>talla {SIZE_LABELS[size]}</span>
          </div>
          <PistaPieza registrationId={id} current={pieceStatus} />
        </div>
      </div>

      <div className="grid content-start gap-2 md:justify-items-end">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 md:justify-end">
          <Link href={conversacionHref} className={ACCION}>
            Conversación
          </Link>
          <button
            type="button"
            aria-label={`Copiar link de ${fullName}`}
            onClick={handleCopyLink}
            className={ACCION}
          >
            {copied ? "Copiado" : "Copiar link"}
          </button>

          {!confirmingNewLink ? (
            <button
              ref={newLinkTriggerRef}
              type="button"
              disabled={isPending}
              aria-label={`Generar nuevo link para ${fullName}`}
              onClick={() => setConfirmingNewLink(true)}
              className={ACCION}
            >
              Nuevo link
            </button>
          ) : (
            <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className={ETIQUETA}>El link anterior deja de servir.</span>
              <button
                ref={confirmNewLinkRef}
                type="button"
                disabled={isPending}
                aria-label={`Confirmar nuevo link para ${fullName}`}
                onClick={handleConfirmNewLink}
                className={ACCION}
              >
                {isPending ? "Guardando…" : "Confirmar"}
              </button>
              <button
                type="button"
                disabled={isPending}
                aria-label="Cancelar"
                onClick={() => setConfirmingNewLink(false)}
                className={ACCION}
              >
                Cancelar
              </button>
            </span>
          )}
        </div>
        <div aria-live="polite">
          {copied && <span className="sr-only">Link copiado</span>}
          {actionError && (
            <p role="alert" className="text-[14px] text-tinta">
              {actionError}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

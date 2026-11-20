"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { adminHref } from "@/infrastructure/admin/admin-path";

import { ENLACE } from "../../../ui";

const CLAVE_FICHA_OCULTA = "drmr:ficha-oculta";
const EVENTO_FICHA = "drmr:ficha";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENTO_FICHA, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENTO_FICHA, onChange);
  };
}

function leerOculta(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_FICHA_OCULTA) === "1";
  } catch {
    return false;
  }
}

function guardarOculta(oculta: boolean): void {
  try {
    if (oculta) {
      window.localStorage.setItem(CLAVE_FICHA_OCULTA, "1");
    } else {
      window.localStorage.removeItem(CLAVE_FICHA_OCULTA);
    }
  } catch {
    // Storage blocked (private mode): the preference is not remembered and the sheet stays visible.
  }
  window.dispatchEvent(new Event(EVENTO_FICHA));
}

interface DisposicionConversacionProps {
  ficha: React.ReactNode;
  encabezado: React.ReactNode;
  children: React.ReactNode;
}

export function DisposicionConversacion({
  ficha,
  encabezado,
  children,
}: DisposicionConversacionProps) {
  const oculta = useSyncExternalStore(subscribe, leerOculta, () => false);

  return (
    <main
      className={`grid gap-6 md:min-h-0 md:flex-1 md:gap-10 ${oculta ? "" : "md:grid-cols-[minmax(200px,250px)_minmax(0,1fr)]"}`}
    >
      {!oculta && <div className="flex flex-col gap-4 md:min-h-0 md:overflow-y-auto">{ficha}</div>}

      <div className="flex min-w-0 flex-col gap-4 md:min-h-0">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <Link href={adminHref("/registros")} className={`${ENLACE} text-[13px]`}>
            ← Registros
          </Link>
          <button
            type="button"
            aria-pressed={!oculta}
            onClick={() => guardarOculta(!oculta)}
            className={`${ENLACE} text-[13px]`}
          >
            {oculta ? "Ver ficha" : "Ocultar ficha"}
          </button>
        </div>
        {encabezado}
        {children}
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { adminHref } from "@/infrastructure/admin/admin-path";

import { ENLACE } from "../../../ui";

const CLAVE_FICHA_VISIBLE = "drmr:ficha-visible";
const EVENTO_FICHA = "drmr:ficha";

let fichaVisibleEnMemoria = false;

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENTO_FICHA, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENTO_FICHA, onChange);
  };
}

function leerVisible(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_FICHA_VISIBLE) === "1";
  } catch {
    return fichaVisibleEnMemoria;
  }
}

function guardarVisible(visible: boolean): void {
  fichaVisibleEnMemoria = visible;
  try {
    if (visible) {
      window.localStorage.setItem(CLAVE_FICHA_VISIBLE, "1");
    } else {
      window.localStorage.removeItem(CLAVE_FICHA_VISIBLE);
    }
  } catch {
    // Storage blocked (private mode): the in-memory value keeps the toggle working for this page.
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
  const visible = useSyncExternalStore(subscribe, leerVisible, () => false);

  return (
    <main
      className={`grid md:min-h-0 md:flex-1 transition-[grid-template-columns,column-gap] duration-300 ease-out motion-reduce:transition-none ${visible ? "md:grid-cols-[250px_minmax(0,1fr)] md:gap-x-8" : "md:grid-cols-[0px_minmax(0,1fr)] md:gap-x-0"}`}
    >
      <div
        id="ficha-expediente"
        inert={!visible}
        className={`grid min-w-0 overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none md:min-h-0 md:grid-rows-[1fr] ${visible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="min-h-0 overflow-hidden md:w-[250px] md:overflow-x-hidden md:overflow-y-auto">
          <div className="flex flex-col gap-4 pb-5 md:pb-0">{ficha}</div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 md:min-h-0">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <Link href={adminHref("/registros")} className={`${ENLACE} text-[13px]`}>
            ← Registros
          </Link>
          <button
            type="button"
            aria-expanded={visible}
            aria-controls="ficha-expediente"
            onClick={() => guardarVisible(!visible)}
            className={`${ENLACE} text-[13px]`}
          >
            {visible ? "Ocultar ficha" : "Ver ficha"}
          </button>
        </div>
        {encabezado}
        {children}
      </div>
    </main>
  );
}

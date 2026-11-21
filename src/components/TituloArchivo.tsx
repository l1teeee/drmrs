"use client";

import { useId, useState } from "react";
import Image from "next/image";

import { archivoBlack, instrumentSerif } from "@/lib/fuentes";

type TituloArchivoProps = {
  nombre: string;
  piezas: number;
  abierto: boolean;
};

export function TituloArchivo({ nombre, piezas, abierto }: TituloArchivoProps) {
  const [desplegado, setDesplegado] = useState(false);
  const idDetalle = useId();

  return (
    <div>
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
        <button
          type="button"
          aria-expanded={desplegado}
          aria-controls={idDetalle}
          onClick={() => setDesplegado((anterior) => !anterior)}
          className={`transition-transform duration-300 hover:scale-110 motion-reduce:transition-none ${desplegado ? "rotate-45" : "motion-safe:animate-latido"}`}
        >
          <Image src="/drmr-isotipo.svg" alt="" width={169} height={160} className="h-10 w-auto" />
          <span className="sr-only">{desplegado ? "Ocultar qué es el archivo" : "Qué es el archivo"}</span>
        </button>
          {/* Hand-drawn pointer: tells people the isotype opens the info. */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute left-full top-1/2 ml-2 flex -translate-y-1/2 items-center gap-1 transition-opacity duration-300 motion-reduce:transition-none ${desplegado ? "opacity-0" : "opacity-100"}`}
          >
            <svg viewBox="0 0 48 24" fill="none" className="h-5 w-10 text-white/80 motion-safe:animate-senala">
              <path d="M46 10 C 34 4, 20 12, 6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M6 12 L 12 8 M6 12 L 12 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className={`${instrumentSerif.className} whitespace-nowrap italic text-[16px] text-white/80`}>¿qué es?</span>
          </span>
        </div>
        <h1 className={`${archivoBlack.className} text-[clamp(28px,3vw,44px)] leading-none tracking-[-0.03em]`}>
          {nombre}
        </h1>
      </div>

      <div
        id={idDetalle}
        inert={!desplegado}
        className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out motion-reduce:transition-none ${desplegado ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div
            className={`mx-auto max-w-[44ch] pt-6 transition-transform duration-500 ease-out motion-reduce:transition-none ${desplegado ? "translate-y-0" : "-translate-y-3"}`}
          >
            <p className="text-[clamp(20px,2vw,28px)] font-bold leading-none tracking-[-0.035em]">
              El archivo se va a poder <span className="font-light">vestir.</span>
            </p>
            <p className="mt-3 text-[15px] leading-[1.5] text-white/80">
              {abierto
                ? `En el archivo subimos a gente que ya se movió. Ahora abrimos el registro: quien esté aquí entra 24 horas antes que el público al ${nombre}. ${piezas} piezas numeradas.`
                : `En el archivo subimos a gente que ya se movió. ${nombre}: ${piezas} piezas numeradas.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

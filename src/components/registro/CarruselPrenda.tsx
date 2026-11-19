"use client";

import Image from "next/image";
import { type PointerEvent, useRef, useState } from "react";

const VISTAS = [
  {
    src: "/pieza-trazo.png",
    nombre: "espalda",
    alt: "Boceto de la espalda de la pieza con notas de taller. El gráfico real no aparece.",
  },
  { src: "/prenda/frente.webp", nombre: "frente", alt: "Boceto del frente de la pieza con notas de taller." },
  { src: "/prenda/costado.webp", nombre: "costado", alt: "Boceto de la pieza vista de costado." },
  { src: "/prenda/doblada.webp", nombre: "doblada", alt: "Boceto de la pieza doblada." },
  { src: "/prenda/detalle.webp", nombre: "detalle", alt: "Boceto de detalle del cuello y el puño." },
];

const DISTANCIA_DESLIZAR = 40;

export function CarruselPrenda() {
  const [actual, setActual] = useState(0);
  const inicioArrastre = useRef<number | null>(null);

  function irA(indice: number) {
    setActual((indice + VISTAS.length) % VISTAS.length);
  }

  function alPresionar(evento: PointerEvent<HTMLDivElement>) {
    inicioArrastre.current = evento.clientX;
  }

  function alSoltar(evento: PointerEvent<HTMLDivElement>) {
    const inicio = inicioArrastre.current;
    inicioArrastre.current = null;
    if (inicio === null) return;
    const recorrido = evento.clientX - inicio;
    if (Math.abs(recorrido) < DISTANCIA_DESLIZAR) return;
    irA(actual + (recorrido < 0 ? 1 : -1));
  }

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Vistas de la pieza"
      className="flex min-h-[50svh] flex-1 flex-col gap-4 md:min-h-0"
    >
      <div
        onPointerDown={alPresionar}
        onPointerUp={alSoltar}
        className="relative min-h-0 flex-1 touch-pan-y select-none"
      >
        {VISTAS.map((vista, indice) => {
          const visible = indice === actual;
          return (
            <figure
              key={vista.src}
              aria-roledescription="vista"
              aria-label={`${indice + 1} de ${VISTAS.length}: ${vista.nombre}`}
              aria-hidden={!visible}
              className={`absolute inset-0 transition-[opacity,scale] duration-700 ease-out motion-reduce:transition-none ${visible ? "scale-100 opacity-100" : "pointer-events-none scale-[0.98] opacity-0"}`}
            >
              <Image
                src={vista.src}
                alt={vista.alt}
                fill
                draggable={false}
                sizes="(min-width: 768px) 45vw, 90vw"
                className="object-contain brightness-0 invert"
              />
            </figure>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => irA(actual - 1)}
          aria-label="Vista anterior"
          className="px-2 py-1 hover:opacity-70"
        >
          ←
        </button>
        <p aria-live="polite">
          {VISTAS[actual].nombre} · {actual + 1}/{VISTAS.length}
        </p>
        <button
          type="button"
          onClick={() => irA(actual + 1)}
          aria-label="Vista siguiente"
          className="px-2 py-1 hover:opacity-70"
        >
          →
        </button>
      </div>

      <p className="opacity-80">boceto de taller. el gráfico real se revela antes del 04.12.</p>
    </section>
  );
}

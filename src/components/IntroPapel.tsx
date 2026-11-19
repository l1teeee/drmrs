"use client";

import { useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { HojaExpediente } from "@/components/HojaExpediente";
import { cuadroBola, totalCuadrosBola } from "@/lib/secuencia-bola";

gsap.registerPlugin(useGSAP);

const CUADRO = 0.08;
const CUADROS_TEMBLOR = 28;
const INICIO_ARRUGA = CUADROS_TEMBLOR * CUADRO;
const TOTAL_ETAPAS_BOLA = 15;
const ETAPAS_BOLA = Array.from({ length: TOTAL_ETAPAS_BOLA }, (_, indice) => {
  const numero = String(indice + 1).padStart(2, "0");
  return `/papel-bola/cuadro-${numero}.webp`;
});

// Module state: set when the intro completes; survives client-side navigation and resets on every full page load.
let introVista = false;

function marcarIntroVista() {
  introVista = true;
}

// The intro belongs to landing on the start page: if the document was loaded at another route
// (for example /registro), arriving at / later is an in-app return and skips it.
function documentoCargadoEnInicio(): boolean {
  const [navegacion] = performance.getEntriesByType("navigation");
  if (!navegacion) return true;
  return new URL(navegacion.name).pathname === "/";
}

const POSES_TEMBLOR = [
  { x: 1, y: -1, rotation: -0.6 },
  { x: -1, y: 0, rotation: 0.5 },
  { x: 0, y: 1, rotation: -0.4 },
  { x: 1, y: 0, rotation: 0.3 },
];

type Letra = {
  desde: number;
  hasta: number;
  arriba: number;
  abajo: number;
  inicio: number;
  cuadros: number;
};

// One column per glyph, in % of the logo box (bounds measured from the SVG path, viewBox 177x72).
// Different start frames and frame counts make some letters draw faster than others.
const LETRAS: Letra[] = [
  { desde: 0, hasta: 22.8, arriba: 1.4, abajo: 85, inicio: 0, cuadros: 18 },
  { desde: 22.8, hasta: 37.6, arriba: 28.5, abajo: 84.6, inicio: 3, cuadros: 7 },
  { desde: 37.6, hasta: 71.8, arriba: 28, abajo: 84.6, inicio: 1, cuadros: 12 },
  { desde: 71.8, hasta: 88.2, arriba: 28.5, abajo: 84.6, inicio: 8, cuadros: 9 },
  { desde: 88.2, hasta: 100, arriba: 29.5, abajo: 44, inicio: 15, cuadros: 3 },
];

const PUNTOS_ARCO = 14;
const ESCALA_RADIO_X = 1.9;
const ESCALA_RADIO_Y = 1.4;
const TEMBLOR_ARCO = 0.06;

// Each letter is revealed by a dome (half ellipse) growing from its baseline, so the edge reads as ink
// spreading instead of a straight cut. Points are clamped to the letter's column.
function arcoLetra(letra: Letra, avance: number): string[] {
  const centroX = (letra.desde + letra.hasta) / 2;
  const radioX = ((letra.hasta - letra.desde) / 2) * ESCALA_RADIO_X * avance;
  const radioY = (letra.abajo - letra.arriba) * ESCALA_RADIO_Y * avance;
  const puntos = [`${letra.desde}% 100%`];

  for (let paso = 0; paso <= PUNTOS_ARCO; paso++) {
    const angulo = Math.PI * (1 - paso / PUNTOS_ARCO);
    const temblor = 1 + TEMBLOR_ARCO * Math.sin(paso * 2.3 + letra.desde);
    const xLibre = centroX + radioX * Math.cos(angulo) * temblor;
    const x = Math.min(letra.hasta, Math.max(letra.desde, xLibre));
    const y = letra.abajo - radioY * Math.sin(angulo) * temblor;
    puntos.push(`${x}% ${y}%`);
  }

  puntos.push(`${letra.hasta}% 100%`);
  return puntos;
}

function recortePorLetras(avances: number[]): string {
  const puntos = LETRAS.flatMap((letra, indice) => arcoLetra(letra, avances[indice]));
  return `polygon(0% 100%, ${puntos.join(", ")}, 100% 100%)`;
}

export function IntroPapel() {
  const capa = useRef<HTMLDivElement>(null);
  const papel = useRef<HTMLDivElement>(null);
  const bola = useRef<HTMLDivElement>(null);
  const etapas = useRef<(HTMLImageElement | null)[]>([]);
  const dibujo = useRef<HTMLImageElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (introVista || !documentoCargadoEnInicio()) {
        gsap.set(capa.current, { display: "none" });
        return;
      }
      const imagen = dibujo.current;
      const hoja = papel.current;
      const bolaPapel = bola.current;
      if (!imagen || !hoja || !bolaPapel) return;

      const linea = gsap.timeline({ onComplete: marcarIntroVista });

      const avances = LETRAS.map(() => ({ valor: 0 }));
      const aplicarRecorte = () => {
        imagen.style.clipPath = recortePorLetras(avances.map((avance) => avance.valor));
      };
      aplicarRecorte();

      LETRAS.forEach((letra, indice) => {
        linea.to(
          avances[indice],
          {
            valor: 1,
            duration: letra.cuadros * CUADRO,
            ease: `steps(${letra.cuadros})`,
            onUpdate: aplicarRecorte,
          },
          letra.inicio * CUADRO,
        );
      });

      for (let cuadro = 0; cuadro < CUADROS_TEMBLOR; cuadro++) {
        const pose = POSES_TEMBLOR[cuadro % POSES_TEMBLOR.length];
        linea.set(imagen, pose, cuadro * CUADRO);
      }
      linea.set(imagen, { x: 0, y: 0, rotation: 0, clipPath: "none" }, INICIO_ARRUGA);

      const lienzo = { ancho: bolaPapel.offsetWidth, alto: bolaPapel.offsetHeight };
      linea.set(hoja, { visibility: "hidden" }, INICIO_ARRUGA);

      const totalCuadros = totalCuadrosBola(ETAPAS_BOLA.length);
      let etapaVisible: HTMLImageElement | null = null;
      for (let cuadro = 0; cuadro < totalCuadros; cuadro++) {
        const estado = cuadroBola(cuadro, ETAPAS_BOLA.length, lienzo);
        const momento = INICIO_ARRUGA + cuadro * CUADRO;
        const etapa = etapas.current[estado.etapa];
        if (etapa && etapa !== etapaVisible) {
          if (etapaVisible) linea.set(etapaVisible, { visibility: "hidden" }, momento);
          linea.set(etapa, { visibility: "visible" }, momento);
          etapaVisible = etapa;
        }
        linea.set(
          bolaPapel,
          { scaleX: estado.escalaX, scaleY: estado.escalaY, rotation: estado.giro, x: estado.x, y: estado.y },
          momento,
        );
      }
      linea.set(capa.current, { display: "none" }, INICIO_ARRUGA + totalCuadros * CUADRO);
    },
    { scope: capa },
  );

  return (
      <div
        ref={capa}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 motion-reduce:hidden"
      >
        <div
          ref={papel}
          className="absolute inset-0 grid place-items-center bg-papel bg-[url(/textura-papel.jpg)] bg-cover bg-center px-4"
        >
          <HojaExpediente />
          <Image
            ref={dibujo}
            src="/drmr-logo.svg"
            alt=""
            width={177}
            height={72}
            preload
            className="h-auto w-[min(70vw,354px)] motion-safe:[clip-path:inset(100%_0%_0%_0%)]"
          />
        </div>
        <div
          ref={bola}
          className="absolute inset-0 drop-shadow-[0_18px_24px_rgba(0,0,0,0.35)]"
        >
          {ETAPAS_BOLA.map((src, indice) => (
            <Image
              key={src}
              ref={(nodo) => {
                etapas.current[indice] = nodo;
              }}
              src={src}
              alt=""
              fill
              unoptimized
              loading="eager"
              className="invisible object-fill"
            />
          ))}
        </div>
      </div>
  );
}

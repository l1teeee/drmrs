"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { esDispositivoMovil, urlPerfilInstagram, usuarioDesdeEnlaceIgMe } from "@/lib/instagram/enlace-chat";
import { enlaceWhatsappRegistro } from "@/lib/registro/enlaces";
import { formatearNumeroRegistro, formatearTelefono } from "@/lib/registro/formato";
import { archivoBlack, FUENTES_CICLO } from "./fuentes-numero";

gsap.registerPlugin(useGSAP);

const CUADRO = 0.06;

type ConfirmacionRegistroProps = {
  numero: number;
  yaEstaba: boolean;
  telefono: string;
  instagram: string;
  expediente: string | null;
  instagramLink: string | null;
  codigo: string | null;
  onCorregir: () => void;
};

function mensajeInstagram(numero: number, codigo: string | null): string {
  if (numero > 0 && codigo) return `Hola drmr, soy el registro No. ${formatearNumeroRegistro(numero)}. Código: ${codigo}`;
  if (numero > 0) return `Hola drmr, soy el registro No. ${formatearNumeroRegistro(numero)}.`;
  return "Hola drmr, ya estoy en el archivo.";
}

export function ConfirmacionRegistro({
  numero,
  yaEstaba,
  telefono,
  instagram,
  expediente,
  instagramLink,
  codigo,
  onCorregir,
}: ConfirmacionRegistroProps) {
  const [copiado, setCopiado] = useState<"movil" | "escritorio" | null>(null);
  const escena = useRef<HTMLDivElement>(null);
  const tinta = useRef<HTMLDivElement>(null);
  const grano = useRef<HTMLDivElement>(null);
  const sello = useRef<HTMLDivElement>(null);
  const cifra = useRef<HTMLParagraphElement>(null);
  const trazo = useRef<SVGPathElement>(null);

  async function copiarMensaje(event: React.MouseEvent<HTMLAnchorElement>) {
    const copia = navigator.clipboard.writeText(mensajeInstagram(numero, codigo));
    const escritorio = !esDispositivoMovil();
    const usuario = instagramLink ? usuarioDesdeEnlaceIgMe(instagramLink) : null;
    if (escritorio && usuario !== null) {
      event.preventDefault();
      window.open(urlPerfilInstagram(usuario), "_blank", "noopener,noreferrer");
    }
    try {
      await copia;
      setCopiado(escritorio ? "escritorio" : "movil");
    } catch {
      setCopiado(null);
    }
  }

  useGSAP(
    () => {
      escena.current?.focus();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const linea = gsap.timeline();

      // Blue ink spreads from the center (transform only, so it stays smooth).
      linea.fromTo(tinta.current, { scale: 0 }, { scale: 1, duration: 0.6, ease: "expo.out" });
      linea.fromTo(grano.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, "<0.25");

      // The isotype lands like a stamp, then flashes.
      linea.fromTo(
        sello.current,
        { scale: 1.8, rotation: -14, autoAlpha: 0 },
        { scale: 1, rotation: 0, autoAlpha: 1, duration: 4 * CUADRO, ease: "steps(4)" },
        "<",
      );
      linea.fromTo(
        sello.current,
        { filter: "drop-shadow(0 0 0 rgb(255 255 255 / 0))" },
        {
          filter: "drop-shadow(0 0 18px rgb(255 255 255 / 0.9))",
          duration: 0.25,
          yoyo: true,
          repeat: 1,
          ease: "power1.out",
        },
      );

      // The registration number is typed up to the real one.
      const destino = cifra.current;
      if (numero > 0 && destino) {
        const contador = { valor: 0 };
        linea.to(
          contador,
          {
            valor: numero,
            duration: 12 * CUADRO,
            ease: "steps(12)",
            onUpdate: () => {
              destino.textContent = formatearNumeroRegistro(Math.round(contador.valor));
              destino.style.fontFamily = FUENTES_CICLO[Math.round(contador.valor) % FUENTES_CICLO.length]!;
            },
            onComplete: () => {
              destino.style.fontFamily = "";
            },
          },
          "<",
        );

        // After the number settles, the font keeps changing without stopping.
        const cambio = { paso: 0 };
        gsap
          .timeline({
            repeat: -1,
            delay: linea.duration(),
            onRepeat: () => {
              cambio.paso = 0;
            },
          })
          .to(cambio, {
            paso: FUENTES_CICLO.length,
            duration: FUENTES_CICLO.length * 0.18,
            ease: `steps(${FUENTES_CICLO.length})`,
            onUpdate: () => {
              destino.style.fontFamily = FUENTES_CICLO[Math.floor(cambio.paso) % FUENTES_CICLO.length]!;
            },
          });
      }

      if (numero === 0 && trazo.current) {
        const largo = trazo.current.getTotalLength();
        gsap.set(trazo.current, { strokeDasharray: largo, strokeDashoffset: largo });
        linea.to(trazo.current, { strokeDashoffset: 0, duration: 0.7, ease: "power2.inOut" }, "<");
      }

      linea.from(
        "[data-aparece]",
        { autoAlpha: 0, y: 8, duration: 0.35, stagger: 0.08, ease: "power2.out" },
        ">-0.1",
      );
    },
    { scope: escena },
  );

  return (
    <div
      ref={escena}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-confirmacion"
      className="fixed inset-0 z-50 overflow-y-auto text-white outline-none"
    >
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          ref={tinta}
          className="absolute left-1/2 top-1/2 size-[300vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-azul will-change-transform"
        />
        <div ref={grano} className="absolute inset-0 [background-image:var(--grano)]" />
      </div>

      <div className="relative mx-auto flex min-h-full max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
        <div ref={sello}>
          <Image src="/drmr-isotipo.svg" alt="" width={169} height={160} className="h-16 w-auto" />
        </div>

        <p data-aparece className="mt-8 font-mono text-[12px] uppercase tracking-[0.08em] text-white/80">
          registro no.
        </p>
        {numero ? (
          <p
            ref={cifra}
            className={`${archivoBlack.className} flex h-[clamp(96px,18vw,200px)] items-center justify-center text-[clamp(96px,18vw,200px)] leading-none tracking-[-0.02em] tabular-nums`}
          >
            {formatearNumeroRegistro(numero)}
          </p>
        ) : (
          <div className="flex h-[clamp(96px,18vw,200px)] items-center justify-center" aria-hidden="true">
            <svg viewBox="0 0 120 120" className="h-full w-auto">
              <path
                ref={trazo}
                d="M24 62 Q38 76 50 98 Q68 52 102 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        <h2
          id="titulo-confirmacion"
          data-aparece
          className="mt-4 text-[clamp(28px,3vw,40px)] font-medium tracking-[-0.03em]"
        >
          {yaEstaba ? "Ya estabas dentro." : "Estás dentro."}
        </h2>

        {instagram && telefono && (
          <p data-aparece className="mt-4 text-[16px] leading-[1.55] text-white/85">
            {instagramLink ? (
              <>Escríbenos por Instagram para recibir tu bienvenida.</>
            ) : (
              <>
                Te avisamos por WhatsApp al <b>{formatearTelefono(telefono)}</b>.
              </>
            )}
          </p>
        )}

        {instagramLink && (
          <div data-aparece className="mt-6 flex flex-col items-center gap-2">
            <a
              href={instagramLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={copiarMensaje}
              className="inline-flex items-center justify-center border border-white px-6 py-4 text-[16px] font-medium text-white transition-colors duration-300 hover:bg-white hover:text-azul focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none"
            >
              Enviar mensaje por Instagram
            </a>
            <p aria-live="polite" className="min-h-[1.25rem] text-[13px] text-white/70">
              {copiado === "escritorio"
                ? "Copiado. Pulsa Enviar mensaje y pégalo."
                : copiado === "movil"
                  ? "Copiado. Pégalo y envíalo."
                  : ""}
            </p>
          </div>
        )}

        {numero >= 1 && numero <= 10 && (
          <p data-aparece className="mt-3 text-[15px] leading-[1.55] text-white/85">
            <b>Top 10.</b> Tu pieza lleva tu número y queda apartada 24 h el 04.12.
          </p>
        )}

        <div
          data-aparece
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[14px]"
        >
          {expediente && (
            <Link href={expediente} className="underline underline-offset-4 hover:text-white/80">
              Expediente →
            </Link>
          )}
          {telefono && (
            <button type="button" onClick={onCorregir} className="underline underline-offset-4 hover:text-white/80">
              Corregir
            </button>
          )}
          <a
            href={enlaceWhatsappRegistro(numero)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-white/80"
          >
            WhatsApp →
          </a>
        </div>

        <p data-aparece className="mt-10 text-[12px] uppercase tracking-[0.12em] text-white/70">
          Compártelo con @drmrs.archive
        </p>
        <Link data-aparece href="/" className="mt-6 text-[13px] text-white/70 hover:text-white">
          ← Inicio
        </Link>
      </div>
    </div>
  );
}

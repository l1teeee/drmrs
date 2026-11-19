"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { enlaceWhatsappRegistro } from "@/lib/registro/enlaces";
import { formatearNumeroRegistro, formatearTelefono } from "@/lib/registro/formato";

gsap.registerPlugin(useGSAP);

const CUADRO = 0.06;

type ConfirmacionRegistroProps = {
  numero: number;
  yaEstaba: boolean;
  telefono: string;
  instagram: string;
  expediente: string | null;
  instagramLink: string | null;
  onCorregir: () => void;
};

export function ConfirmacionRegistro({
  numero,
  yaEstaba,
  telefono,
  instagram,
  expediente,
  instagramLink,
  onCorregir,
}: ConfirmacionRegistroProps) {
  const escena = useRef<HTMLDivElement>(null);
  const tinta = useRef<HTMLDivElement>(null);
  const grano = useRef<HTMLDivElement>(null);
  const sello = useRef<HTMLDivElement>(null);
  const cifra = useRef<HTMLParagraphElement>(null);

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
            },
          },
          "<",
        );
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
        <p
          ref={cifra}
          className="text-[clamp(96px,18vw,200px)] font-extralight leading-none tracking-[-0.05em] tabular-nums"
        >
          {numero ? formatearNumeroRegistro(numero) : "✓"}
        </p>

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
              <>
                Para avisarte por Instagram, ábrenos el chat desde <b>@{instagram}</b> y mándanos un
                hola. Si no, te escribimos por WhatsApp al <b>{formatearTelefono(telefono)}</b>.
              </>
            ) : (
              <>
                Te mandaremos un mensaje por Instagram a <b>@{instagram}</b> para confirmar que tenemos tu
                registro. Si no te llega, te escribimos por WhatsApp al <b>{formatearTelefono(telefono)}</b>.
              </>
            )}
          </p>
        )}

        {numero >= 1 && numero <= 10 && (
          <p data-aparece className="mt-3 text-[15px] leading-[1.55] text-white/85">
            <b>Estás entre los primeros 10.</b> Tu pieza lleva tu mismo número de registro, apartada para
            ti las primeras 24 horas del 04.12.
          </p>
        )}

        <div
          data-aparece
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[14px]"
        >
          {expediente && (
            <Link href={expediente} className="underline underline-offset-4 hover:text-white/80">
              Ver tu expediente →
            </Link>
          )}
          {instagramLink && (
            <a
              href={instagramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-white/80"
            >
              Abrir Instagram →
            </a>
          )}
          {telefono && (
            <button type="button" onClick={onCorregir} className="underline underline-offset-4 hover:text-white/80">
              ¿Está mal? Corrígelo
            </button>
          )}
          <a
            href={enlaceWhatsappRegistro(numero)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-white/80"
          >
            Mándanos un hola por WhatsApp →
          </a>
        </div>

        <p data-aparece className="mt-10 text-[12px] uppercase tracking-[0.12em] text-white/70">
          Haz captura y súbela a tu historia con @drmrs.archive
        </p>
        <Link data-aparece href="/" className="mt-6 text-[13px] text-white/70 hover:text-white">
          ← volver al inicio
        </Link>
      </div>
    </div>
  );
}

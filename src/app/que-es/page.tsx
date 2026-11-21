import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { FolioArchivo } from "@/components/FolioArchivo";
import { FondoVideo } from "@/components/FondoVideo";
import { TransicionPagina } from "@/components/TransicionPagina";
import { INSTAGRAM_URL, TIKTOK_URL } from "@/lib/archivo";

export const metadata: Metadata = {
  title: { absolute: "drmrs archive" },
  description: "Qué es el archivo de drmr: Josh y Jonathan, Querétaro.",
};

const ENLACE_PIE = "hover:text-tinta";
const CLASE_FOLIO = "font-mono text-[13px] text-tinta/80";

export default function QueEs() {
  return (
    <TransicionPagina>
      <FondoVideo variante="claro" />
      <main className="fixed inset-0 grid grid-rows-[auto_1fr_auto] gap-[clamp(12px,2.5vh,28px)] overflow-y-auto px-[clamp(16px,4vw,56px)] py-[clamp(14px,2.2vh,28px)] text-tinta">
        <header className="flex items-center justify-between gap-4 border-b border-tinta/20 pb-[clamp(10px,1.8vh,20px)]">
          <Link href="/">
            <Image src="/drmr-logo.svg" alt="drmr" width={177} height={72} preload className="h-[30px] w-auto brightness-0" />
          </Link>
          <Suspense fallback={<span className={CLASE_FOLIO}>Exp.</span>}>
            <FolioArchivo className={CLASE_FOLIO} />
          </Suspense>
        </header>

        <section className="grid min-h-0 [align-content:safe_center] gap-[clamp(16px,3vh,40px)] md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:items-center md:gap-x-[clamp(32px,5vw,80px)]">
          <div className="grid content-start gap-[clamp(10px,2vh,20px)]">
            <Link href="/" className="font-mono text-[13px] text-tinta/70 underline-offset-4 hover:text-tinta hover:underline">← Inicio</Link>
            <p className="font-mono text-[13px] text-tinta/60">Expediente 000</p>
            <h1 className="max-w-[34ch] text-[clamp(16px,min(4.2vw,2.3vh),38px)] md:text-[clamp(18px,min(2.4vw,4vh),38px)] font-medium leading-[1.12] tracking-[-0.03em]">Somos Josh y Jonathan. Somos de Querétaro y vamos en la prepa. Decidimos hacer drmr en junio y lo pospusimos todo el verano. En octubre empezamos a construir la comunidad. Hoy, se marca el día en que inicia una nueva etapa. ¿Estás dentro?</h1>
          </div>
          <div className="grid content-start gap-[clamp(12px,2.4vh,28px)]">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-[clamp(8px,1.4vh,14px)] border-t border-tinta/20 pt-[clamp(8px,1.4vh,14px)]">
              <div className="grid gap-0.5">
                <dt className="text-[11px] md:text-[12px] text-tinta/60">Quiénes</dt>
                <dd className="font-mono text-[12px] md:text-[13px]">Josh y Jonathan</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-[11px] md:text-[12px] text-tinta/60">Dónde</dt>
                <dd className="font-mono text-[12px] md:text-[13px]">Querétaro, en la prepa</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-[11px] md:text-[12px] text-tinta/60">Desde</dt>
                <dd className="font-mono text-[12px] md:text-[13px]">Junio de 2026</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-[11px] md:text-[12px] text-tinta/60">Primer video del archivo</dt>
                <dd className="font-mono text-[12px] md:text-[13px]">6 de octubre</dd>
              </div>
            </dl>
            <div className="grid gap-[clamp(10px,1.8vh,20px)] border-t border-tinta/20 pt-[clamp(10px,1.8vh,20px)]">
              <div className="grid gap-1">
                <h2 className="text-[15px] md:text-[clamp(15px,2vh,18px)] font-medium tracking-[-0.02em]">Gente que ya lo hizo.</h2>
                <p className="text-[13px] leading-[1.4] md:text-[clamp(13px,1.7vh,15px)] md:leading-[1.45] text-tinta/80">Cada Archive es el momento en que alguien se movió: quién era, qué hizo y cuándo.</p>
              </div>
              <div className="grid gap-1">
                <h2 className="text-[15px] md:text-[clamp(15px,2vh,18px)] font-medium tracking-[-0.02em]">Ropa para dreamers de verdad.</h2>
                <p className="text-[13px] leading-[1.4] md:text-[clamp(13px,1.7vh,15px)] md:leading-[1.45] text-tinta/80">drmr es la marca detrás del archivo. Diseñada en Querétaro. La primera pieza es el Archivo 001: 50 piezas numeradas, de la 001 a la 050.</p>
              </div>
              <div className="grid gap-1">
                <h2 className="text-[15px] md:text-[clamp(15px,2vh,18px)] font-medium tracking-[-0.02em]">Primero los de aquí.</h2>
                <p className="text-[13px] leading-[1.4] md:text-[clamp(13px,1.7vh,15px)] md:leading-[1.45] text-tinta/80">Quien está en el registro ve las piezas y las aparta antes que el público. Los primeros 10 se llevan la pieza con su mismo número; el 0001, gratis. <Link href="/reglas" className="underline underline-offset-4 hover:text-tinta">Ver reglas</Link></p>
              </div>
            </div>
          </div>
        </section>

        <footer className="hidden md:flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-t border-tinta/20 pt-[clamp(10px,1.8vh,20px)] text-[13px]">
          <p>
            <b className="font-semibold">drmr™</b> · Querétaro, MX
          </p>
          <nav aria-label="Pie de página" className="flex flex-wrap gap-x-5 gap-y-2 text-tinta/80">
            <a className={ENLACE_PIE} href={TIKTOK_URL} target="_blank" rel="noopener noreferrer">
              TikTok
            </a>
            <a className={ENLACE_PIE} href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
            <Link className={ENLACE_PIE} href="/reglas">
              Reglas
            </Link>
            <Link className={ENLACE_PIE} href="/aviso-de-privacidad">
              Aviso de privacidad
            </Link>
          </nav>
        </footer>
      </main>
    </TransicionPagina>
  );
}

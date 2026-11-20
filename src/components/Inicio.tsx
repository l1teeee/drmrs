import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ContadorRegistros } from "@/components/ContadorRegistros";
import { CuentaRegresiva } from "@/components/CuentaRegresiva";
import { TituloArchivo } from "@/components/TituloArchivo";
import { INSTAGRAM_URL, TIKTOK_URL } from "@/lib/archivo";

const ENLACE_PIE = "hover:text-white";

export function Inicio() {
  return (
    <main className="fixed inset-0 grid grid-rows-[auto_1fr_auto] gap-8 overflow-y-auto px-[clamp(16px,4vw,56px)] py-[clamp(16px,2.5vw,28px)] text-white">
      <header className="flex items-center justify-between gap-4 border-b border-white/30 pb-5">
        {/* Single blue logo file: brightness-0 + invert renders it white on the blue background. */}
        <Image
          src="/drmr-logo.svg"
          alt="drmr"
          width={177}
          height={72}
          preload
          className="h-[30px] w-auto brightness-0 invert"
        />
        <span className="font-mono text-[13px] text-white/80">Exp. 001</span>
      </header>

      <section className="grid place-items-center text-center">
        <div>
          <TituloArchivo />
          <div className="mt-5 text-[clamp(28px,8.5vw,56px)] md:text-[clamp(56px,6vw,92px)] font-extralight leading-none tracking-[-0.04em]">
            <CuentaRegresiva />
          </div>
          <p className="mt-4 font-mono text-[12px] uppercase tracking-[0.08em] text-white/80">
            Viernes 4 de diciembre · 19:00
          </p>
          <Suspense fallback={null}>
            <ContadorRegistros />
          </Suspense>
          <Link
            href="/registro"
            className="group relative mt-10 inline-flex items-center gap-5 overflow-hidden border border-white px-6 py-4 text-white transition-colors duration-300 hover:text-azul focus-visible:text-azul focus-visible:outline-none motion-reduce:transition-none"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 origin-left scale-x-0 bg-white transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
            />
            <span className="relative flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <span className="text-[16px] font-medium">Entrar al registro</span>
              <span aria-hidden="true" className="hidden h-4 w-px bg-current opacity-40 sm:block" />
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] opacity-75">
                24 h antes · gratis
              </span>
            </span>
            <span
              aria-hidden="true"
              className="relative text-[20px] transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none"
            >
              →
            </span>
          </Link>
        </div>
      </section>

      <footer className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-t border-white/30 pt-5 text-[13px]">
        <p>
          <b className="font-semibold">drmr™</b> · Querétaro, MX
        </p>
        <nav aria-label="Pie de página" className="flex flex-wrap gap-x-5 gap-y-2 text-white/80">
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
  );
}

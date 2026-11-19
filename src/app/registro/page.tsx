import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FondoVideo } from "@/components/FondoVideo";
import { TransicionPagina } from "@/components/TransicionPagina";
import { FichaPieza } from "@/components/registro/FichaPieza";
import { FormularioRegistro } from "@/components/registro/FormularioRegistro";

export const metadata: Metadata = {
  title: "Registro · drmrs archive",
  description:
    "Regístrate y entra 24 horas antes que el público al Archivo 001: 50 piezas numeradas.",
};

export default function RegistroPage() {
  return (
    <TransicionPagina>
    <div className="relative isolate flex min-h-svh flex-col text-white md:h-svh md:overflow-hidden">
      <FondoVideo variante="blanco-negro" />

      <header className="mx-[clamp(16px,4vw,56px)] mt-[clamp(16px,2.5vw,28px)] flex items-center justify-between gap-4 border-b border-white/30 pb-5">
        <Link href="/" aria-label="drmr, volver al inicio">
          <Image
            src="/drmr-logo.svg"
            alt=""
            width={177}
            height={72}
            className="h-[30px] w-auto brightness-0 invert"
          />
        </Link>
        <Link href="/" className="font-mono text-[13px] text-white/70 hover:text-white">
          ← volver
        </Link>
        <span className="font-mono text-[13px] text-white/70">Exp. 001</span>
      </header>

      <div className="grid flex-1 md:min-h-0 md:grid-cols-2">
        <main className="flex flex-col px-[clamp(16px,4vw,56px)] py-8 md:min-h-0 md:overflow-y-auto">
          <section aria-labelledby="titulo-registro" className="my-auto w-full max-w-xl">
            <h1
              id="titulo-registro"
              className="text-[clamp(28px,3vw,44px)] font-medium leading-none tracking-[-0.03em]"
            >
              Registro
            </h1>
            <p className="mt-3 text-[16px] leading-[1.5] text-white/70">
              Entra 24 horas antes que el público al Archivo 001.
            </p>
            <FormularioRegistro />
          </section>
        </main>
        <FichaPieza />
      </div>
    </div>
    </TransicionPagina>
  );
}

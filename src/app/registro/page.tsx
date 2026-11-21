import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { FolioArchivo } from "@/components/FolioArchivo";
import { FondoVideo } from "@/components/FondoVideo";
import { TransicionPagina } from "@/components/TransicionPagina";
import { FichaPieza } from "@/components/registro/FichaPieza";
import { FormularioRegistro } from "@/components/registro/FormularioRegistro";
import { getPublicCurrentDrop } from "@/infrastructure/drops/public-current-drop";
import { log, safeErrorCode } from "@/infrastructure/observability/logger";
import { toDropPublico } from "@/lib/drop-publico";

export const metadata: Metadata = {
  title: { absolute: "drmrs archive" },
  description: "Regístrate y entra 24 horas antes que el público a los drops de drmr.",
};

const CLASE_FOLIO = "font-mono text-[13px] text-white/70";

async function ContenidoRegistro() {
  await connection();
  let drop;
  try {
    drop = await getPublicCurrentDrop();
  } catch (error) {
    log("error", "public_drop_failed", { code: safeErrorCode(error) });
    return (
      <main className="flex flex-col px-[clamp(16px,4vw,56px)] py-8 md:min-h-0 md:overflow-y-auto">
        <section aria-labelledby="titulo-registro" className="my-auto w-full max-w-xl">
          <h1
            id="titulo-registro"
            className="text-[clamp(28px,3vw,44px)] font-medium leading-none tracking-[-0.03em]"
          >
            Registro
          </h1>
          <p className="mt-6 text-[16px] text-white/80">
            No pudimos cargar el archivo. Intenta de nuevo en un momento.
          </p>
        </section>
      </main>
    );
  }

  const dropPublico = toDropPublico(drop, new Date());

  if (dropPublico.estado === "SIN_DROP") {
    return (
      <main className="flex flex-col px-[clamp(16px,4vw,56px)] py-8 md:min-h-0 md:overflow-y-auto">
        <section aria-labelledby="titulo-registro" className="my-auto w-full max-w-xl">
          <h1
            id="titulo-registro"
            className="text-[clamp(28px,3vw,44px)] font-medium leading-none tracking-[-0.03em]"
          >
            Registro
          </h1>
          <p className="mt-6 text-[16px] text-white/80">El registro está cerrado.</p>
        </section>
      </main>
    );
  }

  if (dropPublico.estado === "CERRADO") {
    return (
      <>
        <main className="flex flex-col px-[clamp(16px,4vw,56px)] py-8 md:min-h-0 md:overflow-y-auto">
          <section aria-labelledby="titulo-registro" className="my-auto w-full max-w-xl">
            <h1
              id="titulo-registro"
              className="text-[clamp(28px,3vw,44px)] font-medium leading-none tracking-[-0.03em]"
            >
              Registro
            </h1>
            <p className="mt-6 text-[16px] text-white/80">
              El registro de {dropPublico.nombre} está cerrado.
            </p>
          </section>
        </main>
        <FichaPieza drop={dropPublico} />
      </>
    );
  }

  return (
    <>
      <main className="flex flex-col px-[clamp(16px,4vw,56px)] py-8 md:min-h-0 md:overflow-y-auto">
        <section aria-labelledby="titulo-registro" className="my-auto w-full max-w-xl">
          <h1
            id="titulo-registro"
            className="text-[clamp(28px,3vw,44px)] font-medium leading-none tracking-[-0.03em]"
          >
            Registro
          </h1>
          <p className="mt-3 text-[16px] leading-[1.5] text-white/70">
            Entra 24 horas antes que el público al {dropPublico.nombre}.
          </p>
          <FormularioRegistro
            drop={{
              nombre: dropPublico.nombre!,
              numero: dropPublico.numero!,
              aperturaCorta: dropPublico.aperturaCorta,
            }}
          />
        </section>
      </main>
      <FichaPieza drop={dropPublico} />
    </>
  );
}

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
          <Suspense fallback={<span className={CLASE_FOLIO}>Exp.</span>}>
            <FolioArchivo className={CLASE_FOLIO} />
          </Suspense>
        </header>

        <div className="grid flex-1 md:min-h-0 md:grid-cols-2">
          <Suspense fallback={<div aria-hidden="true" className="min-h-[60vh] md:col-span-2" />}>
            <ContenidoRegistro />
          </Suspense>
        </div>
      </div>
    </TransicionPagina>
  );
}

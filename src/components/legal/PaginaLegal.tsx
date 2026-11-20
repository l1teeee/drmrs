import Image from "next/image";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { FolioArchivo } from "@/components/FolioArchivo";
import { TransicionPagina } from "@/components/TransicionPagina";
import styles from "@/components/legal/legal.module.css";
import { INSTAGRAM_URL, TIKTOK_URL } from "@/lib/archivo";

type PaginaLegalProps = {
  titulo: string;
  actualizacion: string;
  children: ReactNode;
};

const ENLACE = "hover:text-tinta";
const CLASE_FOLIO = "font-mono text-[13px] text-tinta/60";

export function PaginaLegal({ titulo, actualizacion, children }: PaginaLegalProps) {
  return (
    <TransicionPagina>
    <div className="flex min-h-svh flex-col bg-white px-[clamp(16px,4vw,56px)] py-[clamp(16px,2.5vw,28px)] text-tinta">
      <header className="flex items-center justify-between gap-4 border-b border-tinta/20 pb-5">
        <Link href="/" aria-label="drmr, volver al inicio">
          <Image src="/drmr-logo.svg" alt="" width={177} height={72} className="h-[30px] w-auto" />
        </Link>
        <Link href="/" className="font-mono text-[13px] text-tinta/60 hover:text-tinta">
          ← volver
        </Link>
        <Suspense fallback={<span className={CLASE_FOLIO}>Exp.</span>}>
          <FolioArchivo className={CLASE_FOLIO} />
        </Suspense>
      </header>

      <main className="mx-auto w-full max-w-[680px] flex-1 py-[clamp(40px,8vh,96px)]">
        <h1 className="text-[clamp(32px,4vw,52px)] font-light leading-none tracking-[-0.035em]">
          {titulo}
        </h1>
        <p className="mt-4 font-mono text-[12px] text-tinta/50">última actualización: {actualizacion}</p>
        <div className={`mt-12 ${styles.contenido}`}>{children}</div>
      </main>

      <footer className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-t border-tinta/20 pt-5 text-[13px]">
        <p>
          <b className="font-semibold">drmr™</b> · Querétaro, MX
        </p>
        <nav aria-label="Pie de página" className="flex flex-wrap gap-x-5 gap-y-2 text-tinta/60">
          <a className={ENLACE} href={TIKTOK_URL} target="_blank" rel="noopener noreferrer">
            TikTok
          </a>
          <a className={ENLACE} href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          <Link className={ENLACE} href="/reglas">
            Reglas
          </Link>
          <Link className={ENLACE} href="/aviso-de-privacidad">
            Aviso de privacidad
          </Link>
        </nav>
      </footer>
    </div>
    </TransicionPagina>
  );
}

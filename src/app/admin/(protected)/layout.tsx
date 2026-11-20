import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";

import { adminHref } from "@/infrastructure/admin/admin-path";
import { requireAdmin } from "@/infrastructure/auth/require-admin";

import { REGLA, ENLACE } from "../ui";
import { ContenidoAdmin } from "./ContenidoAdmin";
import { NavArchivo } from "./NavArchivo";
import { signOut } from "./actions";

const MARGEN_X = "px-[clamp(16px,4vw,56px)]";

const NAV_ITEMS = [
  { href: adminHref("/registros"), label: "Registros" },
  { href: adminHref("/mensajes"), label: "Mensajes" },
  { href: adminHref("/registros/importar"), label: "Importar" },
  { href: adminHref("/plantillas"), label: "Plantillas" },
  { href: adminHref("/actividad"), label: "Actividad" },
];

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const admin = await requireAdmin("page");

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh md:min-h-0">
      <div className={`${MARGEN_X} shrink-0 pt-[clamp(16px,2.5vw,28px)]`}>
        <header className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b ${REGLA} pb-4`}>
          <Link href={adminHref("/registros")} aria-label="drmr, registros">
            <Image src="/drmr-logo.svg" alt="drmr" width={177} height={72} preload className="h-[26px] w-auto" />
          </Link>
          <div className="flex flex-wrap items-baseline justify-end gap-x-5 gap-y-1">
            <span className="font-mono text-[13px] text-tinta/80">Archivo 001</span>
            <span className="text-[13px] text-tinta/70">{admin.displayName}</span>
            <form action={signOut}>
              <button type="submit" className={`text-[13px] ${ENLACE}`}>
                Salir
              </button>
            </form>
          </div>
        </header>

        <div className="pt-4">
          <NavArchivo items={NAV_ITEMS} />
        </div>

        <div className={`mt-4 border-t ${REGLA}`} />
      </div>

      <ContenidoAdmin
        className={`${MARGEN_X} flex flex-1 flex-col py-[clamp(24px,4vw,48px)] md:min-h-0 md:overflow-y-auto md:overscroll-contain`}
      >
        {children}
      </ContenidoAdmin>

      <footer className={`${MARGEN_X} shrink-0 pb-[clamp(16px,2.5vw,28px)]`}>
        <div className={`border-t ${REGLA} pt-4 text-[13px]`}>
          <p>
            <b className="font-semibold">drmr™</b> · Querétaro, MX
          </p>
        </div>
      </footer>
    </div>
  );
}

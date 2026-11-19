import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";

import { adminHref } from "@/infrastructure/admin/admin-path";
import { requireAdmin } from "@/infrastructure/auth/require-admin";

import { REGLA, ENLACE } from "../ui";
import { NavArchivo } from "./NavArchivo";
import { signOut } from "./actions";

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
    <div className="flex min-h-dvh flex-col px-[clamp(16px,4vw,56px)] py-[clamp(16px,2.5vw,28px)]">
      <header className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b ${REGLA} pb-5`}>
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

      <div className="pt-6">
        <NavArchivo items={NAV_ITEMS} />
      </div>

      <div className={`mt-6 border-t ${REGLA}`} />

      <div className="flex-1 py-[clamp(24px,4vw,48px)]">{children}</div>

      <footer className={`border-t ${REGLA} pt-5 text-[13px]`}>
        <p>
          <b className="font-semibold">drmr™</b> · Querétaro, MX
        </p>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { connection } from "next/server";

import { listUnlinkedContacts } from "@/application/messaging/admin-messages";
import { TransicionPagina } from "@/components/TransicionPagina";
import { paginate } from "@/domain/pagination";
import { adminHref } from "@/infrastructure/admin/admin-path";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { adminMessagesDependencies } from "@/infrastructure/messaging/admin-messages-runtime";

import { ENLACE, ETIQUETA, FILA, NUMERO, REGLA, TITULO } from "../../../ui";
import { BorrarChat } from "../../BorrarChat";
import { Paginacion } from "../../Paginacion";
import { hrefPagina, parsePagina } from "../../parametros-pagina";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

export default async function SinVincularPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  await requireAdmin("page");

  const resolvedParams = await searchParams;
  const unlinked = await listUnlinkedContacts(adminMessagesDependencies());
  const paginaContactos = paginate(unlinked, parsePagina(resolvedParams.pagina), 20);
  const hrefContactos = (n: number) => hrefPagina(adminHref("/mensajes/sin-vincular"), {}, "pagina", n);

  return (
    <TransicionPagina>
      <main className="grid gap-12">
        <div className="grid gap-5">
          <Link href={adminHref("/mensajes")} className={`self-start ${ENLACE} text-[14px]`}>
            ← Mensajes
          </Link>
          <h1 className={TITULO}>Escribieron y no están vinculados</h1>
        </div>

        <section className="grid gap-4">
          <div className={`flex items-baseline gap-4 border-b ${REGLA} pb-3`}>
            <span className={`${NUMERO} text-[56px] leading-none`}>{unlinked.length}</span>
            <h2 className={ETIQUETA}>escribieron y no están vinculados</h2>
          </div>
          {unlinked.length === 0 ? (
            <p className={ETIQUETA}>nadie pendiente.</p>
          ) : (
            <ul>
              {paginaContactos.items.map((contact) => (
                <li key={contact.id} className={`grid gap-1 border-b ${FILA} py-4`}>
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="text-[18px] font-medium">
                      {contact.username ? `@${contact.username}` : (contact.displayName ?? "sin usuario")}
                    </span>
                    <span className={ETIQUETA}>{dateFormatter.format(contact.lastInboundAt)}</span>
                  </div>
                  {contact.lastInboundText && (
                    <p className="truncate text-[16px] text-tinta/60">{contact.lastInboundText}</p>
                  )}
                  {contact.username ? (
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <p className={ETIQUETA}>Vincúlalo desde la conversación del registro.</p>
                      <Link
                        href={adminHref(`/registros?q=${encodeURIComponent(contact.username)}`)}
                        className={`${ENLACE} text-[14px]`}
                      >
                        Buscar registro
                      </Link>
                      <BorrarChat objetivo={{ tipo: "contacto", id: contact.id }} />
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <p className={ETIQUETA}>Busca su registro y vincúlalo desde ahí.</p>
                      <BorrarChat objetivo={{ tipo: "contacto", id: contact.id }} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Paginacion
            pagina={paginaContactos.page}
            totalPaginas={paginaContactos.totalPages}
            total={paginaContactos.total}
            hrefAnterior={paginaContactos.page > 1 ? hrefContactos(paginaContactos.page - 1) : null}
            hrefSiguiente={
              paginaContactos.page < paginaContactos.totalPages
                ? hrefContactos(paginaContactos.page + 1)
                : null
            }
          />
        </section>
      </main>
    </TransicionPagina>
  );
}

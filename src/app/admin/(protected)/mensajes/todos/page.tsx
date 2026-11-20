import Link from "next/link";
import { connection } from "next/server";

import { listConversations } from "@/application/messaging/admin-messages";
import { TransicionPagina } from "@/components/TransicionPagina";
import { paginate } from "@/domain/pagination";
import { formatRegistrationNumber } from "@/domain/registration/expediente-link";
import { adminHref } from "@/infrastructure/admin/admin-path";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { adminMessagesDependencies } from "@/infrastructure/messaging/admin-messages-runtime";

import { ENLACE, ETIQUETA, FILA, NUMERO, TITULO } from "../../../ui";
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

export default async function TodosLosChatsPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  await requireAdmin("page");

  const resolvedParams = await searchParams;
  const conversaciones = await listConversations(adminMessagesDependencies());
  const pagina = paginate(conversaciones, parsePagina(resolvedParams.pagina), 20);
  const hrefConversaciones = (n: number) => hrefPagina(adminHref("/mensajes/todos"), {}, "pagina", n);

  return (
    <TransicionPagina>
      <main className="grid gap-6">
        <div className="grid gap-3">
          <Link href={adminHref("/mensajes")} className={`self-start ${ENLACE} text-[13px]`}>
            ← Mensajes
          </Link>
          <h1 className={TITULO}>Todos los chats</h1>
        </div>

        <section className="grid gap-4">
          {conversaciones.length === 0 ? (
            <p className={ETIQUETA}>sin mensajes todavía.</p>
          ) : (
            <ul>
              {pagina.items.map((conversacion) => (
                <li
                  key={conversacion.registrationId ?? conversacion.contactId}
                  className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 border-b ${FILA} py-3.5 sm:gap-x-4`}
                >
                  <span className={`${NUMERO} text-[20px] leading-none`}>
                    {conversacion.registrationNumber === null
                      ? "—"
                      : formatRegistrationNumber(conversacion.registrationNumber)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      {conversacion.registrationId ? (
                        <>
                          <span className="text-[15px] font-medium [overflow-wrap:anywhere]">{conversacion.fullName}</span>
                          <span className={`${ETIQUETA} break-all`}>@{conversacion.instagramHandle}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[15px] font-medium [overflow-wrap:anywhere]">
                            {conversacion.contactUsername
                              ? `@${conversacion.contactUsername}`
                              : (conversacion.contactDisplayName ?? "sin usuario")}
                          </span>
                          <span className={ETIQUETA}>sin vincular</span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span className={ETIQUETA}>{conversacion.lastDirection === "IN" ? "ellos" : "drmr"}</span>
                      <span className={ETIQUETA}>{dateFormatter.format(conversacion.lastAt)}</span>
                      <span className={ETIQUETA}>
                        {conversacion.total === 1 ? "1 mensaje" : `${conversacion.total} mensajes`}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[14px] text-tinta/70">{conversacion.lastBody}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      {conversacion.registrationId ? (
                        <Link
                          href={adminHref(`/registros/${conversacion.registrationId}`)}
                          className={`${ENLACE} text-[13px]`}
                        >
                          Abrir chat
                        </Link>
                      ) : (
                        <>
                          {conversacion.contactUsername && (
                            <Link
                              href={adminHref(`/registros?q=${encodeURIComponent(conversacion.contactUsername)}`)}
                              className={`${ENLACE} text-[13px]`}
                            >
                              Buscar registro
                            </Link>
                          )}
                          <BorrarChat objetivo={{ tipo: "contacto", id: conversacion.contactId! }} />
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Paginacion
            pagina={pagina.page}
            totalPaginas={pagina.totalPages}
            total={pagina.total}
            hrefAnterior={pagina.page > 1 ? hrefConversaciones(pagina.page - 1) : null}
            hrefSiguiente={pagina.page < pagina.totalPages ? hrefConversaciones(pagina.page + 1) : null}
          />
        </section>
      </main>
    </TransicionPagina>
  );
}

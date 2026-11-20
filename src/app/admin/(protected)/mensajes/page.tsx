import Link from "next/link";
import { connection } from "next/server";

import { listRegistros } from "@/application/admin-registros/admin-registros";
import {
  listUnlinkedContacts,
  listUnsentMessages,
  renderActivationTexts,
} from "@/application/messaging/admin-messages";
import { TransicionPagina } from "@/components/TransicionPagina";
import { paginate } from "@/domain/pagination";
import { adminHref } from "@/infrastructure/admin/admin-path";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { loadInstagramConnectionStatus } from "@/infrastructure/instagram/instagram-connection-runtime";
import { adminMessagesDependencies } from "@/infrastructure/messaging/admin-messages-runtime";
import { scheduleMessageDelivery } from "@/infrastructure/messaging/schedule-message-delivery";

import { ENLACE, ETIQUETA, FILA, NUMERO, REGLA, TITULO } from "../../ui";
import { estadoInstagram } from "../estado-instagram";
import { Paginacion } from "../Paginacion";
import { hrefPagina, parsePagina } from "../parametros-pagina";

import { FilaSinEnviar } from "./FilaSinEnviar";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ESTADO = "text-[clamp(22px,2.4vw,30px)] font-medium tracking-[-0.03em]";
// Same look as BotonArchivo, as a link: <a> never matches :enabled, so the sweep uses plain hover and focus-visible.
const ENLACE_BOTON =
  "group relative inline-flex items-center justify-center overflow-hidden border border-azul px-6 py-4 text-[16px] font-medium text-azul transition-colors duration-300 hover:text-white focus-visible:text-white focus-visible:outline-none motion-reduce:transition-none";
const BARRIDO =
  "absolute inset-0 origin-left scale-x-0 bg-azul transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none";

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

export default async function MensajesPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const admin = await requireAdmin("page");
  scheduleMessageDelivery();

  const resolvedParams = await searchParams;
  const instagramParam = resolvedParams.instagram;

  const status = await loadInstagramConnectionStatus();
  const deps = adminMessagesDependencies();
  const unsent = await listUnsentMessages(deps);
  const unlinked = await listUnlinkedContacts(deps);
  const registros = await listRegistros({}, deps.registros);
  const activationTexts = await renderActivationTexts(registros, deps);
  const now = new Date();
  const paginaSinEnviar = paginate(unsent, parsePagina(resolvedParams.pagina), 20);
  const paginaContactos = paginate(unlinked, parsePagina(resolvedParams.pagina_contactos), 20);
  const hrefSinEnviar = (n: number) =>
    hrefPagina(
      adminHref("/mensajes"),
      { pagina_contactos: paginaContactos.page > 1 ? String(paginaContactos.page) : undefined },
      "pagina",
      n,
    );
  const hrefContactos = (n: number) =>
    hrefPagina(
      adminHref("/mensajes"),
      { pagina: paginaSinEnviar.page > 1 ? String(paginaSinEnviar.page) : undefined },
      "pagina_contactos",
      n,
    );

  return (
    <TransicionPagina>
      <main className="grid gap-12">
        <h1 className={TITULO}>Mensajes de Instagram</h1>

        <div className={`grid gap-4 border-b ${REGLA} pb-8`}>
          {status.mode === "disabled" && <p className={ESTADO}>Instagram no está configurado en este entorno.</p>}
          {status.mode === "log" && <p className={ESTADO}>Modo de prueba: los mensajes no salen a Instagram.</p>}
          {status.mode === "instagram" && status.connection && (
            <div className="grid justify-items-start gap-5">
              <div className="grid gap-1">
                <p className={ESTADO}>Conectado como @{status.connection.username}</p>
                <p className={ETIQUETA}>desde {dateFormatter.format(status.connection.connectedAt)}</p>
              </div>
              {admin.role === "OWNER" && (
                <a href="/api/instagram/connect" className={ENLACE_BOTON}>
                  <span aria-hidden="true" className={BARRIDO} />
                  <span className="relative">Volver a conectar</span>
                </a>
              )}
            </div>
          )}
          {status.mode === "instagram" && !status.connection && (
            <div className="grid justify-items-start gap-5">
              <p className={ESTADO}>Instagram no está conectado.</p>
              {admin.role === "OWNER" ? (
                <a href="/api/instagram/connect" className={ENLACE_BOTON}>
                  <span aria-hidden="true" className={BARRIDO} />
                  <span className="relative">Conectar Instagram</span>
                </a>
              ) : (
                <p className={ETIQUETA}>Pide a un dueño que conecte la cuenta.</p>
              )}
            </div>
          )}
          {instagramParam === "conectado" && <p className={ETIQUETA}>Cuenta conectada.</p>}
          {instagramParam === "error" && <p className={ETIQUETA}>No se pudo conectar. Intenta de nuevo.</p>}
        </div>

        <section className="grid gap-4">
          <div className={`flex items-baseline gap-4 border-b ${REGLA} pb-3`}>
            <span className={`${NUMERO} text-[56px] leading-none`}>{unsent.length}</span>
            <h2 className={ETIQUETA}>sin enviar</h2>
          </div>
          {unsent.length === 0 ? (
            <p className={ETIQUETA}>todo enviado.</p>
          ) : (
            <ul>
              {paginaSinEnviar.items.map((message) => {
                const estado = estadoInstagram(message.lastInboundAt, now);
                const text = activationTexts.get(message.registrationId);
                if (text === undefined) throw new Error("Activation text missing");
                const activacion = estado.activo
                  ? null
                  : { text, sentAt: message.activationSentAt?.toISOString() ?? null };
                return (
                  <FilaSinEnviar
                    key={message.id}
                    id={message.id}
                    registrationId={message.registrationId}
                    estado={estado}
                    activacion={activacion}
                    registrationNumber={message.registrationNumber}
                    fullName={message.fullName}
                    instagramHandle={message.instagramHandle}
                    status={message.status}
                    body={message.body}
                    attempts={message.attempts}
                    createdAt={message.createdAt.toISOString()}
                    conversacionHref={adminHref("/registros/" + message.registrationId)}
                  />
                );
              })}
            </ul>
          )}
          <Paginacion
            pagina={paginaSinEnviar.page}
            totalPaginas={paginaSinEnviar.totalPages}
            total={paginaSinEnviar.total}
            hrefAnterior={paginaSinEnviar.page > 1 ? hrefSinEnviar(paginaSinEnviar.page - 1) : null}
            hrefSiguiente={
              paginaSinEnviar.page < paginaSinEnviar.totalPages
                ? hrefSinEnviar(paginaSinEnviar.page + 1)
                : null
            }
          />
        </section>

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
                    </div>
                  ) : (
                    <p className={ETIQUETA}>Busca su registro y vincúlalo desde ahí.</p>
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

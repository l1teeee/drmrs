import Link from "next/link";
import { connection } from "next/server";

import { listConversations, listUnlinkedContacts, listUnsentMessages } from "@/application/messaging/admin-messages";
import { TransicionPagina } from "@/components/TransicionPagina";
import { adminHref } from "@/infrastructure/admin/admin-path";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { loadInstagramConnectionStatus } from "@/infrastructure/instagram/instagram-connection-runtime";
import { adminMessagesDependencies } from "@/infrastructure/messaging/admin-messages-runtime";
import { scheduleMessageDelivery } from "@/infrastructure/messaging/schedule-message-delivery";

import { ENLACE, ETIQUETA, NUMERO, REGLA, TITULO } from "../../ui";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ESTADO = "text-[17px] font-medium tracking-[-0.01em] [overflow-wrap:anywhere] md:text-[18px]";
// Same look as BotonArchivo, as a link: <a> never matches :enabled, so the sweep uses plain hover and focus-visible.
const ENLACE_BOTON =
  "group relative inline-flex items-center justify-center overflow-hidden border border-azul px-4 py-2 text-[14px] font-medium text-azul transition-colors duration-300 hover:text-white focus-visible:text-white focus-visible:outline-none motion-reduce:transition-none";
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
  const conversaciones = await listConversations(deps);

  return (
    <TransicionPagina>
      <main className="grid gap-8">
        <h1 className={TITULO}>Mensajes de Instagram</h1>

        <div className={`grid gap-3 border-b ${REGLA} pb-6`}>
          {status.mode === "disabled" && <p className={ESTADO}>Instagram no está configurado en este entorno.</p>}
          {status.mode === "log" && <p className={ESTADO}>Modo de prueba: los mensajes no salen a Instagram.</p>}
          {status.mode === "instagram" && status.connection && (
            <div className="grid justify-items-start gap-3">
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
            <div className="grid justify-items-start gap-3">
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

        <section className="grid sm:grid-cols-3 sm:gap-x-6">
          <Link href={adminHref("/mensajes/todos")} className={`grid grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 border-t ${REGLA} py-3 sm:grid-cols-1 sm:content-start sm:gap-y-1.5 sm:pb-0`}>
            <span className={`${NUMERO} row-span-2 text-[28px] leading-none sm:row-span-1 md:text-[32px]`}>{conversaciones.length}</span>
            <span className={ETIQUETA}>todos los chats</span>
            <span className={`${ENLACE} justify-self-start text-[13px]`}>Ver todos →</span>
          </Link>
          <Link href={adminHref("/mensajes/sin-enviar")} className={`grid grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 border-t ${REGLA} py-3 sm:grid-cols-1 sm:content-start sm:gap-y-1.5 sm:pb-0`}>
            <span className={`${NUMERO} row-span-2 text-[28px] leading-none sm:row-span-1 md:text-[32px]`}>{unsent.length}</span>
            <span className={ETIQUETA}>sin enviar</span>
            <span className={`${ENLACE} justify-self-start text-[13px]`}>Ver listado →</span>
          </Link>
          <Link href={adminHref("/mensajes/sin-vincular")} className={`grid grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 border-t ${REGLA} py-3 sm:grid-cols-1 sm:content-start sm:gap-y-1.5 sm:pb-0`}>
            <span className={`${NUMERO} row-span-2 text-[28px] leading-none sm:row-span-1 md:text-[32px]`}>{unlinked.length}</span>
            <span className={ETIQUETA}>escribieron y no están vinculados</span>
            <span className={`${ENLACE} justify-self-start text-[13px]`}>Ver listado →</span>
          </Link>
        </section>
      </main>
    </TransicionPagina>
  );
}

import Link from "next/link";
import { connection } from "next/server";

import {
  listUnlinkedContacts,
  listUnsentMessages,
} from "@/application/messaging/admin-messages";
import { adminHref } from "@/infrastructure/admin/admin-path";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { loadInstagramConnectionStatus } from "@/infrastructure/instagram/instagram-connection-runtime";
import { adminMessagesDependencies } from "@/infrastructure/messaging/admin-messages-runtime";
import { scheduleMessageDelivery } from "@/infrastructure/messaging/schedule-message-delivery";

import { ENLACE, ETIQUETA, FILA, NUMERO, REGLA, TITULO } from "../../ui";

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

  return (
    <main className="grid gap-12">
      <h1 className={TITULO}>Mensajes de Instagram</h1>

      <div className={`grid gap-4 border-b ${REGLA} pb-8`}>
        {status.mode === "disabled" && <p className={ESTADO}>Instagram no está configurado en este entorno.</p>}
        {status.mode === "log" && <p className={ESTADO}>Modo de prueba: los mensajes no salen a Instagram.</p>}
        {status.mode === "instagram" && status.connection && (
          <div className="grid gap-1">
            <p className={ESTADO}>Conectado como @{status.connection.username}</p>
            <p className={ETIQUETA}>desde {dateFormatter.format(status.connection.connectedAt)}</p>
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
            {unsent.map((message) => (
              <FilaSinEnviar
                key={message.id}
                id={message.id}
                registrationNumber={message.registrationNumber}
                fullName={message.fullName}
                instagramHandle={message.instagramHandle}
                status={message.status}
                body={message.body}
                attempts={message.attempts}
                createdAt={message.createdAt.toISOString()}
                conversacionHref={adminHref("/registros/" + message.registrationId)}
              />
            ))}
          </ul>
        )}
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
            {unlinked.map((contact) => (
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
      </section>
    </main>
  );
}

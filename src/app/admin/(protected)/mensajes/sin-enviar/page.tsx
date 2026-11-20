import Link from "next/link";
import { connection } from "next/server";

import { listRegistros } from "@/application/admin-registros/admin-registros";
import {
  listUnsentMessages,
  renderActivationTexts,
} from "@/application/messaging/admin-messages";
import { TransicionPagina } from "@/components/TransicionPagina";
import { paginate } from "@/domain/pagination";
import { adminHref } from "@/infrastructure/admin/admin-path";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { adminMessagesDependencies } from "@/infrastructure/messaging/admin-messages-runtime";

import { ENLACE, ETIQUETA, NUMERO, REGLA, TITULO } from "../../../ui";
import { estadoInstagram } from "../../estado-instagram";
import { Paginacion } from "../../Paginacion";
import { hrefPagina, parsePagina } from "../../parametros-pagina";
import { FilaSinEnviar } from "../FilaSinEnviar";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SinEnviarPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  await requireAdmin("page");

  const resolvedParams = await searchParams;
  const deps = adminMessagesDependencies();
  const unsent = await listUnsentMessages(deps);
  const registros = await listRegistros({}, deps.registros);
  const activationTexts = await renderActivationTexts(registros, deps);
  const now = new Date();
  const paginaSinEnviar = paginate(unsent, parsePagina(resolvedParams.pagina), 20);
  const hrefSinEnviar = (n: number) => hrefPagina(adminHref("/mensajes/sin-enviar"), {}, "pagina", n);

  return (
    <TransicionPagina>
      <main className="grid gap-6">
        <div className="grid gap-3">
          <Link href={adminHref("/mensajes")} className={`self-start ${ENLACE} text-[13px]`}>
            ← Mensajes
          </Link>
          <h1 className={TITULO}>Sin enviar</h1>
        </div>

        <section className="grid gap-4">
          <div className={`flex items-baseline gap-3 border-b ${REGLA} pb-3`}>
            <span className={`${NUMERO} text-[28px] leading-none md:text-[32px]`}>{unsent.length}</span>
            <h2 className={`${ETIQUETA} min-w-0`}>sin enviar</h2>
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
      </main>
    </TransicionPagina>
  );
}

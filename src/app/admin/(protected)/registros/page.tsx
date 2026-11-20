import Link from "next/link";
import { connection } from "next/server";

import { listRegistros } from "@/application/admin-registros/admin-registros";
import {
  listWindowStates,
  type RegistrationWindowState,
  renderActivationTexts,
} from "@/application/messaging/admin-messages";
import { TransicionPagina } from "@/components/TransicionPagina";
import { type ListFilters, listFiltersSchema } from "@/contracts/admin-registros";
import { paginate } from "@/domain/pagination";
import { formatRegistrationTag } from "@/domain/drop/drop";
import { formatRegistrationNumber } from "@/domain/registration/expediente-link";
import { formatWhatsappDisplay, whatsappChatUrl } from "@/domain/registration/phone";
import { PIECE_STATUS_LABELS, SIZE_LABELS } from "@/domain/registration/piece-status";
import { PIECE_STATUSES, SIZES } from "@/domain/registration/registration";
import { adminHref } from "@/infrastructure/admin/admin-path";
import { adminRegistrosDependencies } from "@/infrastructure/admin/admin-registros-runtime";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { adminMessagesDependencies } from "@/infrastructure/messaging/admin-messages-runtime";

import {
  BotonArchivo,
  CAMPO,
  ENLACE,
  ETIQUETA,
  FILA,
  NUMERO,
  REGLA,
  TITULO,
} from "../../ui";
import { estadoInstagram } from "../estado-instagram";
import { selectedDrop } from "../drop-seleccionado";
import { Paginacion } from "../Paginacion";
import { hrefPagina, parsePagina } from "../parametros-pagina";
import { FilaRegistro, type FilaRegistroProps } from "./FilaRegistro";
import { Refrescar } from "./Refrescar";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseFilters(raw: Record<string, string | string[] | undefined>): ListFilters {
  const qValue = typeof raw.q === "string" && raw.q.trim() !== "" ? raw.q : undefined;
  const estadoValue = typeof raw.estado === "string" ? raw.estado : undefined;
  const tallaValue = typeof raw.talla === "string" ? raw.talla : undefined;

  const qParsed = listFiltersSchema.shape.q.safeParse(qValue);
  const estadoParsed = listFiltersSchema.shape.estado.safeParse(estadoValue);
  const tallaParsed = listFiltersSchema.shape.talla.safeParse(tallaValue);

  const parsed = listFiltersSchema.safeParse({
    q: qParsed.success ? qParsed.data : undefined,
    estado: estadoParsed.success ? estadoParsed.data : undefined,
    talla: tallaParsed.success ? tallaParsed.data : undefined,
  });

  return parsed.success ? parsed.data : {};
}

function instagramProps(
  registrationId: string,
  windowStates: Map<string, RegistrationWindowState>,
  activationTexts: Map<string, string>,
  now: Date,
): Pick<FilaRegistroProps, "estado" | "activacion"> {
  const state = windowStates.get(registrationId);
  const estado = estadoInstagram(state?.lastInboundAt ?? null, now);
  if (estado.activo) return { estado, activacion: null };
  const text = activationTexts.get(registrationId);
  if (text === undefined) throw new Error("Activation text missing");
  return { estado, activacion: { text, sentAt: state?.activationSentAt?.toISOString() ?? null } };
}

export default async function RegistrosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection();
  await requireAdmin("page");

  const resolvedParams = await searchParams;
  const filters = parseFilters(resolvedParams);
  const { selected, scope } = await selectedDrop(resolvedParams.drop);
  const dropParam = typeof resolvedParams.drop === "string" ? resolvedParams.drop : undefined;
  const importHref = adminHref(`/registros/importar?drop=${scope === "todos" ? "todos" : selected?.id ?? "todos"}`);
  const registros = await listRegistros({ ...filters, dropId: scope === "todos" ? undefined : selected?.id }, adminRegistrosDependencies());
  const pagina = paginate(registros, parsePagina(resolvedParams.pagina), 25);
  const hrefDePagina = (n: number) =>
    hrefPagina(
      adminHref("/registros"),
      { q: filters.q, estado: filters.estado, talla: filters.talla, drop: dropParam },
      "pagina",
      n,
    );
  const messagesDeps = adminMessagesDependencies();
  const windowStates = await listWindowStates(pagina.items.map((row) => row.id), messagesDeps);
  const activationTexts = await renderActivationTexts(pagina.items, messagesDeps);
  const now = new Date();
  const hasFilters = Boolean(filters.q || filters.estado || filters.talla);

  const statusCounts = PIECE_STATUSES.map((status) => ({
    status,
    count: registros.filter((row) => row.pieceStatus === status).length,
  })).filter((entry) => entry.count > 0);
  const summary = [
    { key: "total", count: registros.length, label: "registros" },
    ...statusCounts.map((entry) => ({
      key: entry.status,
      count: entry.count,
      label: PIECE_STATUS_LABELS[entry.status],
    })),
  ];

  return (
    <TransicionPagina>
      <main className="grid gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h1 className={TITULO}>Registros · {scope === "todos" ? "todos los archivos" : selected?.name}</h1>
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px]">
            <Refrescar />
            <Link href={importHref} className={ENLACE}>
              Importar
            </Link>
            <a href={adminHref(`/registros/export${scope === "drop" && selected ? `?drop=${selected.id}` : ""}`)} className={ENLACE}>
              Exportar CSV
            </a>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-x-4 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-0">
          {summary.map((entry) => (
            <div
              key={entry.key}
              className={`flex flex-col gap-1 sm:border-l sm:px-6 sm:first:border-l-0 sm:first:pl-0 ${REGLA}`}
            >
              <dt className={`${ETIQUETA} order-2`}>{entry.label}</dt>
              <dd className={`${NUMERO} text-[28px] leading-none md:text-[32px]`}>{entry.count}</dd>
            </div>
          ))}
        </dl>

        <form
          method="get"
          action={adminHref("/registros")}
          className="grid grid-cols-2 items-end gap-x-4 gap-y-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:gap-x-6"
        >
          {dropParam && <input type="hidden" name="drop" value={dropParam} />}
          <input
            type="text"
            name="q"
            aria-label="Buscar nombre o Instagram"
            defaultValue={filters.q ?? ""}
            placeholder="Buscar nombre o Instagram"
            maxLength={60}
            className={`${CAMPO} col-span-2 md:col-span-1`}
          />
          <select
            name="estado"
            aria-label="Estado"
            defaultValue={filters.estado ?? ""}
            className={CAMPO}
          >
            <option value="" className="text-tinta">
              Todos los estados
            </option>
            {PIECE_STATUSES.map((status) => (
              <option key={status} value={status} className="text-tinta">
                {PIECE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <select
            name="talla"
            aria-label="Talla"
            defaultValue={filters.talla ?? ""}
            className={CAMPO}
          >
            <option value="" className="text-tinta">
              Todas las tallas
            </option>
            {SIZES.map((size) => (
              <option key={size} value={size} className="text-tinta">
                {SIZE_LABELS[size]}
              </option>
            ))}
          </select>
          <div>
            <BotonArchivo type="submit">Filtrar</BotonArchivo>
          </div>
          <Link href={adminHref(`/registros${dropParam ? `?drop=${encodeURIComponent(dropParam)}` : ""}`)} className={`${ENLACE} self-center justify-self-start text-[13px]`}>
            Limpiar
          </Link>
        </form>

        {registros.length === 0 ? (
          hasFilters ? (
            <p className={`${ETIQUETA} text-[13px]`}>nada con esos filtros.</p>
          ) : (
            <div className="grid justify-items-start gap-2">
              <p className={`${ETIQUETA} text-[13px]`}>sin expedientes todavía.</p>
              <Link href={importHref} className={`${ENLACE} text-[13px]`}>
                Importar el CSV del Google Sheet
              </Link>
            </div>
          )
        ) : (
          <div>
            <ul className={`border-t ${FILA}`}>
              {pagina.items.map((row) => (
                <FilaRegistro
                  key={row.id}
                  id={row.id}
                  conversacionHref={adminHref("/registros/" + row.id)}
                  etiqueta={scope === "todos" ? formatRegistrationTag(row.dropNumber, row.registrationNumber) : formatRegistrationNumber(row.registrationNumber)}
                  todos={scope === "todos"}
                  whatsapp={formatWhatsappDisplay(row.whatsappDigits)}
                  whatsappUrl={whatsappChatUrl(row.whatsappDigits)}
                  fullName={row.fullName}
                  instagramHandle={row.instagramHandle}
                  size={row.size}
                  pieceStatus={row.pieceStatus}
                  expedienteUrl={row.expedienteUrl}
                  {...instagramProps(row.id, windowStates, activationTexts, now)}
                />
              ))}
            </ul>
            <Paginacion
              pagina={pagina.page}
              totalPaginas={pagina.totalPages}
              total={pagina.total}
              hrefAnterior={pagina.page > 1 ? hrefDePagina(pagina.page - 1) : null}
              hrefSiguiente={pagina.page < pagina.totalPages ? hrefDePagina(pagina.page + 1) : null}
            />
          </div>
        )}
      </main>
    </TransicionPagina>
  );
}

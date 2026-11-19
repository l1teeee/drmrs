import Link from "next/link";
import { connection } from "next/server";

import { listRegistros } from "@/application/admin-registros/admin-registros";
import { type ListFilters, listFiltersSchema } from "@/contracts/admin-registros";
import { PIECE_STATUS_LABELS, SIZE_LABELS } from "@/domain/registration/piece-status";
import { PIECE_STATUSES, SIZES } from "@/domain/registration/registration";
import { adminHref } from "@/infrastructure/admin/admin-path";
import { adminRegistrosDependencies } from "@/infrastructure/admin/admin-registros-runtime";
import { requireAdmin } from "@/infrastructure/auth/require-admin";

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
import { FilaRegistro } from "./FilaRegistro";

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

export default async function RegistrosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection();
  await requireAdmin("page");

  const resolvedParams = await searchParams;
  const filters = parseFilters(resolvedParams);
  const registros = await listRegistros(filters, adminRegistrosDependencies());
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
    <main className="grid gap-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <h1 className={TITULO}>Registros</h1>
        <div className="flex items-baseline gap-6">
          <Link href={adminHref("/registros/importar")} className={ENLACE}>
            Importar
          </Link>
          <a href={adminHref("/registros/export")} className={ENLACE}>
            Exportar CSV
          </a>
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-0 gap-y-8">
        {summary.map((entry) => (
          <div
            key={entry.key}
            className={`flex flex-col gap-2 pr-8 md:border-l md:px-8 md:first:border-l-0 md:first:pl-0 ${REGLA}`}
          >
            <dt className={`${ETIQUETA} order-2`}>{entry.label}</dt>
            <dd className={`${NUMERO} text-[56px] leading-none`}>{entry.count}</dd>
          </div>
        ))}
      </dl>

      <form
        method="get"
        action={adminHref("/registros")}
        className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-end"
      >
        <input
          type="text"
          name="q"
          aria-label="Buscar nombre o Instagram"
          defaultValue={filters.q ?? ""}
          placeholder="Buscar nombre o Instagram"
          maxLength={60}
          className={CAMPO}
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
        <Link href={adminHref("/registros")} className={`${ENLACE} md:pb-4`}>
          Limpiar
        </Link>
      </form>

      {registros.length === 0 ? (
        hasFilters ? (
          <p className={`${ETIQUETA} text-[14px]`}>nada con esos filtros.</p>
        ) : (
          <div className="grid justify-items-start gap-3">
            <p className={`${ETIQUETA} text-[14px]`}>sin expedientes todavía.</p>
            <Link href={adminHref("/registros/importar")} className={ENLACE}>
              Importar el CSV del Google Sheet
            </Link>
          </div>
        )
      ) : (
        <ul className={`border-t ${FILA}`}>
          {registros.map((row) => (
            <FilaRegistro
              key={row.id}
              id={row.id}
              conversacionHref={adminHref("/registros/" + row.id)}
              registrationNumber={row.registrationNumber}
              fullName={row.fullName}
              instagramHandle={row.instagramHandle}
              size={row.size}
              pieceStatus={row.pieceStatus}
              expedienteUrl={row.expedienteUrl}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

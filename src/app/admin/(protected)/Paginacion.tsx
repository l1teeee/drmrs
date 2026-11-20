import Link from "next/link";

import { ENLACE, ETIQUETA } from "../ui";

export function Paginacion({
  pagina,
  totalPaginas,
  total,
  hrefAnterior,
  hrefSiguiente,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  hrefAnterior: string | null;
  hrefSiguiente: string | null;
}) {
  if (totalPaginas <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pt-4"
    >
      {hrefAnterior ? (
        <Link href={hrefAnterior} className={`${ENLACE} text-[14px]`}>
          ← Anterior
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      <span className={ETIQUETA}>
        página {pagina} de {totalPaginas} · {total}
      </span>
      {hrefSiguiente ? (
        <Link href={hrefSiguiente} className={`${ENLACE} text-[14px]`}>
          Siguiente →
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}

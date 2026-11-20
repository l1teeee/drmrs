import { connection } from "next/server";

import { ETIQUETA, TITULO } from "@/app/admin/ui";
import { TransicionPagina } from "@/components/TransicionPagina";
import { adminHref } from "@/infrastructure/admin/admin-path";
import { requireAdmin } from "@/infrastructure/auth/require-admin";

import { ImportarCsv } from "./ImportarCsv";
import { selectedDrop } from "../../drop-seleccionado";

export default async function ImportarRegistrosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  await requireAdmin("page");
  const { selected, scope } = await selectedDrop((await searchParams).drop);

  return (
    <TransicionPagina>
      <main className="grid gap-4">
        <h1 className={TITULO}>{scope === "drop" && selected ? `Importar a ${selected.name}` : "Importar"}</h1>
        {scope === "todos" || !selected ? <p>Elige un archivo arriba para importar.</p> : <>
        <p className="max-w-[60ch] text-[14px] text-tinta/80">
          Exporta el Google Sheet como CSV y súbelo aquí. Primero verás qué se va a
          importar; nada se guarda hasta confirmar.
        </p>
        <p className={ETIQUETA}>
          Columnas obligatorias: nombre, whatsapp, instagram. Opcionales: número,
          correo, talla, dreamer, origen, fecha.
        </p>
        <ImportarCsv
          previewUrl={adminHref(`/registros/importar/preview?drop=${selected.id}`)}
          runUrl={adminHref(`/registros/importar/run?drop=${selected.id}`)}
          registrosUrl={adminHref(`/registros?drop=${selected.id}`)}
        />
        </>}
      </main>
    </TransicionPagina>
  );
}

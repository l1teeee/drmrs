import { connection } from "next/server";

import { ETIQUETA, TITULO } from "@/app/admin/ui";
import { TransicionPagina } from "@/components/TransicionPagina";
import { adminHref } from "@/infrastructure/admin/admin-path";
import { requireAdmin } from "@/infrastructure/auth/require-admin";

import { ImportarCsv } from "./ImportarCsv";

export default async function ImportarRegistrosPage() {
  await connection();
  await requireAdmin("page");

  return (
    <TransicionPagina>
      <main className="grid gap-4">
        <h1 className={TITULO}>Importar registros</h1>
        <p className="max-w-[60ch] text-[14px] text-tinta/80">
          Exporta el Google Sheet como CSV y súbelo aquí. Primero verás qué se va a
          importar; nada se guarda hasta confirmar.
        </p>
        <p className={ETIQUETA}>
          Columnas obligatorias: nombre, whatsapp, instagram. Opcionales: número,
          correo, talla, dreamer, origen, fecha.
        </p>
        <ImportarCsv
          previewUrl={adminHref("/registros/importar/preview")}
          runUrl={adminHref("/registros/importar/run")}
          registrosUrl={adminHref("/registros")}
        />
      </main>
    </TransicionPagina>
  );
}

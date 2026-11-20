import { connection } from "next/server";

import { listMessageTemplates } from "@/application/admin-registros/admin-registros";
import { TransicionPagina } from "@/components/TransicionPagina";
import { TEMPLATE_KEYS, type TemplateKey } from "@/domain/messaging/message-template";
import { adminRegistrosDependencies } from "@/infrastructure/admin/admin-registros-runtime";
import { requireAdmin } from "@/infrastructure/auth/require-admin";

import { TITULO } from "../../ui";
import { EditorPlantilla } from "./EditorPlantilla";

const TEMPLATE_TITLES: Record<TemplateKey, string> = {
  BIENVENIDA: "Bienvenida",
  CAMBIO_ESTADO: "Cambio de estado",
  RECORDATORIO_DROP: "Recordatorio del drop",
  ACTIVACION: "Activación",
};

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

export default async function PlantillasPage() {
  await connection();
  await requireAdmin("page");

  const templates = await listMessageTemplates(adminRegistrosDependencies());
  const byKey = new Map(templates.map((template) => [template.key, template]));
  const ordered = TEMPLATE_KEYS.map((key) => byKey.get(key)).filter(
    (entry): entry is NonNullable<typeof entry> => entry !== undefined,
  );

  return (
    <TransicionPagina>
      <main className="grid gap-8">
        <h1 className={TITULO}>Plantillas de Instagram</h1>
        <div className="grid items-start gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
          {ordered.map((template) => (
            <EditorPlantilla
              key={template.key}
              templateKey={template.key}
              title={TEMPLATE_TITLES[template.key]}
              initialBody={template.body}
              updatedAtLabel={dateFormatter.format(template.updatedAt)}
            />
          ))}
        </div>
      </main>
    </TransicionPagina>
  );
}

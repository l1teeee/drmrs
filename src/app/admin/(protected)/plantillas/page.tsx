import { connection } from "next/server";

import { listMessageTemplates } from "@/application/admin-registros/admin-registros";
import { TransicionPagina } from "@/components/TransicionPagina";
import { formatDropDateLabel, pickCurrentDrop } from "@/domain/drop/drop";
import { TEMPLATE_KEYS, TEMPLATE_LABELS } from "@/domain/messaging/message-template";
import { adminRegistrosDependencies } from "@/infrastructure/admin/admin-registros-runtime";
import { requireAdmin } from "@/infrastructure/auth/require-admin";

import { TITULO } from "../../ui";
import { selectedDrop } from "../drop-seleccionado";
import { EditorPlantilla } from "./EditorPlantilla";

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
  const { drops, selected } = await selectedDrop();
  const sampleDrop = selected ?? pickCurrentDrop(drops);
  const byKey = new Map(templates.map((template) => [template.key, template]));
  const ordered = TEMPLATE_KEYS.map((key) => byKey.get(key)).filter(
    (entry): entry is NonNullable<typeof entry> => entry !== undefined,
  );

  return (
    <TransicionPagina>
      <main className="grid gap-6">
        <h1 className={TITULO}>Plantillas de Instagram</h1>
        <div className="grid items-start gap-x-6 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
          {ordered.map((template) => (
            <EditorPlantilla
              key={template.key}
              templateKey={template.key}
              title={TEMPLATE_LABELS[template.key]}
              initialBody={template.body}
              updatedAtLabel={dateFormatter.format(template.updatedAt)}
              archivo={sampleDrop?.name ?? ""}
              fechaDrop={sampleDrop ? formatDropDateLabel(sampleDrop.registeredOpensAt) : ""}
            />
          ))}
        </div>
      </main>
    </TransicionPagina>
  );
}

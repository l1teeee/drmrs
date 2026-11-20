import Link from "next/link";
import { connection } from "next/server";

import type { AuditEntry } from "@/application/admin-registros/admin-registro-store";
import { listAuditPage } from "@/application/admin-registros/admin-registros";
import { PIECE_STATUS_LABELS } from "@/domain/registration/piece-status";
import type { PieceStatus } from "@/domain/registration/registration";
import { adminHref } from "@/infrastructure/admin/admin-path";
import { adminRegistrosDependencies } from "@/infrastructure/admin/admin-registros-runtime";
import { requireAdmin } from "@/infrastructure/auth/require-admin";

import { ENLACE, FILA, TITULO } from "../../ui";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

const STATIC_ACTION_LABELS: Record<string, string> = {
  EXPEDIENTE_LINK_REGENERATED: "Nuevo link de expediente",
  INSTAGRAM_ACTIVATION_SENT: "Activación enviada por Instagram",
  MESSAGE_TEMPLATE_UPDATED: "Plantilla editada",
  REGISTRATIONS_EXPORTED: "Exportación CSV",
  REGISTRATIONS_IMPORTED: "Importación CSV",
  ADMIN_SIGNED_IN: "Inicio de sesión",
  ADMIN_SIGNED_OUT: "Salida",
  ADMIN_SIGN_IN_FAILED: "Intento de acceso fallido",
  ADMIN_CREATED: "Cuenta creada",
  ADMIN_PASSWORD_RESET: "Contraseña restablecida",
  ADMIN_DEACTIVATED: "Cuenta desactivada",
};

function statusLabel(raw: unknown): string {
  if (typeof raw === "string" && raw in PIECE_STATUS_LABELS) {
    return PIECE_STATUS_LABELS[raw as PieceStatus];
  }
  return typeof raw === "string" ? raw : "";
}

function formatAuditAction(entry: AuditEntry): string {
  if (entry.action === "REGISTRATION_CREATED") {
    return entry.metadata.origin === "IMPORT"
      ? "Nuevo registro (importado)"
      : "Nuevo registro";
  }
  if (entry.action === "PIECE_STATUS_CHANGED") {
    const fromLabel = statusLabel(entry.metadata.from);
    const toLabel = statusLabel(entry.metadata.to);
    return `Cambio de estado: ${fromLabel} → ${toLabel}`;
  }
  return STATIC_ACTION_LABELS[entry.action] ?? entry.action;
}

function parseBefore(raw: string | string[] | undefined): number | undefined {
  if (typeof raw !== "string" || raw.trim() === "") {
    return undefined;
  }
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

export default async function ActividadPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection();
  await requireAdmin("page");

  const resolvedParams = await searchParams;
  const before = parseBefore(resolvedParams.before);
  const entries = await listAuditPage(
    before ?? null,
    adminRegistrosDependencies(),
  );
  const lastEntry = entries[entries.length - 1];

  return (
    <main className="grid gap-6">
      <h1 className={TITULO}>Actividad</h1>

      <ul className={`border-t ${FILA}`}>
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={`grid gap-1 border-b ${FILA} py-3 font-mono text-[13px] sm:grid-cols-[10rem_12rem_1fr] sm:gap-x-6`}
          >
            <span className="text-tinta/60">
              {dateFormatter.format(entry.occurredAt)}
            </span>
            <span className="min-w-0 break-words">
              {entry.actorName ?? "Sistema"}
            </span>
            <span className="min-w-0 break-words">
              {formatAuditAction(entry)}
            </span>
          </li>
        ))}
      </ul>

      {entries.length === 50 && lastEntry && (
        <div>
          <Link
            href={adminHref(`/actividad?before=${lastEntry.id}`)}
            className={`${ENLACE} text-[14px]`}
          >
            Más antiguos
          </Link>
        </div>
      )}
    </main>
  );
}

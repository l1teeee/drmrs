import Link from "next/link";
import { connection } from "next/server";

import type { AuditEntry } from "@/application/admin-registros/admin-registro-store";
import { listAuditPage } from "@/application/admin-registros/admin-registros";
import { TransicionPagina } from "@/components/TransicionPagina";
import {
  TEMPLATE_KEYS,
  TEMPLATE_LABELS,
  type TemplateKey,
} from "@/domain/messaging/message-template";
import { formatRegistrationNumber } from "@/domain/registration/expediente-link";
import { PIECE_STATUS_LABELS } from "@/domain/registration/piece-status";
import type { PieceStatus } from "@/domain/registration/registration";
import { adminHref } from "@/infrastructure/admin/admin-path";
import { adminRegistrosDependencies } from "@/infrastructure/admin/admin-registros-runtime";
import { requireAdmin } from "@/infrastructure/auth/require-admin";

import { ENLACE, FILA, TITULO } from "../../ui";
import { Paginacion } from "../Paginacion";
import { hrefPagina, parsePagina } from "../parametros-pagina";

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
  REGISTRATION_DELETED: "Registro borrado",
  INSTAGRAM_CHAT_DELETED: "Chat borrado",
  INSTAGRAM_CONTACT_DELETED: "Contacto borrado",
  INSTAGRAM_MESSAGE_QUEUED: "Mensaje en cola",
  INSTAGRAM_MESSAGE_DISCARDED: "Mensaje descartado",
  INSTAGRAM_CONTACT_LINKED: "Contacto vinculado",
  INSTAGRAM_CONNECTED: "Instagram conectado",
  INSTAGRAM_DISCONNECTED: "Instagram desconectado",
  PIECE_PHOTO_ADDED: "Foto de pieza agregada",
  PIECE_PHOTO_DELETED: "Foto de pieza borrada",
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

const QUEUED_STATUS_LABELS: Record<string, string> = {
  QUEUED: "se envía ya",
  WAITING_CONTACT: "espera a que escriba",
  WAITING_WINDOW: "fuera de la ventana de 24 h",
};

const LINK_METHOD_LABELS: Record<string, string> = {
  CODE: "por código",
  USERNAME: "por usuario de Instagram",
  MANUAL: "a mano",
};

function isTemplateKey(value: unknown): value is TemplateKey {
  return typeof value === "string" && (TEMPLATE_KEYS as readonly string[]).includes(value);
}

function registroTexto(entry: AuditEntry): string | null {
  if (entry.registro !== null) {
    const { numero, nombre, instagram } = entry.registro;
    return `#${formatRegistrationNumber(numero)} ${nombre} (@${instagram})`;
  }
  const number = entry.metadata.number;
  if (typeof number === "number") {
    return `#${formatRegistrationNumber(number)}`;
  }
  return null;
}

function detalleParts(entry: AuditEntry): Array<string | null> {
  const { metadata } = entry;
  switch (entry.action) {
    case "REGISTRATION_CREATED":
      return [registroTexto(entry), metadata.origin === "IMPORT" ? "importado" : "desde la web"];
    case "PIECE_STATUS_CHANGED":
    case "EXPEDIENTE_LINK_REGENERATED":
    case "INSTAGRAM_ACTIVATION_SENT":
    case "INSTAGRAM_MESSAGE_DISCARDED":
    case "INSTAGRAM_MESSAGE_SENT_MANUALLY":
    case "REGISTRATION_DELETED":
    case "PIECE_PHOTO_ADDED":
    case "PIECE_PHOTO_DELETED":
      return [registroTexto(entry)];
    case "INSTAGRAM_MESSAGE_QUEUED": {
      const status = metadata.status;
      return [
        isTemplateKey(metadata.template) ? TEMPLATE_LABELS[metadata.template] : "mensaje libre",
        typeof status === "string" ? (QUEUED_STATUS_LABELS[status] ?? null) : null,
        metadata.via === "auto" ? "automático" : null,
        registroTexto(entry),
      ];
    }
    case "INSTAGRAM_CONTACT_LINKED": {
      const by = metadata.by;
      return [registroTexto(entry), typeof by === "string" ? (LINK_METHOD_LABELS[by] ?? null) : null];
    }
    case "INSTAGRAM_CHAT_DELETED":
      return [
        registroTexto(entry),
        typeof metadata.deleted === "number" ? `${metadata.deleted} mensajes` : null,
      ];
    case "MESSAGE_TEMPLATE_UPDATED":
      return [isTemplateKey(entry.entityId) ? TEMPLATE_LABELS[entry.entityId] : null];
    case "REGISTRATIONS_IMPORTED":
      return [
        typeof metadata.created === "number" ? `${metadata.created} nuevos` : null,
        typeof metadata.existing === "number" ? `${metadata.existing} ya estaban` : null,
        typeof metadata.conflicts === "number" ? `${metadata.conflicts} en conflicto` : null,
      ];
    case "REGISTRATIONS_EXPORTED":
      return [typeof metadata.count === "number" ? `${metadata.count} registros` : null];
    case "ADMIN_SIGN_IN_FAILED":
      return [metadata.reason === "locked" ? "cuenta bloqueada" : "contraseña incorrecta"];
    default:
      return [];
  }
}

function detalleAuditoria(entry: AuditEntry): string | null {
  const parts = detalleParts(entry).filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export default async function ActividadPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection();
  await requireAdmin("page");

  const resolvedParams = await searchParams;
  const resultado = await listAuditPage(
    parsePagina(resolvedParams.pagina),
    adminRegistrosDependencies(),
  );
  const href = (n: number) => hrefPagina(adminHref("/actividad"), {}, "pagina", n);

  return (
    <TransicionPagina>
      <main className="grid gap-4">
        <h1 className={TITULO}>Actividad</h1>

        <ul className={`border-t ${FILA}`}>
          {resultado.items.map((entry) => {
            const detalle = detalleAuditoria(entry);
            return (
            <li
              key={entry.id}
              className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 border-b ${FILA} py-2.5 font-mono text-[12px] sm:grid-cols-[9rem_10rem_minmax(0,1fr)] sm:gap-x-6`}
            >
              <span className="text-tinta/60">
                {dateFormatter.format(entry.occurredAt)}
              </span>
              <span className="min-w-0 break-words">
                {entry.actorName ?? "Sistema"}
              </span>
              <div className="col-span-2 grid min-w-0 gap-0.5 sm:col-span-1">
                <span className="break-words">{formatAuditAction(entry)}</span>
                {detalle === null ? null : (
                  <span className="break-words text-tinta/60">
                    {entry.registro === null ? (
                      detalle
                    ) : (
                      <Link
                        href={adminHref("/registros/" + entry.registro.id)}
                        className={ENLACE}
                      >
                        {detalle}
                      </Link>
                    )}
                  </span>
                )}
              </div>
            </li>
            );
          })}
        </ul>

        <Paginacion
          pagina={resultado.page}
          totalPaginas={resultado.totalPages}
          total={resultado.total}
          hrefAnterior={resultado.page > 1 ? href(resultado.page - 1) : null}
          hrefSiguiente={resultado.page < resultado.totalPages ? href(resultado.page + 1) : null}
        />
      </main>
    </TransicionPagina>
  );
}

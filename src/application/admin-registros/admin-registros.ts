import type { RateLimitCheck } from "@/application/ports/rate-limit";
import type { ExpedienteCodes } from "@/application/registration/registration-store";
import type {
  ChangeStatusInput,
  ListFilters,
  TemplateUpdateInput,
} from "@/contracts/admin-registros";
import { findUnknownVariables } from "@/domain/messaging/message-template";
import { expedientePath, formatRegistrationNumber } from "@/domain/registration/expediente-link";
import { PIECE_STATUS_LABELS, SIZE_LABELS } from "@/domain/registration/piece-status";

import type { AdminRegistroRow, AdminRegistroStore, AuditEntry } from "./admin-registro-store";

export interface AdminRegistrosDependencies {
  store: AdminRegistroStore;
  codes: ExpedienteCodes;
  baseUrl: string;
  checkAdminAction: RateLimitCheck;
}

export type AdminRegistroView = AdminRegistroRow & { expedienteUrl: string };

export function expedienteUrl(
  registration: Pick<AdminRegistroRow, "id" | "registrationNumber" | "linkVersion">,
  deps: AdminRegistrosDependencies,
): string {
  return deps.baseUrl + expedientePath(
    registration.registrationNumber,
    deps.codes.codeFor(registration.id, registration.linkVersion),
  );
}

export async function listRegistros(
  filters: ListFilters,
  deps: AdminRegistrosDependencies,
): Promise<AdminRegistroView[]> {
  const rows = await deps.store.list(filters);
  return rows.map((row) => ({ ...row, expedienteUrl: expedienteUrl(row, deps) }));
}

export async function changePieceStatus(
  adminId: string,
  input: ChangeStatusInput,
  deps: AdminRegistrosDependencies,
): Promise<{ kind: "changed" | "conflict" | "not_found" | "rate_limited" }> {
  const limit = await deps.checkAdminAction(adminId);
  if (!limit.allowed) {
    return { kind: "rate_limited" };
  }

  const kind = await deps.store.changeStatus(
    adminId,
    input.registrationId,
    input.expectedStatus,
    input.newStatus,
  );
  return { kind };
}

export async function regenerateExpedienteLink(
  adminId: string,
  id: string,
  deps: AdminRegistrosDependencies,
): Promise<
  | { kind: "regenerated"; expedienteUrl: string; linkVersion: number }
  | { kind: "not_found" | "rate_limited" }
> {
  const limit = await deps.checkAdminAction(adminId);
  if (!limit.allowed) {
    return { kind: "rate_limited" };
  }

  const registration = await deps.store.findById(id);
  if (!registration) {
    return { kind: "not_found" };
  }
  const regenerated = await deps.store.regenerateLink(adminId, id);
  if (!regenerated) {
    return { kind: "not_found" };
  }

  return {
    kind: "regenerated",
    expedienteUrl: expedienteUrl({ ...registration, linkVersion: regenerated.linkVersion }, deps),
    linkVersion: regenerated.linkVersion,
  };
}

export async function updateTemplate(
  adminId: string,
  input: TemplateUpdateInput,
  deps: AdminRegistrosDependencies,
): Promise<
  | { kind: "updated" | "rate_limited" }
  | { kind: "unknown_variables"; variables: string[] }
> {
  const limit = await deps.checkAdminAction(adminId);
  if (!limit.allowed) {
    return { kind: "rate_limited" };
  }

  const variables = findUnknownVariables(input.body);
  if (variables.length > 0) {
    return { kind: "unknown_variables", variables };
  }

  await deps.store.updateTemplate(adminId, input.key, input.body);
  return { kind: "updated" };
}

export async function exportRegistros(
  adminId: string,
  deps: AdminRegistrosDependencies,
): Promise<string[][]> {
  const registrations = await listRegistros({}, deps);
  const rows = [[
    "numero", "nombre", "whatsapp", "correo", "instagram", "talla", "estado", "origen",
    "fuente", "fecha_registro", "expediente",
  ]];
  for (const registration of registrations) {
    rows.push([
      formatRegistrationNumber(registration.registrationNumber),
      registration.fullName,
      registration.whatsappDigits,
      registration.email ?? "",
      registration.instagramHandle,
      SIZE_LABELS[registration.size],
      PIECE_STATUS_LABELS[registration.pieceStatus],
      registration.origin,
      registration.source,
      registration.registeredAt.toISOString(),
      registration.expedienteUrl,
    ]);
  }
  await deps.store.recordExport(adminId, registrations.length);
  return rows;
}

export async function listAuditPage(
  before: number | null,
  deps: AdminRegistrosDependencies,
): Promise<AuditEntry[]> {
  return deps.store.listAudit(before, 50);
}

export async function listMessageTemplates(deps: AdminRegistrosDependencies) {
  return deps.store.listTemplates();
}

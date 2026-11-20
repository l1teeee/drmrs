import { formatDropDateLabel } from "@/domain/drop/drop";
import type { TEMPLATE_VARIABLES } from "@/domain/messaging/message-template";
import { formatRegistrationNumber } from "@/domain/registration/expediente-link";
import { PIECE_STATUS_LABELS, SIZE_LABELS } from "@/domain/registration/piece-status";
import { firstName } from "@/domain/registration/registration";

import type { AdminRegistroRow } from "./admin-registro-store";

type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export function buildTemplateValues(
  row: AdminRegistroRow,
  expedienteUrl: string,
): Record<TemplateVariable, string> {
  return {
    nombre: firstName(row.fullName),
    numero: formatRegistrationNumber(row.registrationNumber),
    talla: SIZE_LABELS[row.size],
    estado: PIECE_STATUS_LABELS[row.pieceStatus],
    link: expedienteUrl,
    fecha_drop: formatDropDateLabel(row.dropRegisteredOpensAt),
    archivo: row.dropName,
  };
}

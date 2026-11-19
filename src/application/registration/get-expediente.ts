import type { RateLimitCheck } from "@/application/ports/rate-limit";
import { parseExpedienteSlug } from "@/domain/registration/expediente-link";
import { firstName, type PieceStatus, type Size } from "@/domain/registration/registration";

import type { ExpedienteCodes, RegistrationStore } from "./registration-store";

export type ExpedienteView = {
  registrationNumber: number;
  firstName: string;
  size: Size;
  pieceStatus: PieceStatus;
};

export interface ExpedienteDependencies {
  store: RegistrationStore;
  codes: ExpedienteCodes;
  checkLookup: RateLimitCheck;
}

export async function getExpediente(
  slug: string,
  rateLimitSubject: string,
  deps: ExpedienteDependencies,
): Promise<ExpedienteView | null> {
  const parsed = parseExpedienteSlug(slug);
  if (!parsed) {
    return null;
  }

  const limit = await deps.checkLookup(rateLimitSubject);
  if (!limit.allowed) {
    return null;
  }

  const record = await deps.store.findByNumber(parsed.registrationNumber);
  if (!record || !deps.codes.matches(record.id, record.linkVersion, parsed.code)) {
    return null;
  }

  return {
    registrationNumber: record.registrationNumber,
    firstName: firstName(record.fullName),
    size: record.size,
    pieceStatus: record.pieceStatus,
  };
}

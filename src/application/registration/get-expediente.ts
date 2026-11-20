import type { RateLimitCheck } from "@/application/ports/rate-limit";
import { parseExpedienteSlug } from "@/domain/registration/expediente-link";
import { firstName, type PieceStatus, type Size } from "@/domain/registration/registration";

import type { PiecePhotoStore } from "./piece-photos";
import type { ExpedienteCodes, ExpedienteRecord, RegistrationStore } from "./registration-store";

export type ExpedienteView = {
  drop: ExpedienteRecord["drop"];
  registrationNumber: number;
  firstName: string;
  size: Size;
  pieceStatus: PieceStatus;
  photoIds: string[];
};

export interface ExpedienteDependencies {
  store: RegistrationStore;
  codes: ExpedienteCodes;
  photos: PiecePhotoStore;
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

  const record = await deps.store.findByDropAndNumber(parsed.dropNumber, parsed.registrationNumber);
  if (!record || !deps.codes.matches(record.id, record.linkVersion, parsed.code)) {
    return null;
  }

  return {
    drop: record.drop,
    registrationNumber: record.registrationNumber,
    firstName: firstName(record.fullName),
    size: record.size,
    pieceStatus: record.pieceStatus,
    photoIds: await deps.photos.listIds(record.id),
  };
}

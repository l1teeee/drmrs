import type { RateLimitCheck } from "@/application/ports/rate-limit";
import { parseExpedienteSlug } from "@/domain/registration/expediente-link";
import {
  detectImageContentType,
  MAX_PIECE_PHOTO_BYTES,
  type PiecePhotoContentType,
} from "@/domain/registration/piece-photo";

import type { ExpedienteCodes, RegistrationStore } from "./registration-store";

export interface PiecePhotoStore {
  add(input: {
    registrationId: string;
    contentType: PiecePhotoContentType;
    data: Uint8Array;
    adminId: string;
  }): Promise<{ ok: true; id: string } | { ok: false; error: "NOT_FOUND" | "LIMIT" | "STAGE" }>;
  listIds(registrationId: string): Promise<string[]>;
  get(
    registrationId: string,
    photoId: string,
  ): Promise<{ contentType: PiecePhotoContentType; data: Uint8Array } | null>;
  delete(adminId: string, registrationId: string, photoId: string): Promise<boolean>;
}

export interface PiecePhotoAdminDependencies {
  photos: PiecePhotoStore;
  checkAdminAction: RateLimitCheck;
}

export async function listPiecePhotoIds(
  registrationId: string,
  deps: { photos: PiecePhotoStore },
): Promise<string[]> {
  return deps.photos.listIds(registrationId);
}

export async function uploadPiecePhoto(
  adminId: string,
  registrationId: string,
  data: Uint8Array,
  deps: PiecePhotoAdminDependencies,
): Promise<
  | { kind: "rate_limited" | "too_large" | "invalid_type" | "not_found" | "limit" | "stage" }
  | { kind: "added"; id: string }
> {
  const limit = await deps.checkAdminAction(adminId);
  if (!limit.allowed) return { kind: "rate_limited" };
  if (data.byteLength < 1 || data.byteLength > MAX_PIECE_PHOTO_BYTES) {
    return { kind: "too_large" };
  }
  const contentType = detectImageContentType(data);
  if (contentType === null) return { kind: "invalid_type" };

  const result = await deps.photos.add({ registrationId, contentType, data, adminId });
  if (result.ok) return { kind: "added", id: result.id };
  if (result.error === "NOT_FOUND") return { kind: "not_found" };
  if (result.error === "STAGE") return { kind: "stage" };
  return { kind: "limit" };
}

export async function deletePiecePhoto(
  adminId: string,
  registrationId: string,
  photoId: string,
  deps: PiecePhotoAdminDependencies,
): Promise<{ kind: "rate_limited" | "not_found" | "deleted" }> {
  const limit = await deps.checkAdminAction(adminId);
  if (!limit.allowed) return { kind: "rate_limited" };
  const deleted = await deps.photos.delete(adminId, registrationId, photoId);
  return { kind: deleted ? "deleted" : "not_found" };
}

export async function getExpedientePhoto(
  slug: string,
  photoId: string,
  deps: { store: RegistrationStore; codes: ExpedienteCodes; photos: PiecePhotoStore },
): Promise<{ contentType: PiecePhotoContentType; data: Uint8Array } | null> {
  const parsed = parseExpedienteSlug(slug);
  if (!parsed) return null;

  const record = await deps.store.findByDropAndNumber(parsed.dropNumber, parsed.registrationNumber);
  if (!record || !deps.codes.matches(record.id, record.linkVersion, parsed.code)) {
    return null;
  }
  return deps.photos.get(record.id, photoId);
}

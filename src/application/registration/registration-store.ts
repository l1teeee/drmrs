import type { Drop } from "@/domain/drop/drop";
import type { NewRegistration, PieceStatus, Size } from "@/domain/registration/registration";

export function registrationNumberLockKey(dropId: string): string {
  return `drmr_registration_number:${dropId}`;
}

export type RegisterOutcome =
  | {
      kind: "created";
      drop: Pick<Drop, "number" | "name">;
      id: string;
      registrationNumber: number;
      linkVersion: number;
      igLinkCode: string | null;
    }
  | {
      kind: "existing";
      drop: Pick<Drop, "number" | "name">;
      id: string;
      registrationNumber: number;
      linkVersion: number;
      igLinkCode: string | null;
      instagramMatches: boolean;
    }
  | { kind: "instagram_taken" }
  | { kind: "closed" };

export type ExpedienteRecord = {
  drop: Pick<Drop, "number" | "name" | "registeredOpensAt" | "publicOpensAt" | "pieces">;
  id: string;
  registrationNumber: number;
  fullName: string;
  size: Size;
  pieceStatus: PieceStatus;
  linkVersion: number;
};

export interface RegistrationStore {
  registerOrFind(registration: NewRegistration, dropId: string): Promise<RegisterOutcome>;
  findByDropAndNumber(dropNumber: number, registrationNumber: number): Promise<ExpedienteRecord | null>;
}

export interface ExpedienteCodes {
  codeFor(id: string, linkVersion: number): string;
  matches(id: string, linkVersion: number, code: string): boolean;
}

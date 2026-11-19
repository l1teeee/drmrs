import type { NewRegistration, PieceStatus, Size } from "@/domain/registration/registration";

export type RegisterOutcome =
  | {
      kind: "created";
      id: string;
      registrationNumber: number;
      linkVersion: number;
      igLinkCode: string | null;
    }
  | {
      kind: "existing";
      id: string;
      registrationNumber: number;
      linkVersion: number;
      igLinkCode: string | null;
      instagramMatches: boolean;
    }
  | { kind: "instagram_taken" };

export type ExpedienteRecord = {
  id: string;
  registrationNumber: number;
  fullName: string;
  size: Size;
  pieceStatus: PieceStatus;
  linkVersion: number;
};

export interface RegistrationStore {
  registerOrFind(registration: NewRegistration): Promise<RegisterOutcome>;
  findByNumber(registrationNumber: number): Promise<ExpedienteRecord | null>;
}

export interface ExpedienteCodes {
  codeFor(id: string, linkVersion: number): string;
  matches(id: string, linkVersion: number, code: string): boolean;
}

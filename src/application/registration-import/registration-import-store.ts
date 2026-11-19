import type { ParsedImportRow } from "@/domain/registration-import/import-rows";

export type RowClassification = {
  line: number;
  status: "new" | "existing" | "conflict";
  reason?: string;
  registrationNumber: number | null;
};

export type ImportSummary = { created: number; existing: number; conflicts: number };

export interface RegistrationImportStore {
  classify(rows: ParsedImportRow[]): Promise<RowClassification[]>;
  insertNew(adminId: string, rows: ParsedImportRow[]): Promise<ImportSummary>;
}

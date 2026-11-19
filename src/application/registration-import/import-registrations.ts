import { parseCsv } from "@/domain/registration-import/csv";
import { parseImportTable } from "@/domain/registration-import/import-rows";

import type { RateLimitCheck } from "../ports/rate-limit";
import type { ImportSummary, RegistrationImportStore, RowClassification } from "./registration-import-store";

export type RegistrationImportDependencies = {
  store: RegistrationImportStore;
  checkPreview: RateLimitCheck;
  checkRun: RateLimitCheck;
};

type ImportFailure = { ok: false; reason: string };
type PreviewRow = RowClassification | { line: number; status: "invalid"; reason: string };
type PreviewResult = ImportFailure | {
  ok: true;
  rows: PreviewRow[];
  counts: { new: number; existing: number; conflict: number; invalid: number };
};
type RunResult = ImportFailure | { ok: true; summary: ImportSummary & { invalid: number } };

function parseImport(csvText: string): ReturnType<typeof parseImportTable> {
  let cells: string[][];
  try {
    cells = parseCsv(csvText);
  } catch {
    return { ok: false, reason: "CSV inválido: campo sin cerrar" };
  }
  return parseImportTable(cells);
}

export async function previewImport(
  csvText: string,
  adminId: string,
  deps: RegistrationImportDependencies,
): Promise<PreviewResult> {
  const limit = await deps.checkPreview(adminId);
  if (!limit.allowed) return { ok: false, reason: "rate_limited" };

  const parsed = parseImport(csvText);
  if (!parsed.ok) return parsed;

  const classified = await deps.store.classify(parsed.rows);
  const rows: PreviewRow[] = [...classified];
  for (const row of parsed.invalid) rows.push({ ...row, status: "invalid" });
  rows.sort((left, right) => left.line - right.line);
  const counts = { new: 0, existing: 0, conflict: 0, invalid: 0 };
  for (const row of rows) counts[row.status] += 1;
  return { ok: true, rows, counts };
}

export async function runImport(
  csvText: string,
  adminId: string,
  deps: RegistrationImportDependencies,
): Promise<RunResult> {
  const limit = await deps.checkRun(adminId);
  if (!limit.allowed) return { ok: false, reason: "rate_limited" };

  const parsed = parseImport(csvText);
  if (!parsed.ok) return parsed;

  const summary = await deps.store.insertNew(adminId, parsed.rows);
  return { ok: true, summary: { ...summary, invalid: parsed.invalid.length } };
}

import type { Size } from "@/domain/registration/registration";

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_COLUMNS = 40;

export type ImportField =
  | "numero"
  | "nombre"
  | "whatsapp"
  | "correo"
  | "instagram"
  | "talla"
  | "dreamer"
  | "origen"
  | "fecha";

export type ParsedImportRow = {
  line: number;
  registrationNumber: number | null;
  fullName: string;
  instagramHandle: string;
  whatsappDigits: string;
  email: string | null;
  size: Size;
  archiveNominee: string | null;
  source: string;
  registeredAt: Date | null;
};

export type InvalidImportRow = { line: number; reason: string };

const aliases: Record<ImportField, readonly string[]> = {
  numero: ["numero", "no", "no.", "#", "num", "registro", "numero de registro", "registro no"],
  nombre: ["nombre", "name", "nombre completo"],
  whatsapp: ["whatsapp", "telefono", "tel", "celular", "phone", "numero de whatsapp"],
  correo: ["correo", "email", "mail", "e-mail", "correo electronico"],
  instagram: ["instagram", "ig", "usuario", "usuario de instagram"],
  talla: ["talla", "size"],
  dreamer: ["dreamer", "quien deberia estar en el archivo", "nominado"],
  origen: ["src", "origen", "fuente", "source"],
  fecha: ["fecha", "timestamp", "marca temporal", "fecha de registro", "date"],
};

function normalizeHeader(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/:/g, "").trim().replace(/\s+/g, " ");
}

function isEmptyRow(row: string[]): boolean {
  return row.every((value) => value.trim() === "");
}

function validCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function parseDate(value: string): Date | null {
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  if (local) {
    const day = Number(local[1]);
    const month = Number(local[2]);
    const year = Number(local[3]);
    const hours = Number(local[4] ?? 0);
    const minutes = Number(local[5] ?? 0);
    const seconds = Number(local[6] ?? 0);
    if (!validCalendarDate(year, month, day) || hours > 23 || minutes > 59 || seconds > 59) {
      return null;
    }
    return new Date(Date.UTC(year, month - 1, day, hours + 6, minutes, seconds));
  }

  if (/^\d+(?:\.\d+)?$/.test(value)) {
    const serial = Number(value);
    if (serial >= 20000 && serial <= 80000) {
      return new Date(Date.UTC(1899, 11, 30, 6) + Math.round(serial * 86_400_000));
    }
    return null;
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i.exec(value);
  if (iso && validCalendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date;
  }
  return null;
}

function parseRow(
  cells: string[],
  columns: Partial<Record<ImportField, number>>,
  line: number,
): { ok: true; row: ParsedImportRow } | { ok: false; reason: string } {
  function cell(field: ImportField): string {
    const index = columns[field];
    return index === undefined ? "" : cells[index] ?? "";
  }

  const numberText = cell("numero").trim();
  const registrationNumber = numberText === "" ? null : Number(numberText.replace(/\D/g, ""));
  if (registrationNumber !== null &&
    (!Number.isInteger(registrationNumber) || registrationNumber < 1 || registrationNumber > 9999)) {
    return { ok: false, reason: "número inválido" };
  }

  const nameText = cell("nombre");
  const fullName = nameText.trim().replace(/\s+/g, " ");
  if (/[\p{Cc}\p{Cf}]/u.test(nameText) || fullName.length < 2 || fullName.length > 80) {
    return { ok: false, reason: "nombre inválido" };
  }

  let whatsappDigits = cell("whatsapp").replace(/\D/g, "");
  if (whatsappDigits.length === 10) {
    whatsappDigits = `52${whatsappDigits}`;
  } else if (whatsappDigits.length === 13 && whatsappDigits.startsWith("521")) {
    whatsappDigits = `52${whatsappDigits.slice(-10)}`;
  }
  if (!/^52\d{10}$/.test(whatsappDigits)) {
    return { ok: false, reason: "whatsapp inválido" };
  }

  const email = cell("correo").trim().toLowerCase() || null;
  if (email !== null && (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email))) {
    return { ok: false, reason: "correo inválido" };
  }

  let instagramHandle = cell("instagram").trim();
  const instagramPath = instagramHandle.toLowerCase().indexOf("instagram.com/");
  if (instagramPath !== -1) {
    instagramHandle = instagramHandle.slice(instagramPath + "instagram.com/".length).split(/[/?#]/)[0];
  }
  instagramHandle = instagramHandle.replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(instagramHandle)) {
    return { ok: false, reason: "instagram inválido" };
  }

  const sizeText = cell("talla").trim().toUpperCase();
  let size: Size;
  if (sizeText === "S" || sizeText === "M" || sizeText === "L" || sizeText === "XL") {
    size = sizeText;
  } else if (["", "NO SE", "NO SÉ", "NOSE"].includes(sizeText)) {
    size = "NO_SE";
  } else {
    return { ok: false, reason: "talla inválida" };
  }

  const nomineeText = cell("dreamer");
  const archiveNominee = nomineeText.trim() || null;
  if (/[\p{Cc}\p{Cf}]/u.test(nomineeText) || (archiveNominee !== null && archiveNominee.length > 80)) {
    return { ok: false, reason: "dreamer inválido" };
  }

  const source = cell("origen").trim().replace(/[^A-Za-z0-9._:/-]/g, "").slice(0, 40) || "importado";
  const dateText = cell("fecha").trim();
  const registeredAt = dateText === "" ? null : parseDate(dateText);
  if (dateText !== "" && registeredAt === null) {
    return { ok: false, reason: "fecha no reconocida" };
  }

  return {
    ok: true,
    row: {
      line, registrationNumber, fullName, instagramHandle, whatsappDigits, email,
      size, archiveNominee, source, registeredAt,
    },
  };
}

export function parseImportTable(
  cells: string[][],
): { ok: true; rows: ParsedImportRow[]; invalid: InvalidImportRow[] } | { ok: false; reason: string } {
  if (cells.some((row) => row.length > MAX_IMPORT_COLUMNS)) {
    return { ok: false, reason: `El archivo supera ${MAX_IMPORT_COLUMNS} columnas` };
  }

  const headerIndex = cells.findIndex((row) => !isEmptyRow(row));
  const headers = cells[headerIndex] ?? [];
  const columns: Partial<Record<ImportField, number>> = {};
  const fields = Object.keys(aliases) as ImportField[];
  for (let index = 0; index < headers.length; index += 1) {
    const header = normalizeHeader(headers[index]);
    const field = fields.find((field) => aliases[field].includes(header));
    if (field !== undefined && columns[field] === undefined) columns[field] = index;
  }
  const required: ImportField[] = ["nombre", "whatsapp", "instagram"];
  const missing = required.filter((field) => columns[field] === undefined);
  if (missing.length > 0) {
    return { ok: false, reason: `Faltan columnas: ${missing.join(", ")}` };
  }

  const rows: ParsedImportRow[] = [];
  const invalid: InvalidImportRow[] = [];
  const whatsapps = new Set<string>();
  const instagrams = new Set<string>();
  const numbers = new Set<number>();
  let dataRows = 0;
  let nextLine = 1;
  for (let index = 0; index < cells.length; index += 1) {
    const line = nextLine;
    nextLine += 1;
    // Las celdas entre comillas pueden abarcar varias líneas del archivo.
    for (const value of cells[index]) {
      nextLine += value.match(/\r\n|\r|\n/g)?.length ?? 0;
    }
    if (index <= headerIndex) continue;
    if (isEmptyRow(cells[index])) continue;
    dataRows += 1;
    if (dataRows > MAX_IMPORT_ROWS) {
      return { ok: false, reason: `El archivo supera ${MAX_IMPORT_ROWS} filas de datos` };
    }

    const parsed = parseRow(cells[index], columns, line);
    if (!parsed.ok) {
      invalid.push({ line, reason: parsed.reason });
      continue;
    }
    const row = parsed.row;
    if (whatsapps.has(row.whatsappDigits) || instagrams.has(row.instagramHandle) ||
      (row.registrationNumber !== null && numbers.has(row.registrationNumber))) {
      invalid.push({ line, reason: "duplicado en el archivo" });
      continue;
    }
    whatsapps.add(row.whatsappDigits);
    instagrams.add(row.instagramHandle);
    if (row.registrationNumber !== null) numbers.add(row.registrationNumber);
    rows.push(row);
  }

  return { ok: true, rows, invalid };
}

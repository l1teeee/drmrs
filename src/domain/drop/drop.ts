import { formatRegistrationNumber } from "@/domain/registration/expediente-link";

export const DROP_STATUSES = ["PREPARACION", "REGISTRO", "CERRADO"] as const;
export type DropStatus = (typeof DROP_STATUSES)[number];

export const DROP_STATUS_LABELS: Record<DropStatus, string> = {
  PREPARACION: "en preparación",
  REGISTRO: "registro abierto",
  CERRADO: "cerrado",
};

export interface Drop {
  id: string;
  number: number;
  name: string;
  registeredOpensAt: Date;
  publicOpensAt: Date;
  pieces: number;
  status: DropStatus;
}

export const DROP_TIME_ZONE = "America/Mexico_City";
export const MEXICO_UTC_OFFSET = "-06:00";

export function formatDropNumber(n: number): string {
  return String(n).padStart(3, "0");
}

export function formatRegistrationTag(dropNumber: number, registrationNumber: number): string {
  return `${formatDropNumber(dropNumber)}·${formatRegistrationNumber(registrationNumber)}`;
}

function dateParts(d: Date) {
  const parts = new Intl.DateTimeFormat("es-MX", {
    timeZone: DROP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  return {
    year: part("year").padStart(4, "0"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
  };
}

export function formatDropDateLabel(d: Date): string {
  const p = dateParts(d);
  const weekday = new Intl.DateTimeFormat("es-MX", {
    timeZone: DROP_TIME_ZONE,
    weekday: "long",
  }).format(d);
  return `${weekday} ${p.day}.${p.month} a las ${p.hour}:${p.minute}`;
}

export function formatDropDateHeadline(d: Date): string {
  const p = dateParts(d);
  const label = new Intl.DateTimeFormat("es-MX", {
    timeZone: DROP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d).replace(",", "");
  return `${label[0].toUpperCase()}${label.slice(1)} · ${p.hour}:${p.minute}`;
}

export function formatDropDateStamp(d: Date): string {
  const p = dateParts(d);
  return `${p.day}.${p.month}.${p.year.slice(-2)}, ${p.hour}:${p.minute} h`;
}

export function formatDropDateShort(d: Date): string {
  const p = dateParts(d);
  return `${p.day}.${p.month}`;
}

export function toMexicoLocalInput(d: Date): string {
  const p = dateParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function parseMexicoLocalInput(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null;
  const date = new Date(`${s}:00${MEXICO_UTC_OFFSET}`);
  if (!Number.isFinite(date.getTime())) return null;
  return toMexicoLocalInput(date) === s ? date : null;
}

export function pickCurrentDrop(drops: readonly Drop[]): Drop | null {
  const open = drops.find((drop) => drop.status === "REGISTRO");
  if (open) return open;
  let latest: Drop | null = null;
  for (const drop of drops) {
    if (drop.status === "CERRADO" && (latest === null || drop.number > latest.number)) latest = drop;
  }
  return latest;
}

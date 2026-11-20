import { messagingWindowRemainingMs } from "@/domain/messaging/messaging-window";

const HOUR_MS = 60 * 60 * 1000;

export interface EstadoInstagram {
  activo: boolean;
  etiqueta: string;
}

export function estadoInstagram(lastInboundAt: Date | null, now: Date): EstadoInstagram {
  const remaining = messagingWindowRemainingMs(lastInboundAt, now);
  if (remaining <= 0) return { activo: false, etiqueta: "Inactivo" };
  const hours = Math.floor(remaining / HOUR_MS);
  if (hours < 1) return { activo: true, etiqueta: "Activo · queda menos de 1 h" };
  if (hours === 1) return { activo: true, etiqueta: "Activo · queda 1 h" };
  return { activo: true, etiqueta: `Activo · quedan ${hours} h` };
}

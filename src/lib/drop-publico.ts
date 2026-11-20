import {
  formatDropDateHeadline,
  formatDropDateShort,
  formatDropDateStamp,
  formatDropNumber,
  isRegistrationOpen,
  type Drop,
} from "@/domain/drop/drop";

export type EstadoDropPublico = "REGISTRO" | "CERRADO" | "SIN_DROP";

export interface DropPublico {
  estado: EstadoDropPublico;
  id: string | null;
  nombre: string | null;
  folio: string;
  numero: number | null;
  piezas: number | null;
  aperturaIso: string | null;
  aperturaTitular: string;
  aperturaSello: string;
  aperturaCorta: string;
  publicoTitular: string;
  publicoSello: string;
  publicoCorta: string;
}

export function toDropPublico(drop: Drop | null, now: Date): DropPublico {
  if (drop === null) {
    return {
      estado: "SIN_DROP",
      id: null,
      nombre: null,
      folio: "",
      numero: null,
      piezas: null,
      aperturaIso: null,
      aperturaTitular: "",
      aperturaSello: "",
      aperturaCorta: "",
      publicoTitular: "",
      publicoSello: "",
      publicoCorta: "",
    };
  }

  return {
    estado: isRegistrationOpen(drop, now) ? "REGISTRO" : "CERRADO",
    id: drop.id,
    nombre: drop.name,
    folio: formatDropNumber(drop.number),
    numero: drop.number,
    piezas: drop.pieces,
    aperturaIso: drop.registeredOpensAt.toISOString(),
    aperturaTitular: formatDropDateHeadline(drop.registeredOpensAt),
    aperturaSello: formatDropDateStamp(drop.registeredOpensAt),
    aperturaCorta: formatDropDateShort(drop.registeredOpensAt),
    publicoTitular: formatDropDateHeadline(drop.publicOpensAt),
    publicoSello: formatDropDateStamp(drop.publicOpensAt),
    publicoCorta: formatDropDateShort(drop.publicOpensAt),
  };
}

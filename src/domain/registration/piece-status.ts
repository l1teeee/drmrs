import type { PieceStatus, Size } from "./registration";

export const PIECE_STATUS_LABELS: Record<PieceStatus, string> = {
  REGISTRADO: "registrado",
  APARTADO: "apartado",
  EN_PERSONALIZACION: "en personalización a mano",
  LISTA: "lista",
  ENTREGADA: "entregada",
};

export const SIZE_LABELS: Record<Size, string> = {
  S: "S",
  M: "M",
  L: "L",
  XL: "XL",
  NO_SE: "por definir",
};

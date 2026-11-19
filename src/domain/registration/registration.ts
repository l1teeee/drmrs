export const SIZES = ["S", "M", "L", "XL", "NO_SE"] as const;
export type Size = (typeof SIZES)[number];

export const PIECE_STATUSES = [
  "REGISTRADO",
  "APARTADO",
  "EN_PERSONALIZACION",
  "LISTA",
  "ENTREGADA",
] as const;
export type PieceStatus = (typeof PIECE_STATUSES)[number];

export type NewRegistration = {
  fullName: string;
  instagramHandle: string;
  whatsappDigits: string;
  email: string | null;
  size: Size;
  archiveNominee: string | null;
  source: string;
};

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0];
}

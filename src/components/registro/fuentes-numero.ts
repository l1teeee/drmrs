import { Archivo_Black, Instrument_Serif, Permanent_Marker, Special_Elite } from "next/font/google";

export const archivoBlack = Archivo_Black({ weight: "400", subsets: ["latin"], display: "swap" });

const specialElite = Special_Elite({ weight: "400", subsets: ["latin"], display: "swap", preload: false });

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: "italic",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const permanentMarker = Permanent_Marker({ weight: "400", subsets: ["latin"], display: "swap", preload: false });

export const FUENTES_CICLO: readonly string[] = [
  specialElite.style.fontFamily,
  instrumentSerif.style.fontFamily,
  "var(--font-maquina), monospace",
  permanentMarker.style.fontFamily,
  "var(--font-inter), sans-serif",
  archivoBlack.style.fontFamily,
];

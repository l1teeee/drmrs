import { ESPERA_MS, REGISTRO_ENDPOINT } from "./config";

export type DatosRegistro = {
  nombre: string;
  whatsapp: string;
  correo: string;
  instagram: string;
  talla: string;
  dreamer: string;
  src: string;
  acepto: true;
  web: string;
  token: string;
};

export type RespuestaRegistro = {
  ok?: boolean;
  numero?: number;
  existente?: boolean;
  expediente?: string;
  instagram?: string;
  codigo?: string;
  error?: string;
};

export async function enviarRegistro(
  datos: DatosRegistro,
): Promise<RespuestaRegistro> {
  const ctl = new AbortController();
  const reloj = setTimeout(() => ctl.abort(), ESPERA_MS);
  try {
    const r = await fetch(REGISTRO_ENDPOINT, {
      method: "POST",
      signal: ctl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    const json: unknown = await r.json();
    if (typeof json !== "object" || json === null) {
      throw new Error("Respuesta inválida del registro");
    }
    return json as RespuestaRegistro;
  } finally {
    clearTimeout(reloj);
  }
}

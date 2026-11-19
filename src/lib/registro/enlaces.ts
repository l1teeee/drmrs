import { WHATSAPP_DRMR } from "./config";
import { formatearNumeroRegistro } from "./formato";

export function enlaceWhatsappRegistro(numero: number): string {
  const hola =
    "Hola, soy el Registro No. " +
    (numero ? formatearNumeroRegistro(numero) : "") +
    " del archivo.";
  return "https://wa.me/" + WHATSAPP_DRMR + "?text=" + encodeURIComponent(hola);
}

export function enlacePlanB(
  nombre: string,
  telefono: string,
  talla: string,
): { href: string; texto: string } {
  const txt =
    "Hola drmr, quiero entrar a drmrs archive y la web no me dejó.\nNombre: " +
    nombre +
    "\nWhatsApp: " +
    telefono +
    "\nTalla: " +
    talla;
  if (WHATSAPP_DRMR) {
    return {
      href:
        "https://wa.me/" + WHATSAPP_DRMR + "?text=" + encodeURIComponent(txt),
      texto: "Regístrame por WhatsApp →",
    };
  }
  return {
    href: "https://ig.me/m/drmrs.archive",
    texto: "Escríbenos por Instagram →",
  };
}

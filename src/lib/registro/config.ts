/* Endpoint propio: src/app/api/registro/route.ts */
export const REGISTRO_ENDPOINT = "/api/registro";

/* WhatsApp de drmr para el plan B (52 + 10 dígitos, sin espacios). Vacío = el plan B manda a DM de Instagram. */
export const WHATSAPP_DRMR = "524428690309";

/* Llave pública (site key) de Cloudflare Turnstile para el hostname del despliegue. Vacío = sin widget. */
export const TURNSTILE_SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/* tiempo máximo por intento */
export const ESPERA_MS = 20000;

const MOVIL = /Android|iPhone|iPad|iPod/i;

export function esDispositivoMovil(): boolean {
  const { userAgent, maxTouchPoints } = navigator;
  return MOVIL.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export function urlPerfilInstagram(usuario: string): string {
  return `https://www.instagram.com/${encodeURIComponent(usuario.replace(/^@/, ""))}/`;
}

export function usuarioDesdeEnlaceIgMe(enlace: string): string | null {
  const segmentos = new URL(enlace).pathname.split("/").filter(Boolean);
  return segmentos.at(-1) ?? null;
}

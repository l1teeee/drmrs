// de dónde viene la gente: ?src=tiktok / ?src=ig / ?src=wa
export function detectarOrigen(busqueda: string, referrer: string): string {
  const p = new URLSearchParams(busqueda);
  let ref = "directo";
  if (referrer) {
    try {
      ref = new URL(referrer).hostname || "directo";
    } catch {
      ref = "directo";
    }
  }
  return (p.get("src") || p.get("utm_source") || ref).slice(0, 40);
}

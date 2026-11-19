export function limpiarEntradaTelefono(valor: string): string {
  return valor.replace(/[^\d +]/g, "");
}

// acepta 4421234567, +52 442…, 52 1 442… → siempre 10 dígitos
export function normalizarTelefono(valor: string): string {
  let t = String(valor).replace(/\D/g, "");
  if (t.length === 13 && t.startsWith("521")) {
    t = t.slice(3);
  } else if (t.length === 12 && t.startsWith("52")) {
    t = t.slice(2);
  }
  return t;
}

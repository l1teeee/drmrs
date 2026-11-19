// Accepts "@usuario" or "usuario" and keeps only the username.
export function normalizarInstagram(valor: string): string {
  return valor.trim().replace(/^@+/, "");
}

export function formatearNumeroRegistro(numero: number): string {
  return String(numero).padStart(4, "0");
}

export function formatearTelefono(diezDigitos: string): string {
  return (
    diezDigitos.slice(0, 3) +
    " " +
    diezDigitos.slice(3, 6) +
    " " +
    diezDigitos.slice(6)
  );
}


export type CuentaRegresiva =
  | { abierto: true }
  | { abierto: false; dias: number; horas: string; minutos: string; segundos: string };

const SEGUNDO = 1000;
const MINUTO = 60 * SEGUNDO;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

function dosDigitos(valor: number): string {
  return String(valor).padStart(2, "0");
}

export function calcularCuentaRegresiva(ahora: Date, apertura: Date): CuentaRegresiva {
  const restante = apertura.getTime() - ahora.getTime();
  if (restante <= 0) return { abierto: true };

  return {
    abierto: false,
    dias: Math.floor(restante / DIA),
    horas: dosDigitos(Math.floor((restante % DIA) / HORA)),
    minutos: dosDigitos(Math.floor((restante % HORA) / MINUTO)),
    segundos: dosDigitos(Math.floor((restante % MINUTO) / SEGUNDO)),
  };
}

"use client";

import { useSyncExternalStore } from "react";
import { calcularCuentaRegresiva } from "@/lib/cuenta-regresiva";

function suscribirCadaSegundo(avisar: () => void): () => void {
  const reloj = window.setInterval(avisar, 1000);
  return () => window.clearInterval(reloj);
}

function segundoActual(): number {
  return Math.floor(Date.now() / 1000);
}

// The server cannot know the visitor's clock; the countdown fills in after hydration.
function sinSegundoEnServidor(): null {
  return null;
}

type CuentaRegresivaProps = {
  objetivoIso: string;
};

export function CuentaRegresiva({ objetivoIso }: CuentaRegresivaProps) {
  const segundo = useSyncExternalStore<number | null>(
    suscribirCadaSegundo,
    segundoActual,
    sinSegundoEnServidor,
  );

  if (segundo === null) {
    return <p className="tabular-nums">--d --h --m --s</p>;
  }

  const estado = calcularCuentaRegresiva(new Date(segundo * 1000), new Date(objetivoIso));
  if (estado.abierto) {
    return <p>El archivo ya está abierto</p>;
  }

  return (
    <p className="tabular-nums">
      {estado.dias}d {estado.horas}h {estado.minutos}m {estado.segundos}s
    </p>
  );
}

export type Lienzo = { ancho: number; alto: number };

export type CuadroBola = {
  etapa: number;
  escalaX: number;
  escalaY: number;
  giro: number;
  x: number;
  y: number;
};

export const CUADROS_POR_ETAPA = 2;
export const CUADROS_DESAPARECE = 8;

const ESCALA_FIN_ETAPAS = 0.6;
const GIRO_TOTAL = -14;
const TEMBLOR_GIRO = 2;
const TEMBLOR_POSICION = 4;

// Deterministic pseudo-noise in [-1, 1]: stop-motion jitter that is the same on every load.
function ruido(semilla: number): number {
  const valor = Math.sin(semilla * 12.9898) * 43758.5453;
  return (valor - Math.floor(valor)) * 2 - 1;
}

function interpolar(desde: number, hasta: number, avance: number): number {
  return desde + (hasta - desde) * avance;
}

export function totalCuadrosBola(etapas: number): number {
  return etapas * CUADROS_POR_ETAPA + CUADROS_DESAPARECE;
}

export function cuadroBola(cuadro: number, etapas: number, lienzo: Lienzo): CuadroBola {
  const cuadrosEtapas = etapas * CUADROS_POR_ETAPA;
  const etapa = Math.min(etapas - 1, Math.floor(cuadro / CUADROS_POR_ETAPA));
  const avanceEtapas = Math.min(1, cuadro / (cuadrosEtapas - 1));
  // Ease-out: the sheet loses most of its size and its screen shape early, then the ball compacts slowly.
  const forma = 1 - (1 - avanceEtapas) ** 2;
  const desaparece = Math.min(1, Math.max(0, cuadro - (cuadrosEtapas - 1)) / CUADROS_DESAPARECE);
  const escala = interpolar(1, ESCALA_FIN_ETAPAS, forma) * (1 - desaparece) ** 1.5;

  // The square photos are stretched to the screen; the stretch fades out so the ball ends round.
  const lado = Math.min(lienzo.ancho, lienzo.alto);
  const correccionX = interpolar(1, lado / lienzo.ancho, forma);
  const correccionY = interpolar(1, lado / lienzo.alto, forma);

  return {
    etapa,
    escalaX: escala * correccionX,
    escalaY: escala * correccionY,
    giro: (GIRO_TOTAL * cuadro) / cuadrosEtapas + TEMBLOR_GIRO * ruido(cuadro),
    x: TEMBLOR_POSICION * ruido(cuadro + 101),
    y: TEMBLOR_POSICION * ruido(cuadro + 211),
  };
}

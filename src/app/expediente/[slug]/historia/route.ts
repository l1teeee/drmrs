import { ImageResponse } from "next/og";

import { cargarFuenteMaquina, ExpedienteImagen } from "@/app/expediente/expediente-imagen";
import { getExpediente } from "@/application/registration/get-expediente";
import { formatDropDateStamp, formatDropNumber } from "@/domain/drop/drop";
import { formatRegistrationNumber } from "@/domain/registration/expediente-link";
import { PIECE_STATUS_LABELS, SIZE_LABELS } from "@/domain/registration/piece-status";
import { getRateLimitSubject, getRawClientIp } from "@/infrastructure/http/client-ip";
import { expedienteDependencies } from "@/infrastructure/registration/registration-runtime";

const ANCHO = 1080;
const ALTO = 1920;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const expediente = await getExpediente(
    slug,
    getRateLimitSubject(getRawClientIp(request.headers)),
    expedienteDependencies(),
  );

  if (!expediente) {
    return new Response("Not Found", { status: 404 });
  }

  const fuente = await cargarFuenteMaquina();
  const registro = formatRegistrationNumber(expediente.registrationNumber);
  const folio = formatDropNumber(expediente.drop.number);
  const apertura = formatDropDateStamp(expediente.drop.registeredOpensAt);

  return new ImageResponse(
    ExpedienteImagen({
      ancho: ANCHO,
      alto: ALTO,
      folio,
      registro,
      nombre: expediente.firstName.toLowerCase(),
      talla: SIZE_LABELS[expediente.size].toLowerCase(),
      estado: PIECE_STATUS_LABELS[expediente.pieceStatus],
      apertura,
    }),
    {
      width: ANCHO,
      height: ALTO,
      fonts: [
        {
          name: "Courier Prime",
          data: fuente,
          style: "normal",
          weight: 400,
        },
      ],
      headers: {
        "Content-Disposition": `attachment; filename="expediente-${folio}-${registro}.png"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}

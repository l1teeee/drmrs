import { headers } from "next/headers";
import { ImageResponse } from "next/og";
import { connection } from "next/server";

import { cargarFuenteMaquina, ExpedienteImagen } from "@/app/expediente/expediente-imagen";
import OpenGraphImage from "@/app/opengraph-image";
import { getExpediente } from "@/application/registration/get-expediente";
import { formatRegistrationNumber } from "@/domain/registration/expediente-link";
import { PIECE_STATUS_LABELS, SIZE_LABELS } from "@/domain/registration/piece-status";
import { getRateLimitSubject, getRawClientIp } from "@/infrastructure/http/client-ip";
import { expedienteDependencies } from "@/infrastructure/registration/registration-runtime";

export const alt = "Expediente del Archivo 001 de drmr";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ExpedienteOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  const expediente = await getExpediente(
    slug,
    getRateLimitSubject(getRawClientIp(await headers())),
    expedienteDependencies(),
  );

  if (!expediente) {
    return OpenGraphImage();
  }

  const fuente = await cargarFuenteMaquina();
  const registro = formatRegistrationNumber(expediente.registrationNumber);

  return new ImageResponse(
    (
      <ExpedienteImagen
        ancho={size.width}
        alto={size.height}
        registro={registro}
        nombre={expediente.firstName.toLowerCase()}
        talla={SIZE_LABELS[expediente.size].toLowerCase()}
        estado={PIECE_STATUS_LABELS[expediente.pieceStatus]}
      />
    ),
    {
      ...size,
      fonts: [
        {
          name: "Courier Prime",
          data: fuente,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}

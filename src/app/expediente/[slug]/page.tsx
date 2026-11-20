import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { AccionesExpediente } from "@/app/expediente/[slug]/AccionesExpediente";
import { getExpediente } from "@/application/registration/get-expediente";
import { Subrayado, TINTA_MAQUINA } from "@/components/Maquina";
import {
  formatRegistrationNumber,
  parseExpedienteSlug,
} from "@/domain/registration/expediente-link";
import { PIECE_STATUS_LABELS, SIZE_LABELS } from "@/domain/registration/piece-status";
import { PIECE_STATUSES } from "@/domain/registration/registration";
import { getRateLimitSubject, getRawClientIp } from "@/infrastructure/http/client-ip";
import { expedienteDependencies } from "@/infrastructure/registration/registration-runtime";

type ExpedientePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ExpedientePageProps): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseExpedienteSlug(slug);
  if (!parsed) {
    return {
      title: "Expediente",
      robots: { index: false, follow: false },
    };
  }

  const numero = formatRegistrationNumber(parsed.registrationNumber);
  return {
    title: `Expediente ${numero}`,
    description: `Registro ${numero} del Archivo 001 de drmr.`,
    robots: { index: false, follow: false },
  };
}

async function ContenidoExpediente({ params }: ExpedientePageProps) {
  await connection();
  const { slug } = await params;
  const expediente = await getExpediente(
    slug,
    getRateLimitSubject(getRawClientIp(await headers())),
    expedienteDependencies(),
  );

  if (!expediente) {
    notFound();
  }

  const numero = formatRegistrationNumber(expediente.registrationNumber);
  const indiceActual = PIECE_STATUSES.indexOf(expediente.pieceStatus);

  return (
    <>
      <div
        className={`absolute left-[clamp(20px,8vw,120px)] right-[clamp(20px,8vw,120px)] top-[clamp(28px,10vh,96px)] rotate-[-0.4deg] ${TINTA_MAQUINA}`}
      >
        <p>drmrs archive — exp. 001</p>
        <p>registro: {numero}</p>
        <p>nombre: {expediente.firstName.toLowerCase()}</p>
        <p>talla: {SIZE_LABELS[expediente.size].toLowerCase()}</p>
        <p>
          pieza:{" "}
          {PIECE_STATUSES.map((estado, indice) => {
            const etiqueta = PIECE_STATUS_LABELS[estado];
            return (
              <span key={estado}>
                {indice > 0 && " · "}
                {indice === indiceActual ? (
                  <Subrayado>{etiqueta}</Subrayado>
                ) : indice > indiceActual ? (
                  <span className="opacity-40">{etiqueta}</span>
                ) : (
                  etiqueta
                )}
              </span>
            );
          })}
        </p>
        <p>apertura: 04.12.26, 19:00 h</p>

        <AccionesExpediente slug={slug} registrationNumber={numero} />

        {expediente.photoIds.length > 0 && (
          <>
            <p className="mt-6">fotos de tu pieza:</p>
            <div className="mt-2 grid w-[min(100%,360px)] grid-cols-3 gap-2">
              {expediente.photoIds.map((id, indice) => {
                const src = `/expediente/${slug}/fotos/${id}`;
                return (
                  <a
                    key={id}
                    href={src}
                    target="_blank"
                    rel="noopener"
                    className="relative block aspect-square overflow-hidden bg-white/40"
                  >
                    <Image
                      src={src}
                      alt={`Foto ${indice + 1} de tu pieza`}
                      fill
                      unoptimized
                      sizes="120px"
                      className="object-cover"
                    />
                  </a>
                );
              })}
            </div>
          </>
        )}
      </div>

      <p
        className={`absolute bottom-[clamp(24px,7vh,72px)] right-[clamp(20px,6vw,96px)] pointer-events-none rotate-[0.3deg] opacity-75 ${TINTA_MAQUINA}`}
      >
        folio {numero}
      </p>
    </>
  );
}

export default function ExpedientePage({ params }: ExpedientePageProps) {
  return (
    <main className="relative h-dvh overflow-x-hidden overflow-y-auto bg-papel font-mono text-[13px] leading-[1.7] text-tinta md:text-[15px]">
      <Image src="/textura-papel.jpg" alt="" fill className="object-cover" />

      <Suspense fallback={null}>
        <ContenidoExpediente params={params} />
      </Suspense>

      <Link
        href="/"
        aria-label="drmr, volver al inicio"
        className="absolute right-[clamp(20px,8vw,120px)] top-[clamp(28px,10vh,96px)]"
      >
        <Image src="/drmr-logo.svg" alt="drmr" width={177} height={72} className="h-[22px] w-auto" />
      </Link>
    </main>
  );
}

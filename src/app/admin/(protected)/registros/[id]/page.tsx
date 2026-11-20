import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import {
  getConversation,
  listUnlinkedContacts,
  renderActivationTexts,
  renderTemplateTexts,
} from "@/application/messaging/admin-messages";
import { TransicionPagina } from "@/components/TransicionPagina";
import { TINTA_MAQUINA } from "@/components/Maquina";
import { listPiecePhotoIds } from "@/application/registration/piece-photos";
import { TEMPLATE_LABELS, type TemplateKey } from "@/domain/messaging/message-template";
import { formatRegistrationNumber } from "@/domain/registration/expediente-link";
import { photosEnabledFor } from "@/domain/registration/piece-photo";
import { PIECE_STATUS_LABELS, SIZE_LABELS } from "@/domain/registration/piece-status";
import { adminHref } from "@/infrastructure/admin/admin-path";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { postgresPiecePhotoRepository } from "@/infrastructure/db/repositories/postgres-piece-photo-repository";
import { adminMessagesDependencies } from "@/infrastructure/messaging/admin-messages-runtime";

import { ENLACE, ETIQUETA, FILA, REGLA, TITULO } from "../../../ui";
import { ActivarPorInstagram } from "../../ActivarPorInstagram";
import { BorrarChat } from "../../BorrarChat";
import { estadoInstagram } from "../../estado-instagram";
import { PistaPieza } from "../PistaPieza";
import { EnviarMensaje } from "./EnviarMensaje";
import { FotosPieza } from "./FotosPieza";
import { HiloMensajes } from "./HiloMensajes";
import { MensajeChat } from "./MensajeChat";
import { VincularContacto } from "./VincularContacto";

function linkLabel(linkedBy: string | null, linkCode: string | null): string {
  if (linkedBy === "CODE") return "por código";
  if (linkedBy === "USERNAME") return "por usuario de instagram";
  if (linkedBy === "MANUAL") return "a mano";
  return `sin vincular · código ${linkCode ?? "—"}`;
}

export default async function ConversacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  await requireAdmin("page");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const deps = adminMessagesDependencies();
  const conversation = await getConversation(id, deps);
  const piece = await deps.registros.store.findById(id);
  if (!conversation || !piece) notFound();

  const { registration, messages } = conversation;
  const fotoIds = await listPiecePhotoIds(registration.id, {
    photos: postgresPiecePhotoRepository,
  });
  const unlinked = registration.linkedBy === null ? await listUnlinkedContacts(deps) : [];
  const handle = registration.instagramHandle.replace(/^@/, "");
  const estado = estadoInstagram(registration.lastInboundAt, new Date());
  let activationText: string | null = null;
  if (!estado.activo) {
    const renderedText = (await renderActivationTexts([piece], deps)).get(piece.id);
    if (renderedText === undefined) throw new Error("Activation text missing");
    activationText = renderedText;
  }
  const yaTieneBienvenida = messages.some(
    (message) => message.templateKey === "BIENVENIDA" && message.status !== "FAILED",
  );
  const enCola = messages.filter(
    (message) =>
      message.direction === "OUT" &&
      (message.status === "WAITING_CONTACT" || message.status === "WAITING_WINDOW"),
  ).length;
  const clavesPlantilla: TemplateKey[] = yaTieneBienvenida
    ? ["RECORDATORIO_DROP"]
    : ["BIENVENIDA", "RECORDATORIO_DROP"];
  const textos = await renderTemplateTexts(piece, clavesPlantilla, deps);
  const plantillas = clavesPlantilla.map((key) => {
    const texto = textos.get(key);
    if (texto === undefined) throw new Error("Template text missing");
    return { key, label: TEMPLATE_LABELS[key], texto };
  });

  return (
    <TransicionPagina>
      <main className="grid gap-10 md:min-h-0 md:flex-1 md:grid-cols-[minmax(220px,300px)_minmax(0,1fr)] md:gap-14">
        <div className="flex flex-col gap-5 md:min-h-0 md:overflow-y-auto">
          <Link
            href={adminHref("/registros")}
            className={`self-start text-[14px] ${ENLACE}`}
          >
            ← Registros
          </Link>

          <div className="relative overflow-hidden bg-papel">
            <Image
              src="/textura-papel.jpg"
              alt=""
              fill
              sizes="(min-width: 768px) 300px, 100vw"
              className="object-cover"
            />
            <div
              className={`relative break-words p-6 font-mono text-[13px] leading-[1.7] text-tinta rotate-[-0.4deg] md:p-8 md:text-[14px] ${TINTA_MAQUINA}`}
            >
              <p>expediente {formatRegistrationNumber(registration.registrationNumber)}</p>
              <p>nombre: {registration.fullName.toLowerCase()}</p>
              <p>instagram: @{handle}</p>
              <p>talla: {SIZE_LABELS[piece.size].toLowerCase()}</p>
              <p>pieza: {PIECE_STATUS_LABELS[piece.pieceStatus]}</p>
              <p>vínculo: {linkLabel(registration.linkedBy, registration.linkCode)}</p>
              <p>instagram: {estado.etiqueta.toLowerCase()}</p>
            </div>
          </div>

          <FotosPieza
            registrationId={registration.id}
            fotoIds={fotoIds}
            habilitado={photosEnabledFor(piece.pieceStatus)}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6 md:min-h-0">
          <div className="grid shrink-0 gap-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <div className="grid gap-1">
                <h1 tabIndex={-1} className={`${TITULO} outline-none break-all`}>
                  @{handle}
                </h1>
                <p className={ETIQUETA}>
                  {registration.fullName} · {estado.etiqueta}
                </p>
              </div>
              {messages.length > 0 && <BorrarChat objetivo={{ tipo: "registro", id: registration.id }} />}
            </div>

            <PistaPieza
              registrationId={registration.id}
              current={piece.pieceStatus}
              activo={estado.activo}
            />
          </div>

          {messages.length === 0 ? (
            <p className={`${ETIQUETA} md:flex-1`}>sin mensajes todavía.</p>
          ) : (
            <HiloMensajes
              count={messages.length}
              className={`max-h-[60dvh] overflow-y-auto overscroll-contain border-t ${FILA} focus-visible:outline focus-visible:outline-1 focus-visible:outline-azul md:max-h-none md:min-h-0 md:flex-1`}
            >
              <ul className="grid">
                {messages.map((message) => (
                  <MensajeChat key={message.id} message={message} />
                ))}
              </ul>
            </HiloMensajes>
          )}

          <div className={`grid shrink-0 gap-8 border-t ${REGLA} pt-6 md:max-h-[45dvh] md:overflow-y-auto`}>
            {enCola > 0 && (
              <p role="status" className="border-l-2 border-azul pl-3 text-[14px] text-azul">
                {enCola === 1
                  ? "1 mensaje en cola: se enviará cuando conteste."
                  : `${enCola} mensajes en cola: se enviarán cuando conteste.`}
              </p>
            )}
            {activationText !== null && (
              <div className="grid gap-3">
                <p className={ETIQUETA}>
                  Inactivo. Envíale la activación; cuando responda, drmr manda solo lo pendiente.
                </p>
                <ActivarPorInstagram
                  registrationId={registration.id}
                  fullName={registration.fullName}
                  username={registration.instagramHandle}
                  text={activationText}
                  activationSentAt={registration.activationSentAt?.toISOString() ?? null}
                />
              </div>
            )}
            <EnviarMensaje
              registrationId={registration.id}
              activo={estado.activo}
              plantillas={plantillas}
            />

            {registration.linkedBy === null && unlinked.length > 0 && (
              <VincularContacto
                registrationId={registration.id}
                contacts={unlinked.map((contact) => ({
                  id: contact.id,
                  username: contact.username,
                  displayName: contact.displayName,
                  lastInboundAt: contact.lastInboundAt.toISOString(),
                }))}
              />
            )}
          </div>
        </div>
      </main>
    </TransicionPagina>
  );
}

import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import {
  getConversation,
  listLinkableContacts,
  renderActivationTexts,
  renderTemplateTexts,
} from "@/application/messaging/admin-messages";
import { TransicionPagina } from "@/components/TransicionPagina";
import { TINTA_MAQUINA } from "@/components/Maquina";
import { listPiecePhotoIds } from "@/application/registration/piece-photos";
import { TEMPLATE_KEYS, TEMPLATE_LABELS, type TemplateKey } from "@/domain/messaging/message-template";
import { formatRegistrationTag } from "@/domain/drop/drop";
import { formatWhatsappDisplay, whatsappChatUrl } from "@/domain/registration/phone";
import { photosEnabledFor } from "@/domain/registration/piece-photo";
import { PIECE_STATUS_LABELS, SIZE_LABELS } from "@/domain/registration/piece-status";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { postgresPiecePhotoRepository } from "@/infrastructure/db/repositories/postgres-piece-photo-repository";
import { adminMessagesDependencies } from "@/infrastructure/messaging/admin-messages-runtime";

import { ENLACE, ETIQUETA, FILA, REGLA } from "../../../ui";
import { ActivarPorInstagram } from "../../ActivarPorInstagram";
import { BorrarChat } from "../../BorrarChat";
import { estadoInstagram } from "../../estado-instagram";
import { PistaPieza } from "../PistaPieza";
import { DisposicionConversacion } from "./DisposicionConversacion";
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
  const unlinked = registration.linkedBy === null ? await listLinkableContacts(registration.id, deps) : [];
  const handle = registration.instagramHandle.replace(/^@/, "");
  const estado = estadoInstagram(registration.lastInboundAt, new Date());
  let activationText: string | null = null;
  if (!estado.activo) {
    const renderedText = (await renderActivationTexts([piece], deps)).get(piece.id);
    if (renderedText === undefined) throw new Error("Activation text missing");
    activationText = renderedText;
  }
  const yaTieneBienvenida = messages.some(
    (message) => message.registrationId === registration.id && message.templateKey === "BIENVENIDA" && message.status !== "FAILED",
  );
  const enCola = messages.filter(
    (message) =>
      message.direction === "OUT" &&
      message.registrationId === registration.id &&
      (message.status === "WAITING_CONTACT" || message.status === "WAITING_WINDOW"),
  ).length;
  const clavesPlantilla: TemplateKey[] = yaTieneBienvenida
    ? ["RECORDATORIO_DROP"]
    : ["BIENVENIDA", "RECORDATORIO_DROP"];
  const textos = await renderTemplateTexts(piece, [...TEMPLATE_KEYS], deps);
  const plantillas = clavesPlantilla.map((key) => {
    const texto = textos.get(key);
    if (texto === undefined) throw new Error("Template text missing");
    return { key, label: TEMPLATE_LABELS[key], texto };
  });
  const todasPlantillas = TEMPLATE_KEYS.map((key) => {
    const texto = textos.get(key);
    if (texto === undefined) throw new Error("Template text missing");
    return { key, label: TEMPLATE_LABELS[key], texto };
  });

  const mostrarFotos = photosEnabledFor(piece.pieceStatus) || fotoIds.length > 0;

  return (
    <TransicionPagina>
      <DisposicionConversacion
        ficha={
          <>
            <div className="relative overflow-hidden bg-papel">
              <Image
                src="/textura-papel.jpg"
                alt=""
                fill
                sizes="250px"
                className="object-cover"
              />
              <div
                className={`relative break-words p-4 font-mono text-[12px] leading-[1.6] text-tinta rotate-[-0.4deg] md:p-5 md:text-[12px] ${TINTA_MAQUINA}`}
              >
                <p>expediente {formatRegistrationTag(registration.dropNumber, registration.registrationNumber)}</p>
                <p>archivo: {registration.dropName.toLowerCase()}</p>
                <p>nombre: {registration.fullName.toLowerCase()}</p>
                <p>instagram: @{handle}</p>
                <p>whatsapp: {formatWhatsappDisplay(piece.whatsappDigits)}</p>
                <p>talla: {SIZE_LABELS[piece.size].toLowerCase()}</p>
                <p>pieza: {PIECE_STATUS_LABELS[piece.pieceStatus]}</p>
                <p>vínculo: {linkLabel(registration.linkedBy, registration.linkCode)}</p>
                <p>instagram: {estado.etiqueta.toLowerCase()}</p>
              </div>
            </div>

            {mostrarFotos && (
              <FotosPieza
                registrationId={registration.id}
                fotoIds={fotoIds}
                habilitado={photosEnabledFor(piece.pieceStatus)}
              />
            )}
          </>
        }
        encabezado={
          <div className="grid shrink-0 gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <div className="grid gap-1">
                <h1
                  tabIndex={-1}
                  className="text-[18px] md:text-[20px] font-medium leading-tight tracking-[-0.02em] outline-none break-all"
                >
                  @{handle}
                </h1>
                <p className={`${ETIQUETA} [overflow-wrap:anywhere]`}>
                  {registration.fullName} · {estado.etiqueta}
                  {" · "}<a href={whatsappChatUrl(piece.whatsappDigits)} target="_blank" rel="noopener noreferrer" className={`${ENLACE} text-[13px]`}>WhatsApp</a>
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
        }
      >
          {messages.length === 0 ? (
            <p className={`${ETIQUETA} md:flex-1`}>sin mensajes todavía.</p>
          ) : (
            <HiloMensajes
              count={messages.length}
              className={`max-h-[60dvh] overflow-y-auto overscroll-contain border-t ${FILA} focus-visible:outline focus-visible:outline-1 focus-visible:outline-azul md:max-h-none md:min-h-0 md:flex-1`}
            >
              <ul className="grid">
                {messages.map((message) => (
                  <MensajeChat key={message.id} message={message} currentDropNumber={registration.dropNumber} />
                ))}
              </ul>
            </HiloMensajes>
          )}

          <div className={`grid shrink-0 gap-3 border-t ${REGLA} pt-3 md:max-h-[40dvh] md:overflow-y-auto`}>
            {enCola > 0 && (
              <p role="status" className="border-l-2 border-azul pl-3 text-[13px] text-azul">
                {enCola === 1
                  ? "1 mensaje en cola: se enviará cuando conteste."
                  : `${enCola} mensajes en cola: se enviarán cuando conteste.`}
              </p>
            )}
            {activationText !== null && (
              <div className="grid gap-2">
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
              todasPlantillas={todasPlantillas}
            />

            {registration.linkedBy === null && unlinked.length > 0 && (
              <VincularContacto
                registrationId={registration.id}
                contacts={unlinked.map((contact) => ({
                  id: contact.id,
                  username: contact.username,
                  displayName: contact.displayName,
                  lastInboundAt: contact.lastInboundAt.toISOString(),
                  linkedTags: contact.linkedTags,
                }))}
              />
            )}
          </div>
      </DisposicionConversacion>
    </TransicionPagina>
  );
}

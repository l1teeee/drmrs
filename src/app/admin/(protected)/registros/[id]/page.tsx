import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import {
  type ConversationMessage,
  getConversation,
  listUnlinkedContacts,
} from "@/application/messaging/admin-messages";
import { TINTA_MAQUINA } from "@/components/Maquina";
import { formatRegistrationNumber } from "@/domain/registration/expediente-link";
import { PIECE_STATUS_LABELS, SIZE_LABELS } from "@/domain/registration/piece-status";
import { adminHref } from "@/infrastructure/admin/admin-path";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { adminMessagesDependencies } from "@/infrastructure/messaging/admin-messages-runtime";

import { ENLACE, ETIQUETA, FILA, REGLA, TITULO } from "../../../ui";
import { PistaPieza } from "../PistaPieza";
import { EnviarMensaje } from "./EnviarMensaje";
import { MensajePendiente } from "./MensajePendiente";
import { VincularContacto } from "./VincularContacto";

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

const OUT_STATUS_LABELS: Partial<Record<ConversationMessage["status"], string>> = {
  SENT: "enviado",
  SENT_MANUALLY: "enviado a mano",
  QUEUED: "en cola",
  WAITING_CONTACT: "esperando que nos escriba",
  WAITING_WINDOW: "fuera de ventana",
  FAILED: "falló",
};

function linkLabel(linkedBy: string | null, linkCode: string | null): string {
  if (linkedBy === "CODE") return "por código";
  if (linkedBy === "USERNAME") return "por usuario de instagram";
  if (linkedBy === "MANUAL") return "a mano";
  return `sin vincular · código ${linkCode ?? "—"}`;
}

function isPendingManualSend(message: ConversationMessage): boolean {
  return (
    message.direction === "OUT" &&
    message.source === "ADMIN" &&
    (message.status === "WAITING_CONTACT" ||
      message.status === "WAITING_WINDOW" ||
      message.status === "FAILED")
  );
}

function messageLabel(message: ConversationMessage): string {
  const date = dateFormatter.format(message.createdAt);
  if (message.direction === "IN") return `${date} · ellos`;
  if (message.source === "INSTAGRAM_APP") return `${date} · drmr desde la app`;
  const status = OUT_STATUS_LABELS[message.status];
  const parts = [date, "drmr"];
  if (status) parts.push(status);
  if (message.readAt) parts.push("visto");
  return parts.join(" · ");
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
  const unlinked = registration.linkedBy === null ? await listUnlinkedContacts(deps) : [];
  const handle = registration.instagramHandle.replace(/^@/, "");

  return (
    <main className="grid gap-10 md:grid-cols-[minmax(220px,300px)_minmax(0,1fr)] md:gap-14">
      <div className="flex flex-col gap-5">
        <Link
          href={adminHref("/registros")}
          className={`self-start text-[14px] ${ENLACE}`}
        >
          ← Registros
        </Link>

        <div className="relative flex-1 overflow-hidden bg-papel">
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
            <p>
              ventana:{" "}
              {registration.windowOpen ? "abierta" : "cerrada, espera a que escriba"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid content-start gap-8">
        <h1 tabIndex={-1} className={`${TITULO} outline-none`}>
          Conversación
        </h1>

        <PistaPieza registrationId={registration.id} current={piece.pieceStatus} />

        {messages.length === 0 ? (
          <p className={ETIQUETA}>sin mensajes todavía.</p>
        ) : (
          <ul className={`border-t ${FILA}`}>
            {messages.map((message) => (
              <li
                key={message.id}
                className={`grid gap-1 border-b ${FILA} py-4 ${
                  message.direction === "IN" ? "pl-0" : "pl-6 md:pl-12"
                }`}
              >
                <p className={ETIQUETA}>{messageLabel(message)}</p>
                <p className="whitespace-pre-wrap text-[16px]">{message.body}</p>
                {isPendingManualSend(message) && (
                  <MensajePendiente
                    messageId={message.id}
                    username={registration.instagramHandle}
                    text={message.body}
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        <div className={`grid gap-8 border-t ${REGLA} pt-6`}>
          <EnviarMensaje registrationId={registration.id} />

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
  );
}

import Image from "next/image";

import type { ConversationMessage } from "@/application/messaging/admin-messages";

import { ETIQUETA } from "../../../ui";

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

const BASE_BURBUJA =
  "whitespace-pre-wrap px-3 py-2 text-[14px] leading-[1.5] [overflow-wrap:anywhere]";

const OUT_STATUS_LABELS: Partial<Record<ConversationMessage["status"], string>> = {
  SENT: "enviado",
  SENT_MANUALLY: "enviado a mano",
  QUEUED: "en cola",
  WAITING_CONTACT: "espera a que escriba",
  WAITING_WINDOW: "en cola · fuera de la ventana",
  FAILED: "no se pudo enviar",
};

function bubbleClass(message: ConversationMessage): string {
  if (message.direction === "IN") return `${BASE_BURBUJA} bg-papel text-tinta`;
  if (
    message.status === "QUEUED" ||
    message.status === "WAITING_CONTACT" ||
    message.status === "WAITING_WINDOW"
  ) {
    return `${BASE_BURBUJA} border border-azul text-azul`;
  }
  if (message.status === "FAILED") return `${BASE_BURBUJA} border border-tinta/30 text-tinta/70`;
  return `${BASE_BURBUJA} bg-azul text-white`;
}

function metaLabel(message: ConversationMessage): string {
  const parts = [dateFormatter.format(message.sentAt ?? message.receivedAt ?? message.createdAt)];
  if (message.direction === "OUT") {
    if (message.source === "INSTAGRAM_APP") {
      parts.push("desde la app");
    } else {
      const status = OUT_STATUS_LABELS[message.status];
      if (status) parts.push(status);
    }
    if (message.readAt) parts.push("visto");
  }
  return parts.join(" · ");
}

export function MensajeChat({ message }: { message: ConversationMessage }) {
  const isLeft = message.direction === "IN";

  return (
    <li className={`flex items-end gap-3 py-1.5 ${isLeft ? "" : "flex-row-reverse"}`}>
      {isLeft ? (
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full bg-papel text-tinta/50"
          aria-hidden="true"
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </span>
      ) : (
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full bg-azul"
          aria-hidden="true"
        >
          <Image src="/drmr-isotipo.svg" alt="" width={16} height={15} />
        </span>
      )}
      <div className={`grid max-w-[78%] gap-1 ${isLeft ? "" : "justify-items-end"}`}>
        <p className={bubbleClass(message)}>{message.body}</p>
        <span className={ETIQUETA}>{metaLabel(message)}</span>
      </div>
    </li>
  );
}

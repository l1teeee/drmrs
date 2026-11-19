import type { AdminRegistrosDependencies } from "@/application/admin-registros/admin-registros";
import { buildTemplateValues } from "@/application/admin-registros/template-values";
import type { RateLimitCheck } from "@/application/ports/rate-limit";
import { renderMessageTemplate, type TemplateKey } from "@/domain/messaging/message-template";
import { expedientePath } from "@/domain/registration/expediente-link";

export type QueuedMessageStatus = "QUEUED" | "WAITING_CONTACT" | "WAITING_WINDOW";
export type MessageStatus = QueuedMessageStatus | "SENT" | "FAILED" | "SENT_MANUALLY" | "RECEIVED";
export type AdminMessageMutationKind = "done" | "not_found" | "invalid_state" | "conflict";
export type EnqueueMessageResult =
  | { kind: "queued"; status: QueuedMessageStatus }
  | { kind: "not_found" };

export interface ConversationMessage {
  id: string;
  direction: "IN" | "OUT";
  source: "ADMIN" | "INSTAGRAM_APP" | "CONTACT";
  status: MessageStatus;
  body: string;
  createdAt: Date;
  sentAt: Date | null;
  readAt: Date | null;
  lastError: string | null;
}

export interface Conversation {
  registration: {
    id: string;
    registrationNumber: number;
    fullName: string;
    instagramHandle: string;
    linkedBy: string | null;
    contactUsername: string | null;
    windowOpen: boolean;
    linkCode: string | null;
  };
  messages: ConversationMessage[];
}

export interface UnsentMessage {
  id: string;
  registrationId: string;
  registrationNumber: number;
  fullName: string;
  instagramHandle: string;
  status: QueuedMessageStatus | "FAILED";
  body: string;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
}

export interface UnlinkedContact {
  id: string;
  username: string | null;
  displayName: string | null;
  lastInboundAt: Date;
  lastInboundText: string | null;
}

export interface AdminMessageStore {
  enqueue(
    adminId: string,
    registrationId: string,
    text: string,
    templateKey: TemplateKey | null,
  ): Promise<EnqueueMessageResult>;
  markSentManually(adminId: string, messageId: string): Promise<AdminMessageMutationKind>;
  discardMessage(adminId: string, messageId: string): Promise<AdminMessageMutationKind>;
  linkContactManually(adminId: string, registrationId: string, contactId: string): Promise<AdminMessageMutationKind>;
  getConversation(registrationId: string): Promise<Conversation | null>;
  listUnsentMessages(): Promise<UnsentMessage[]>;
  listUnlinkedContacts(): Promise<UnlinkedContact[]>;
}

export interface AdminMessagesDependencies {
  store: AdminMessageStore;
  registros: AdminRegistrosDependencies;
  checkAdminAction: RateLimitCheck;
  scheduleDelivery: () => void;
}

export async function queueInstagramMessage(
  adminId: string,
  input: { registrationId: string; templateKey?: TemplateKey; body?: string },
  deps: AdminMessagesDependencies,
): Promise<EnqueueMessageResult | { kind: "invalid" | "rate_limited" }> {
  const limit = await deps.checkAdminAction(adminId);
  if (!limit.allowed) return { kind: "rate_limited" };
  if ((input.templateKey !== undefined) === (input.body !== undefined)) return { kind: "invalid" };

  let text: string;
  if (input.templateKey !== undefined) {
    const registration = await deps.registros.store.findById(input.registrationId);
    if (!registration) return { kind: "not_found" };
    const templates = await deps.registros.store.listTemplates();
    const template = templates.find((entry) => entry.key === input.templateKey);
    if (!template) throw new Error("Message template not found");
    const expedienteUrl = deps.registros.baseUrl + expedientePath(
      registration.registrationNumber,
      deps.registros.codes.codeFor(registration.id, registration.linkVersion),
    );
    text = renderMessageTemplate(template.body, buildTemplateValues(registration, expedienteUrl));
  } else {
    text = input.body!.trim();
    if (text.length < 1 || text.length > 1000 || /\p{Cc}/u.test(input.body!.replaceAll("\n", ""))) {
      return { kind: "invalid" };
    }
  }
  const result = await deps.store.enqueue(adminId, input.registrationId, text, input.templateKey ?? null);
  if (result.kind === "queued" && result.status === "QUEUED") deps.scheduleDelivery();
  return result;
}

export async function markSentManually(
  adminId: string,
  messageId: string,
  deps: AdminMessagesDependencies,
): Promise<{ kind: AdminMessageMutationKind | "rate_limited" }> {
  const limit = await deps.checkAdminAction(adminId);
  if (!limit.allowed) return { kind: "rate_limited" };
  return { kind: await deps.store.markSentManually(adminId, messageId) };
}

export async function discardMessage(
  adminId: string,
  messageId: string,
  deps: AdminMessagesDependencies,
): Promise<{ kind: AdminMessageMutationKind | "rate_limited" }> {
  const limit = await deps.checkAdminAction(adminId);
  if (!limit.allowed) return { kind: "rate_limited" };
  return { kind: await deps.store.discardMessage(adminId, messageId) };
}

export async function linkContactManually(
  adminId: string,
  registrationId: string,
  contactId: string,
  deps: AdminMessagesDependencies,
): Promise<{ kind: AdminMessageMutationKind | "rate_limited" }> {
  const limit = await deps.checkAdminAction(adminId);
  if (!limit.allowed) return { kind: "rate_limited" };
  const kind = await deps.store.linkContactManually(adminId, registrationId, contactId);
  if (kind === "done") deps.scheduleDelivery();
  return { kind };
}

export function getConversation(registrationId: string, deps: AdminMessagesDependencies) {
  return deps.store.getConversation(registrationId);
}

export function listUnsentMessages(deps: AdminMessagesDependencies) {
  return deps.store.listUnsentMessages();
}

export function listUnlinkedContacts(deps: AdminMessagesDependencies) {
  return deps.store.listUnlinkedContacts();
}

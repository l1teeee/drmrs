import type { AdminRegistroRow } from "@/application/admin-registros/admin-registro-store";
import {
  expedienteUrl,
  type AdminRegistrosDependencies,
} from "@/application/admin-registros/admin-registros";
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
    lastInboundAt: Date | null;
    activationSentAt: Date | null;
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
  lastInboundAt: Date | null;
  activationSentAt: Date | null;
}

export interface RegistrationWindowState {
  registrationId: string;
  lastInboundAt: Date | null;
  activationSentAt: Date | null;
}

export interface UnlinkedContact {
  id: string;
  username: string | null;
  displayName: string | null;
  lastInboundAt: Date;
  lastInboundText: string | null;
}

export interface ConversationSummary {
  registrationId: string | null;
  contactId: string | null;
  registrationNumber: number | null;
  fullName: string | null;
  instagramHandle: string | null;
  contactUsername: string | null;
  contactDisplayName: string | null;
  lastDirection: "IN" | "OUT";
  lastBody: string;
  lastAt: Date;
  total: number;
}

export interface AdminMessageStore {
  enqueue(
    adminId: string | null,
    registrationId: string,
    text: string,
    templateKey: TemplateKey | null,
  ): Promise<EnqueueMessageResult>;
  listWindowStates(registrationIds: string[]): Promise<RegistrationWindowState[]>;
  recordActivationSent(adminId: string, registrationId: string): Promise<"done" | "not_found">;
  discardMessage(adminId: string, messageId: string): Promise<AdminMessageMutationKind>;
  linkContactManually(adminId: string, registrationId: string, contactId: string): Promise<AdminMessageMutationKind>;
  deleteRegistrationChat(
    adminId: string,
    registrationId: string,
  ): Promise<{ kind: "done"; deleted: number } | { kind: "not_found" }>;
  deleteUnlinkedContact(adminId: string, contactId: string): Promise<"done" | "not_found" | "conflict">;
  getConversation(registrationId: string): Promise<Conversation | null>;
  listUnsentMessages(): Promise<UnsentMessage[]>;
  listUnlinkedContacts(): Promise<UnlinkedContact[]>;
  listConversations(): Promise<ConversationSummary[]>;
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

export async function recordActivationSent(
  adminId: string,
  registrationId: string,
  deps: AdminMessagesDependencies,
): Promise<{ kind: "done" | "not_found" | "rate_limited" }> {
  const limit = await deps.checkAdminAction(adminId);
  if (!limit.allowed) return { kind: "rate_limited" };
  return { kind: await deps.store.recordActivationSent(adminId, registrationId) };
}

export async function listWindowStates(
  registrationIds: string[],
  deps: AdminMessagesDependencies,
): Promise<Map<string, RegistrationWindowState>> {
  const states = await deps.store.listWindowStates(registrationIds);
  return new Map(states.map((state) => [state.registrationId, state]));
}

export async function renderActivationTexts(
  rows: AdminRegistroRow[],
  deps: AdminMessagesDependencies,
): Promise<Map<string, string>> {
  const templates = await deps.registros.store.listTemplates();
  const template = templates.find((entry) => entry.key === "ACTIVACION");
  if (!template) throw new Error("Message template not found");
  return new Map(
    rows.map((row) => [
      row.id,
      renderMessageTemplate(template.body, buildTemplateValues(row, expedienteUrl(row, deps.registros))),
    ]),
  );
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

export async function deleteRegistrationChat(
  adminId: string,
  registrationId: string,
  deps: AdminMessagesDependencies,
): Promise<{ kind: "done" | "not_found" | "rate_limited" }> {
  const limit = await deps.checkAdminAction(adminId);
  if (!limit.allowed) return { kind: "rate_limited" };
  const result = await deps.store.deleteRegistrationChat(adminId, registrationId);
  return { kind: result.kind };
}

export async function deleteUnlinkedContact(
  adminId: string,
  contactId: string,
  deps: AdminMessagesDependencies,
): Promise<{ kind: "done" | "not_found" | "conflict" | "rate_limited" }> {
  const limit = await deps.checkAdminAction(adminId);
  if (!limit.allowed) return { kind: "rate_limited" };
  return { kind: await deps.store.deleteUnlinkedContact(adminId, contactId) };
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

export function listConversations(deps: AdminMessagesDependencies) {
  return deps.store.listConversations();
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  discardMessage,
  linkContactManually,
  queueInstagramMessage,
  recordActivationSent,
} from "@/application/messaging/admin-messages";
import { TEMPLATE_KEYS } from "@/domain/messaging/message-template";
import { requireAdmin } from "@/infrastructure/auth/require-admin";
import { adminMessagesDependencies } from "@/infrastructure/messaging/admin-messages-runtime";

const queueMessageSchema = z.object({
  registrationId: z.uuid(),
  templateKey: z.enum(TEMPLATE_KEYS).exclude(["ACTIVACION"]).optional(),
  body: z.string()
    .refine((value) => !/\p{Cc}/u.test(value.replaceAll("\n", "")))
    .trim().min(1).max(1000).optional(),
}).refine((value) => (value.templateKey !== undefined) !== (value.body !== undefined));

const messageIdSchema = z.object({ messageId: z.uuid() });
const activationSchema = z.object({ registrationId: z.uuid() });
const linkContactSchema = z.object({ registrationId: z.uuid(), contactId: z.uuid() });

export async function queueInstagramMessageAction(input: unknown) {
  const authorization = await requireAdmin("action");
  if (!authorization.ok) return { ok: false, error: "unauthorized" } as const;
  const parsed = queueMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" } as const;
  const result = await queueInstagramMessage(
    authorization.admin.adminId, parsed.data, adminMessagesDependencies(),
  );
  if (result.kind !== "queued") return { ok: false, error: result.kind } as const;
  revalidatePath("/admin/mensajes");
  revalidatePath("/admin/registros");
  return { ok: true, status: result.status } as const;
}

export async function recordActivationSentAction(input: unknown) {
  const authorization = await requireAdmin("action");
  if (!authorization.ok) return { ok: false, error: "unauthorized" } as const;
  const parsed = activationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" } as const;
  const result = await recordActivationSent(
    authorization.admin.adminId, parsed.data.registrationId, adminMessagesDependencies(),
  );
  if (result.kind !== "done") return { ok: false, error: result.kind } as const;
  revalidatePath("/admin/mensajes");
  revalidatePath("/admin/registros");
  return { ok: true } as const;
}

export async function discardMessageAction(input: unknown) {
  const authorization = await requireAdmin("action");
  if (!authorization.ok) return { ok: false, error: "unauthorized" } as const;
  const parsed = messageIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" } as const;
  const result = await discardMessage(
    authorization.admin.adminId, parsed.data.messageId, adminMessagesDependencies(),
  );
  if (result.kind !== "done") return { ok: false, error: result.kind } as const;
  revalidatePath("/admin/mensajes");
  revalidatePath("/admin/registros");
  return { ok: true } as const;
}

export async function linkContactManuallyAction(input: unknown) {
  const authorization = await requireAdmin("action");
  if (!authorization.ok) return { ok: false, error: "unauthorized" } as const;
  const parsed = linkContactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" } as const;
  const result = await linkContactManually(
    authorization.admin.adminId, parsed.data.registrationId, parsed.data.contactId,
    adminMessagesDependencies(),
  );
  if (result.kind !== "done") return { ok: false, error: result.kind } as const;
  revalidatePath("/admin/mensajes");
  revalidatePath("/admin/registros");
  return { ok: true } as const;
}

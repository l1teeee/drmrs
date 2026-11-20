import { buildTemplateValues } from "@/application/admin-registros/template-values";
import { renderMessageTemplate } from "@/domain/messaging/message-template";
import { expedientePath } from "@/domain/registration/expediente-link";
import { adminRegistrosDependencies } from "@/infrastructure/admin/admin-registros-runtime";
import { getEnv } from "@/infrastructure/config/env";
import { getPool } from "@/infrastructure/db/client";
import { postgresAdminMessageRepository } from "@/infrastructure/db/repositories/postgres-admin-message-repository";
import { log, safeErrorCode } from "@/infrastructure/observability/logger";

import { scheduleMessageDelivery } from "./schedule-message-delivery";

async function welcomeAlreadyQueued(registrationId: string): Promise<boolean> {
  const result = await getPool().query(
    "SELECT 1 FROM messages WHERE registration_id = $1 AND template_key = 'BIENVENIDA' LIMIT 1",
    [registrationId],
  );
  return result.rows.length > 0;
}

async function renderWelcomeText(registrationId: string): Promise<string | null> {
  const { store, codes, baseUrl } = adminRegistrosDependencies();
  const registration = await store.findById(registrationId);
  if (!registration) return null;
  const templates = await store.listTemplates();
  const template = templates.find((entry) => entry.key === "BIENVENIDA");
  if (!template) throw new Error("Message template not found");
  const expedienteUrl = baseUrl + expedientePath(
    registration.registrationNumber,
    codes.codeFor(registration.id, registration.linkVersion),
  );
  return renderMessageTemplate(template.body, buildTemplateValues(registration, expedienteUrl));
}

export async function queueWelcomeMessage(registrationId: string): Promise<void> {
  try {
    const mode = getEnv().MESSAGING_MODE;
    if (mode !== "instagram" && mode !== "log") return;
    if (await welcomeAlreadyQueued(registrationId)) return;

    const text = await renderWelcomeText(registrationId);
    if (text === null) return;
    const result = await postgresAdminMessageRepository.enqueue(null, registrationId, text, "BIENVENIDA");
    if (result.kind === "queued" && result.status === "QUEUED") scheduleMessageDelivery();
  } catch (error) {
    log("error", "welcome_message_failed", { code: safeErrorCode(error) });
  }
}

"use server";

import { revalidatePath } from "next/cache";

import {
  changePieceStatus,
  regenerateExpedienteLink,
  updateTemplate,
} from "@/application/admin-registros/admin-registros";
import {
  changeStatusSchema,
  registrationIdSchema,
  templateUpdateSchema,
} from "@/contracts/admin-registros";
import { adminRegistrosDependencies } from "@/infrastructure/admin/admin-registros-runtime";
import { requireAdmin } from "@/infrastructure/auth/require-admin";

export async function changePieceStatusAction(input: unknown) {
  const authorization = await requireAdmin("action");
  if (!authorization.ok) {
    return { ok: false, error: "unauthorized" } as const;
  }
  const parsed = changeStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid" } as const;
  }

  const result = await changePieceStatus(
    authorization.admin.adminId,
    parsed.data,
    adminRegistrosDependencies(),
  );
  if (result.kind !== "changed") {
    return { ok: false, error: result.kind } as const;
  }
  revalidatePath("/admin/registros");
  return { ok: true } as const;
}

export async function regenerateExpedienteLinkAction(input: unknown) {
  const authorization = await requireAdmin("action");
  if (!authorization.ok) {
    return { ok: false, error: "unauthorized" } as const;
  }
  const parsed = registrationIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid" } as const;
  }

  const result = await regenerateExpedienteLink(
    authorization.admin.adminId,
    parsed.data.registrationId,
    adminRegistrosDependencies(),
  );
  if (result.kind !== "regenerated") {
    return { ok: false, error: result.kind } as const;
  }
  revalidatePath("/admin/registros");
  return { ok: true, expedienteUrl: result.expedienteUrl, linkVersion: result.linkVersion } as const;
}

export async function updateTemplateAction(input: unknown) {
  const authorization = await requireAdmin("action");
  if (!authorization.ok) {
    return { ok: false, error: "unauthorized" } as const;
  }
  const parsed = templateUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid" } as const;
  }

  const result = await updateTemplate(
    authorization.admin.adminId,
    parsed.data,
    adminRegistrosDependencies(),
  );
  if (result.kind === "unknown_variables") {
    return { ok: false, error: "unknown_variables", variables: result.variables } as const;
  }
  if (result.kind === "rate_limited") {
    return { ok: false, error: "rate_limited" } as const;
  }
  revalidatePath("/admin/registros");
  return { ok: true } as const;
}
